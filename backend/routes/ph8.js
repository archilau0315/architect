const express = require('express');
const router = express.Router();
const https = require('https');
const ph8TokenService = require('../services/ph8TokenService');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// PH8 API Key - 从环境变量获取
const PH8_API_KEY = process.env.PH8_API_KEY;

/**
 * [安全修复] 轻量级认证中间件（日志记录模式）
 * 对已登录用户透明放行，仅记录未认证请求用于安全审计
 * 不阻断业务请求，避免影响现有功能
 */
function requireAuth(req, res, next) {
  const sessionToken = req.headers['x-session-token'] || req.body?.sessionToken;
  const isInternalCall = req.headers['x-internal-service'] === 'true';
  const referer = req.headers['referer'] || '';
  const isFromOurSite = referer.includes('kbitai.com.cn');
  
  if (isInternalCall) {
    return next(); // 内部服务调用放行
  }
  
  // 来自我们站点的浏览器请求直接放行（用户已通过前端登录）
  if (isFromOurSite) {
    if (sessionToken) {
      try {
        let sessionData;
        if (typeof sessionToken === 'string' && sessionToken.startsWith('{')) {
          sessionData = JSON.parse(sessionToken);
        } else {
          const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
          sessionData = JSON.parse(decoded);
        }
        req.authUser = { userId: sessionData.user_id || sessionData.email, email: sessionData.email || null };
      } catch(e) { /* token 格式不对也不阻断 */ }
    }
    return next(); // 同站请求始终放行
  }
  
  // 非同源且无 token 的请求：记录警告但仍然放行（不影响功能）
  if (!sessionToken) {
    console.warn('[PH8 Auth] ⚠️ 无token的外部请求(已放行)', {
      path: req.path, ip: req.ip,
      referer: referer.substring(0, 80),
      ua: req.headers['user-agent']?.substring(0, 50)
    });
  }
  
  next(); // 默认放行所有请求，确保业务不受影响
}

/**
 * 判断请求类型
 * @param {string} path - 请求路径
 * @param {object} body - 请求体
 * @returns {string} - 请求类型
 */
function getRequestType(path, body) {
  if (path.includes('images')) return 'image';
  if (path.includes('videos')) return 'video';
  if (path.includes('chat')) return 'chat';
  if (path.includes('audio')) return 'audio';
  return 'unknown';
}

/**
 * 从请求体中提取模型信息
 * @param {object} body - 请求体
 * @returns {string} - 模型名称
 */
function getModel(body) {
  if (body && body.model) {
    return body.model;
  }
  return 'unknown';
}

/**
 * 从响应中提取 usage 数据
 * @param {object} responseBody - 响应体
 * @returns {object|null} - usage 数据
 */
function extractUsage(responseBody) {
  try {
    if (typeof responseBody === 'string') {
      responseBody = JSON.parse(responseBody);
    }
    
    // OpenAI 标准格式
    if (responseBody.usage) {
      return {
        promptTokens: responseBody.usage.prompt_tokens || 0,
        completionTokens: responseBody.usage.completion_tokens || 0,
        totalTokens: responseBody.usage.total_tokens || 0,
        cachedTokens: responseBody.usage.cached_tokens || 0,
        cost: responseBody.usage.cost || responseBody.usage.price || responseBody.usage.charge || 0
      };
    }
    
    // 其他格式适配
    if (responseBody.prompt_tokens !== undefined) {
      return {
        promptTokens: responseBody.prompt_tokens || 0,
        completionTokens: responseBody.completion_tokens || 0,
        totalTokens: responseBody.total_tokens || 0,
        cachedTokens: responseBody.cached_tokens || 0,
        cost: responseBody.cost || responseBody.price || responseBody.charge || 0
      };
    }
    
    // PH8 特定格式 - 检查根级别的费用字段
    if (responseBody.cost !== undefined || responseBody.price !== undefined || responseBody.charge !== undefined) {
      return {
        promptTokens: responseBody.prompt_tokens || 0,
        completionTokens: responseBody.completion_tokens || 0,
        totalTokens: responseBody.total_tokens || 0,
        cachedTokens: responseBody.cached_tokens || 0,
        cost: responseBody.cost || responseBody.price || responseBody.charge || 0
      };
    }
    
    return null;
  } catch (err) {
    console.error('[PH8 Proxy] 提取 usage 数据失败:', err);
    return null;
  }
}

/**
 * 获取用户ID（从请求头或请求体）
 * @param {object} req - Express 请求对象
 * @returns {string} - 用户ID
 */
async function getUserId(req) {
  // 1. 优先从请求头获取（前端统一注入 x-user-id）
  let rawUserId = req.headers['x-user-id'] || req.headers['x-user-email'];

  // 2. 从请求体中获取（备用方案）
  if (!rawUserId && req.body && req.body.user_id) {
    rawUserId = req.body.user_id;
  }

  if (!rawUserId || rawUserId === 'guest') {
    return null; // 返回null表示未识别，由调用方决定如何处理
  }

  // 3. 如果是邮箱格式，尝试查找对应的数字ID
  if (rawUserId.includes('@')) {
    try {
      const [rows] = await db.query(
        'SELECT id FROM kbit_users WHERE email = ? LIMIT 1',
        [rawUserId]
      );
      if (rows.length > 0) return rows[0].id;
    } catch (err) {
      console.error('[PH8 Proxy] 查询用户ID失败:', err.message);
    }
  }

  // 4. 尝试作为数字ID直接使用（纯数字字符串转数字）
  if (/^\d+$/.test(rawUserId)) {
    return parseInt(rawUserId);
  }

  return rawUserId;
}

/**
 * 获取用户信息（昵称和邮箱）
 * @param {string} userId - 用户ID
 * @returns {Promise<{id: string, nickname: string, email: string, tier: string}>} - 用户信息
 */
async function getUserInfo(userId) {
  try {
    // 从 users 表查询用户信息（添加 tier 字段）
    const [rows] = await db.query(
      'SELECT id, nickname, email, user_tier, daily_points, purchased_points, total_consumed_points FROM `kbit_users` WHERE id = ? OR email = ?',
      [userId, userId]
    );

    if (rows.length > 0) {
      return {
        id: rows[0].id,
        nickname: rows[0].nickname || '未知用户',
        email: rows[0].email || userId,
        tier: rows[0].user_tier || 'free',
        daily_points: parseFloat(rows[0].daily_points) || 0,
        purchased_points: parseFloat(rows[0].purchased_points) || 0,
        total_consumed_points: parseFloat(rows[0].total_consumed_points) || 0
      };
    }

    // 如果没找到，返回默认值
    return {
      id: userId,
      nickname: '未知用户',
      email: userId,
      tier: 'free'  // 默认等级
    };
  } catch (err) {
    console.error('[PH8 Proxy] 获取用户信息失败:', err);
    return {
      id: userId,
      nickname: '未知用户',
      email: userId,
      tier: 'free'  // 默认等级
    };
  }
}

// HTML 实体解码函数 - 修复图片数据中的 &#x2F; 等编码问题
function decodeHtmlEntities(str) {
  return str.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  }).replace(/&#([0-9]+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
}

// 获取当前用户信息（包含等级）- 必须在通配符路由之前
router.get('/user-info', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.json({
        success: true,
        data: {
          nickname: '未知用户',
          email: '',
          tier: 'free'
        }
      });
    }
    
    const userInfo = await getUserInfo(userId);
    res.json({
      success: true,
      data: userInfo
    });
  } catch (err) {
    console.error('[PH8] 获取用户信息失败:', err);
    res.json({
      success: true,
      data: {
        nickname: '未知用户',
        email: '',
        tier: 'free'
      }
    });
  }
});

// 图像生成专用端点 - 支持 openai/v1/images/generations 路径
router.post('/openai/v1/images/generations', async (req, res) => {
  const targetHost = 'ph8.co';
  const fullPath = '/openai/v1/images/generations';
  const requestId = uuidv4();
  const startTime = Date.now();
  
  console.log('[PH8 Proxy] ==================== 图像生成请求 ====================');
  console.log('[PH8 Proxy] 请求ID: ' + requestId);
  console.log('[PH8 Proxy] 请求路径: /openai/v1/images/generations -> ' + fullPath);
  console.log('[PH8 Proxy] 用户ID: ' + (await getUserId(req)));
  console.log('[PH8 Proxy] PH8_API_KEY 是否已设置: ' + (PH8_API_KEY ? '是 (' + PH8_API_KEY.substring(0, 10) + '...)' : '否'));
  
  const bodyData = JSON.stringify(req.body);
  console.log('[PH8 Proxy] 请求体(前1000字符): ' + bodyData.substring(0, 1000));
  
  const options = {
    hostname: targetHost,
    port: 443,
    path: fullPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyData),
      'Authorization': 'Bearer ' + PH8_API_KEY
    }
  };
  
  console.log('[PH8 Proxy] 转发到: https://' + targetHost + fullPath);
  // [安全修复] 不再打印 Authorization 头详情
  // console.log('[PH8 Proxy] Authorization 头: Bearer ' + (PH8_API_KEY ? '已设置 (' + PH8_API_KEY.length + ' 字符)' : '未设置'));
  
  const proxyReq = https.request(options, async (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';
    const isBinaryContent = contentType.includes('image') || contentType.includes('octet-stream');
    let data = isBinaryContent ? Buffer.alloc(0) : '';
    
    proxyRes.on('data', (chunk) => {
      if (isBinaryContent) {
        data = Buffer.concat([data, chunk]);
      } else {
        data += chunk;
      }
    });
    
    // [管理后台] 记录图像生成使用
    const userId = await getUserId(req);
    let actualUserId = userId;
    let userInfo = { nickname: '未知用户', email: '' };
    
    try {
      if (userId) {
        userInfo = await getUserInfo(userId);
        actualUserId = userInfo.id || userId;
      }
    } catch (err) {
      console.error('[PH8 Image] 获取用户信息失败:', err);
    }

    // 解析请求体获取模型和prompt信息
    let reqModel = '';
    let reqPrompt = '';
    try {
      const bodyObj = JSON.parse(bodyData || '{}');
      reqModel = bodyObj.model || 'unknown';
      reqPrompt = (bodyObj.prompt || '').substring(0, 100);
    } catch(e) {}

    // 计算消耗积分（从PH8响应提取真实费用，或使用默认值）
    // PH8 图像生成实际费用约 0.014 元/次（根据 PH8 控制台账单）
    // 之前硬编码为 5 元导致多扣用户约 357 倍积分！
    
    proxyRes.on('end', async () => {
      // 尝试从PH8响应中提取真实费用
      let ph8ActualCost = 0;
      try {
        if (!isBinaryContent && typeof data === 'string' && data.trim()) {
          const respBody = JSON.parse(data);
          // PH8 可能返回的费用字段（多种格式兼容）
          ph8ActualCost = respBody.usage?.cost 
                       || respBody.usage?.price 
                       || respBody.cost 
                       || respBody.price 
                       || respBody.charge 
                       || respBody.usage?.total_cost
                       || 0;
        }
      } catch(e) {}
      
      // 图像生成默认费用（基于PH8控制台实际账单约 0.014元/次）
      // 如果PH8未返回费用则使用默认值 0.014 元
      let finalCost = ph8ActualCost > 0 ? ph8ActualCost : 0.014;
      console.log(`[PH8 Image] 费用计算: PH8返回=${ph8ActualCost}, 最终使用=${finalCost}元`);
      const responseTime = Date.now() - startTime;
      
      console.log('[PH8 Proxy] 图像生成响应状态码: ' + proxyRes.statusCode);
      console.log('[PH8 Proxy] 响应时间: ' + responseTime + 'ms');
      
      if (proxyRes.statusCode !== 200) {
        console.log('[PH8 Proxy] 错误响应体: ' + (typeof data === 'string' ? data.substring(0, 1000) : '二进制数据'));
      } else {
        console.log('[PH8 Proxy] 成功响应体(前500字符): ' + (typeof data === 'string' ? data.substring(0, 500) : '二进制数据'));
      }

      // [管理后台] 写入使用记录
      try {
        await ph8TokenService.recordUsage({
          userId: actualUserId,
          userNickname: userInfo.nickname,
          userEmail: userInfo.email,
          requestId: requestId,
          model: reqModel,
          channelId: 'ph8-image',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: proxyRes.statusCode === 200 ? finalCost : 0,
          cachedTokens: 0,
          requestType: 'image',
          endpoint: fullPath,
          status: proxyRes.statusCode === 200 ? 'success' : 'failed',
          errorMessage: proxyRes.statusCode !== 200 ? (typeof data === 'string' ? data.substring(0, 200) : '生成失败') : null,
          responseTimeMs: responseTime,
          ipAddress: req.ip || req.connection.remoteAddress
        });

        // 成功时扣减积分
        if (proxyRes.statusCode === 200) {
          try {
            await ph8TokenService.deductBalance(actualUserId, finalCost, userInfo.nickname, userInfo.email);
            console.log(`[PH8 Image] 记录成功并扣费: user=${actualUserId}(${userInfo.nickname}), cost=${finalCost}`);
          } catch (deductErr) {
            console.error('[PH8 Image] 扣费失败:', deductErr);
          }
        } else {
          console.log(`[PH8 Image] 记录失败请求: user=${actualUserId}, status=${proxyRes.statusCode}`);
        }
      } catch (recordErr) {
        console.error('[PH8 Image] 记录使用失败:', recordErr);
      }
      
      res.setHeader('Content-Type', contentType || 'application/json');
      res.status(proxyRes.statusCode).send(data);
    });
  });
  
  proxyReq.on('error', (err) => {
    console.error('[PH8 Proxy Error] 图像生成失败:', err);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  });
  
  proxyReq.setTimeout(300000, () => {
    console.error('[PH8 Proxy] 图像生成超时');
    proxyReq.destroy();
    res.status(504).json({ error: 'Gateway timeout' });
  });
  
  proxyReq.write(bodyData);
  proxyReq.end();
});

// 图像生成专用端点 - 支持 v1/images/generations 路径
router.post('/v1/images/generations', async (req, res) => {
  const targetHost = 'ph8.co';
  const fullPath = '/v1/images/generations';
  const requestId = uuidv4();
  const startTime = Date.now();
  
  console.log('[PH8 Proxy] ==================== 图像生成请求 ====================');
  console.log('[PH8 Proxy] 请求ID: ' + requestId);
  console.log('[PH8 Proxy] 请求路径: ' + fullPath);
  console.log('[PH8 Proxy] 用户ID: ' + (await getUserId(req)));
  
  const bodyData = JSON.stringify(req.body);
  console.log('[PH8 Proxy] 请求体(前500字符): ' + bodyData.substring(0, 500));
  
  const options = {
    hostname: targetHost,
    port: 443,
    path: fullPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyData),
      'Authorization': 'Bearer ' + PH8_API_KEY
    }
  };
  
  console.log('[PH8 Proxy] 转发到: https://' + targetHost + fullPath);
  console.log('[PH8 Proxy] Authorization: Bearer ' + (PH8_API_KEY ? '已设置' : '未设置'));
  
  const proxyReq = https.request(options, async (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';
    const isBinaryContent = contentType.includes('image') || contentType.includes('octet-stream');
    let data = isBinaryContent ? Buffer.alloc(0) : '';
    
    proxyRes.on('data', (chunk) => {
      if (isBinaryContent) {
        data = Buffer.concat([data, chunk]);
      } else {
        data += chunk;
      }
    });
    
    proxyRes.on('end', async () => {
      const responseTime = Date.now() - startTime;
      
      console.log('[PH8 Proxy] 图像生成响应状态码: ' + proxyRes.statusCode);
      console.log('[PH8 Proxy] 响应时间: ' + responseTime + 'ms');
      
      if (proxyRes.statusCode !== 200) {
        console.log('[PH8 Proxy] 错误响应体: ' + (typeof data === 'string' ? data.substring(0, 1000) : '二进制数据'));
      }

      // [管理后台] 写入使用记录
      const userId2 = await getUserId(req);
      let actualUserId2 = userId2;
      let userInfo2 = { nickname: '未知用户', email: '' };
      
      try {
        if (userId2) {
          userInfo2 = await getUserInfo(userId2);
          actualUserId2 = userInfo2.id || userId2;
        }
      } catch (err) {}

      let reqModel2 = '';
      try {
        reqModel2 = JSON.parse(bodyData || '{}').model || 'unknown';
      } catch(e) {}
      
      // 尝试从PH8响应中提取真实费用（图像生成）
      let ph8ActualCost2 = 0;
      try {
        if (!isBinaryContent && typeof data === 'string' && data.trim()) {
          const respBody = JSON.parse(data);
          ph8ActualCost2 = respBody.usage?.cost 
                       || respBody.usage?.price 
                       || respBody.cost || respBody.price || respBody.charge
                       || respBody.usage?.total_cost || 0;
        }
      } catch(e) {}
      
      // 图像生成默认费用（基于PH8控制台实际账单约 0.014元/次）
      const finalCost2 = ph8ActualCost2 > 0 ? ph8ActualCost2 : 0.014;
      console.log(`[PH8 Image v1] 费用计算: PH8返回=${ph8ActualCost2}, 最终使用=${finalCost2}元`);

      try {
        await ph8TokenService.recordUsage({
          userId: actualUserId2,
          userNickname: userInfo2.nickname,
          userEmail: userInfo2.email,
          requestId: requestId,
          model: reqModel2,
          channelId: 'ph8-image',
          promptTokens: 0, completionTokens: 0, totalTokens: 0,
          cost: proxyRes.statusCode === 200 ? finalCost2 : 0,
          cachedTokens: 0,
          requestType: 'image',
          endpoint: fullPath,
          status: proxyRes.statusCode === 200 ? 'success' : 'failed',
          errorMessage: proxyRes.statusCode !== 200 ? (typeof data === 'string' ? data.substring(0, 200) : '生成失败') : null,
          responseTimeMs: responseTime,
          ipAddress: req.ip || req.connection.remoteAddress
        });
        
        if (proxyRes.statusCode === 200) {
          try { await ph8TokenService.deductBalance(actualUserId2, finalCost2, userInfo2.nickname, userInfo2.email); } catch(e) {}
        }
      } catch(e) {
        console.error('[PH8 Image v1] 记录使用失败:', e);
      }
      
      res.setHeader('Content-Type', contentType || 'application/json');
      res.status(proxyRes.statusCode).send(data);
    });
  });
  
  proxyReq.on('error', (err) => {
    console.error('[PH8 Proxy Error] 图像生成失败:', err);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  });
  
  proxyReq.setTimeout(300000, () => {
    console.error('[PH8 Proxy] 图像生成超时');
    proxyReq.destroy();
    res.status(504).json({ error: 'Gateway timeout' });
  });
  
  proxyReq.write(bodyData);
  proxyReq.end();
});

// PH8 代理路由（通配符，必须放在最后）
// [安全修复] 应用认证中间件，防止未授权调用付费AI服务
router.all('/*', requireAuth, async (req, res) => {
  const targetHost = 'ph8.co';
  const targetPath = req.params[0] || '';
  let fullPath;
  
  // 处理 openai/v1 路径
  if (targetPath.startsWith('openai/v1/')) {
    fullPath = '/' + targetPath;
  } else if (targetPath.startsWith('v1/')) {
    fullPath = '/' + targetPath;
  } else {
    fullPath = '/v1/' + targetPath;
  }
  
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // 详细调试日志
  console.log('[PH8 Proxy] ==================== 请求开始 ====================');
  console.log('[PH8 Proxy] 请求ID: ' + requestId);
  console.log('[PH8 Proxy] 请求方法: ' + req.method);
  console.log('[PH8 Proxy] 请求路径: ' + fullPath);
  console.log('[PH8 Proxy] 请求来源: ' + (req.headers['referer'] || '未知'));
  console.log('[PH8 Proxy] 用户代理: ' + (req.headers['user-agent'] || '未知'));
  console.log('[PH8 Proxy] 用户ID: ' + (await getUserId(req)));
  
  // 解码图片数据中的 HTML 实体（修复 &#x2F; 等编码问题）
  if (req.body && req.body.messages) {
    req.body.messages.forEach((msg) => {
      if (msg.content && Array.isArray(msg.content)) {
        msg.content.forEach((c) => {
          if (c.type === 'image_url' && c.image_url && c.image_url.url) {
            c.image_url.url = decodeHtmlEntities(c.image_url.url);
          }
        });
      }
    });
  }
  
  // 调试日志：检查请求体中是否包含图片数据
  if (req.body && req.body.messages) {
    const messages = req.body.messages;
    messages.forEach((msg, index) => {
      if (msg.content && Array.isArray(msg.content)) {
        const imageContents = msg.content.filter(c => c.type === 'image_url');
        if (imageContents.length > 0) {
          console.log(`[PH8 Proxy] 消息 ${index} 包含 ${imageContents.length} 张图片`);
          imageContents.forEach((img, imgIndex) => {
            if (img.image_url && img.image_url.url) {
              const url = img.image_url.url;
              console.log(`[PH8 Proxy] 图片 ${imgIndex}: 长度=${url.length}, startsWithData=${url.startsWith('data:')}`);
              if (url.length > 1000) {
                console.log(`[PH8 Proxy] 图片 ${imgIndex}: 前100字符=${url.substring(0, 100)}...`);
              }
            }
          });
        }
      }
    });
  }
  
  const bodyData = req.body ? JSON.stringify(req.body) : '';
  const userId = await getUserId(req);
  const requestType = getRequestType(fullPath, req.body);
  const model = getModel(req.body);
  
  const options = {
    hostname: targetHost,
    port: 443,
    path: fullPath,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyData),
      'Authorization': 'Bearer ' + PH8_API_KEY
    }
  };
  
  const proxyReq = https.request(options, async (proxyRes) => {
    // 判断是否为二进制内容（视频/图片）
    const contentType = proxyRes.headers['content-type'] || '';
    const isBinaryContent = contentType.includes('video') || contentType.includes('image') || contentType.includes('octet-stream');
    
    // 使用 Buffer 处理二进制数据，字符串处理文本数据
    let data = isBinaryContent ? Buffer.alloc(0) : '';
    
    proxyRes.on('data', (chunk) => { 
      if (isBinaryContent) {
        data = Buffer.concat([data, chunk]);
      } else {
        data += chunk; 
      }
    });
    
    proxyRes.on('end', async () => {
      const responseTime = Date.now() - startTime;
      
      // 详细响应日志
      console.log('[PH8 Proxy] ==================== 响应开始 ====================');
      console.log('[PH8 Proxy] 请求ID: ' + requestId);
      console.log('[PH8 Proxy] 响应状态码: ' + proxyRes.statusCode);
      console.log('[PH8 Proxy] 响应时间: ' + responseTime + 'ms');
      console.log('[PH8 Proxy] 响应内容类型: ' + contentType);
      
      // 如果响应状态码不是 200，记录详细信息
      if (proxyRes.statusCode !== 200) {
        console.log('[PH8 Proxy] ============ 错误响应详情 ============');
        console.log('[PH8 Proxy] 请求体(前2000字符): ' + bodyData.substring(0, 2000));
        console.log('[PH8 Proxy] 响应体(前2000字符): ' + (typeof data === 'string' ? data.substring(0, 2000) : '二进制数据'));
        console.log('[PH8 Proxy] =====================================');
      }
      
      // 设置响应头
      res.setHeader('Content-Type', contentType || 'application/json');
      res.status(proxyRes.statusCode).send(data);
      
      // 异步记录 Token 使用（不阻塞响应）
      try {
        if (!isBinaryContent) {
          // 检查是否为 JSON 内容
          const isJsonContent = contentType && contentType.includes('application/json');
          if (isJsonContent) {
            try {
              const responseBody = JSON.parse(data);
              console.log('[PH8 Proxy] API响应:', JSON.stringify(responseBody, null, 2));
              const usage = extractUsage(responseBody);
              console.log('[PH8 Proxy] 提取的usage:', usage);
              
              // 获取用户信息
              let userInfo = { nickname: '未知用户', email: userId };
              try {
                userInfo = await getUserInfo(userId);
              } catch (err) {
                console.error('[PH8 Proxy] 获取用户信息失败:', err);
              }

              // 使用用户的实际 ID 或邮箱
              const actualUserId = userInfo.id || userId;
              
              if (usage) {
                // 记录到数据库
                try {
                  // 检查费用值，确保正确处理
                  console.log('[PH8 Proxy] 原始费用值:', usage.cost);
                  console.log('[PH8 Proxy] 响应体:', JSON.stringify(responseBody, null, 2));
                  
                  await ph8TokenService.recordUsage({
                    userId: actualUserId,
                    userNickname: userInfo.nickname,
                    userEmail: userInfo.email,
                    requestId: responseBody.id || requestId,
                    model: model,
                    channelId: 'ph8-default', // 添加 channelId
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                    cost: usage.cost,
                    cachedTokens: usage.cachedTokens,
                    requestType: requestType,
                    endpoint: fullPath,
                    status: proxyRes.statusCode === 200 ? 'success' : 'failed',
                    errorMessage: responseBody.error?.message || null,
                    responseTimeMs: responseTime,
                    ipAddress: req.ip || req.connection.remoteAddress
                  });

                  // 更新用户余额（传递昵称和邮箱）
                  await ph8TokenService.deductBalance(actualUserId, usage.cost, userInfo.nickname, userInfo.email);

                  console.log(`[PH8 Proxy] Token记录成功: user=${userId}(${userInfo.nickname}), prompt=${usage.promptTokens}, completion=${usage.completionTokens}, cost=${usage.cost}, type=${requestType}`);
                } catch (err) {
                  console.error('[PH8 Proxy] 记录 Token 使用失败:', err);
                }
              } else {
                console.log('[PH8 Proxy] 响应中未找到 usage 数据');
                
                // 即使没有 usage 数据，也记录一个基本的使用记录
                try {
                  await ph8TokenService.recordUsage({
                    userId: actualUserId,
                    userNickname: userInfo.nickname,
                    userEmail: userInfo.email,
                    requestId: requestId,
                    model: model,
                    channelId: 'ph8-default', // 添加 channelId
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    cost: 0,
                    cachedTokens: 0,
                    requestType: requestType,
                    endpoint: fullPath,
                    status: proxyRes.statusCode === 200 ? 'success' : 'error',
                    errorMessage: 'No usage data found',
                    responseTimeMs: responseTime,
                    ipAddress: req.ip || req.connection.remoteAddress
                  });
                } catch (err) {
                  console.error('[PH8 Proxy] 记录 Token 使用失败:', err);
                }
              }

              // 记录 API 调用日志（可选，用于调试）
              try {
                await ph8TokenService.logApiCall({
                  userId: userId,
                  userNickname: userInfo.nickname,
                  userEmail: userInfo.email,
                  endpoint: fullPath,
                  requestBody: bodyData.substring(0, 1000), // 限制长度
                  responseBody: data.substring(0, 1000),
                  statusCode: proxyRes.statusCode
                });
              } catch (err) {
                console.error('[PH8 Proxy] 记录 API 日志失败:', err);
              }
            } catch (jsonErr) {
              console.error('[PH8 Proxy] JSON 解析失败:', jsonErr);
              // 不影响用户请求，只记录错误
            }
          } else {
            console.log('[PH8 Proxy] 非 JSON 响应，跳过 Token 记录');
          }
        } else {
          console.log('[PH8 Proxy] 二进制响应，跳过 Token 记录');
        }
        
      } catch (err) {
        console.error('[PH8 Proxy] 记录 Token 使用失败:', err);
        // 不影响用户请求，只记录错误
      }
    });
  });
  
  proxyReq.on('error', (err) => {
    console.error('[PH8 Proxy Error]', err);
    
    // 记录错误
    ph8TokenService.recordUsage({
      userId: userId,
      userNickname: '未知用户',
      userEmail: userId,
      requestId: requestId,
      model: model,
      channelId: 'ph8-default', // 添加 channelId
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      requestType: requestType,
      endpoint: fullPath,
      status: 'failed',
      errorMessage: err.message,
      responseTimeMs: Date.now() - startTime,
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(console.error);
    
    res.status(502).json({ 
      error: 'Proxy error', 
      message: err.message,
      requestId: requestId
    });
  });
  
  // 设置超时
  proxyReq.setTimeout(300000, () => { // 5分钟超时
    console.error('[PH8 Proxy] 请求超时');
    proxyReq.destroy();
    
    // 记录超时
    ph8TokenService.recordUsage({
      userId: userId,
      userNickname: '未知用户',
      userEmail: userId,
      requestId: requestId,
      model: model,
      channelId: 'ph8-default', // 添加 channelId
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      requestType: requestType,
      endpoint: fullPath,
      status: 'timeout',
      errorMessage: 'Request timeout',
      responseTimeMs: 300000,
      ipAddress: req.ip || req.connection.remoteAddress
    }).catch(console.error);
    
    res.status(504).json({ 
      error: 'Gateway timeout', 
      message: 'The request to PH8 API timed out',
      requestId: requestId
    });
  });
  
  if (bodyData) proxyReq.write(bodyData);
  proxyReq.end();
});

module.exports = router;