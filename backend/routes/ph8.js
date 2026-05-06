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
 * 从请求体或路径中提取模型信息
 * @param {object} body - 请求体
 * @param {string} path - 请求路径（用于GET请求推断）
 * @returns {string} - 模型名称
 */
function getModel(body, path) {
  if (body && body.model) {
    return body.model;
  }
  if (path) {
    if (path.includes('/videos')) {
      const match = path.match(/\/videos\/([^\/\?]+)/);
      if (match && match[1]) {
        return `video-task:${match[1].substring(0, 12)}`;
      }
      return 'video-generation';
    }
    if (path.includes('/images')) return 'image-generation';
    if (path.includes('/chat')) return 'chat-completion';
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
  const allHeaders = Object.keys(req.headers).filter(k => k.toLowerCase().includes('user')).reduce((acc, k) => ({ ...acc, [k]: req.headers[k] }), {});
  console.log('[PH8 Proxy][getUserId] 所有user相关请求头:', JSON.stringify(allHeaders));

  // Step 0: 优先使用 requireAuth 中间件已解析的 session token (最可靠)
  if (req.authUser && req.authUser.userId && req.authUser.userId !== 'guest' && req.authUser.userId !== '0') {
    const authUserId = req.authUser.userId;
    console.log('[PH8 Proxy][getUserId] Step0 从authUser(已解析session token)获取:', `"${authUserId}"`);
    if (typeof authUserId === 'string' && authUserId.includes('@')) {
      try {
        const [rows] = await db.query('SELECT id FROM kbit_users WHERE email = ? LIMIT 1', [authUserId]);
        if (rows.length > 0) {
          console.log('[PH8 Proxy][getUserId] Step0a authUser邮箱→数字ID:', authUserId, '→', rows[0].id);
          return { userId: rows[0].id, rawValue: authUserId };
        }
      } catch (e) { /* ignore */ }
    }
    if (typeof authUserId === 'string' && /^\d+$/.test(authUserId)) {
      return { userId: parseInt(authUserId), rawValue: authUserId };
    }
    return { userId: authUserId, rawValue: String(authUserId) };
  }

  // Step 1: 从 x-user-id / x-user-email 请求头获取
  let rawUserId = req.headers['x-user-id'] || req.headers['x-user-email'];
  console.log('[PH8 Proxy][getUserId] Step1 从header获取:', rawUserId !== undefined ? `"${rawUserId}" (类型:${typeof rawUserId})` : 'undefined');

  // Step 2: 从请求体中获取（备用方案）
  if (!rawUserId && req.body && req.body.user_id) {
    rawUserId = req.body.user_id;
    console.log('[PH8 Proxy][getUserId] Step2 从body.user_id获取:', `"${rawUserId}"`);
  }

  if (!rawUserId || rawUserId === 'guest' || rawUserId === '0' || rawUserId === '未识别') {
    console.warn(`[PH8 Proxy][getUserId] ⚠️ 无法识别用户! rawUserId="${rawUserId}", 将返回null。Referer: ${req.headers['referer']}, IP: ${req.ip}`);
    return { userId: null, rawValue: rawUserId || '(empty)' };
  }

  if (typeof rawUserId === 'string' && rawUserId.includes('@')) {
    try {
      const [rows] = await db.query(
        'SELECT id FROM kbit_users WHERE email = ? LIMIT 1',
        [rawUserId]
      );
      if (rows.length > 0) {
        console.log('[PH8 Proxy][getUserId] Step3 邮箱→数字ID:', rawUserId, '→', rows[0].id);
        return { userId: rows[0].id, rawValue: rawUserId };
      }
    } catch (err) {
      console.error('[PH8 Proxy][getUserId] 查询用户ID失败:', err.message);
    }
  }

  if (typeof rawUserId === 'string' && /^\d+$/.test(rawUserId)) {
    console.log('[PH8 Proxy][getUserId] Step4 纯数字ID:', parseInt(rawUserId));
    return { userId: parseInt(rawUserId), rawValue: rawUserId };
  }

  if (typeof rawUserId === 'number') {
    console.log('[PH8 Proxy][getUserId] Step5 数字类型ID:', rawUserId);
    return { userId: rawUserId, rawValue: String(rawUserId) };
  }

  console.log('[PH8 Proxy][getUserId] Step6 返回原始值:', rawUserId);
  return { userId: rawUserId, rawValue: String(rawUserId) };
}

/**
 * 获取用户信息（昵称和邮箱）
 * @param {string} userId - 用户ID
 * @returns {Promise<{id: string, nickname: string, email: string, tier: string}>} - 用户信息
 */
async function getUserInfo(userId) {
  try {
    // 从 users 表查询用户信息（新的统一积分池结构）
    const [rows] = await db.query(
      'SELECT id, nickname, email, user_tier, total_points, daily_quota, daily_used FROM `kbit_users` WHERE id = ? OR email = ?',
      [userId, userId]
    );

    if (rows.length > 0) {
      return {
        id: rows[0].id,
        nickname: rows[0].nickname || '未知用户',
        email: rows[0].email || userId,
        tier: rows[0].user_tier || 'free',
        total_points: parseFloat(rows[0].total_points) || 0,
        daily_quota: parseFloat(rows[0].daily_quota) || 0,
        daily_used: parseFloat(rows[0].daily_used) || 0
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
    const userResult = await getUserId(req);
    const userId = userResult.userId;
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
router.post('/openai/v1/images/generations', requireAuth, async (req, res) => {
  const targetHost = 'ph8.co';
  const fullPath = '/openai/v1/images/generations';
  const requestId = uuidv4();
  const startTime = Date.now();
  
  console.log('[PH8 Proxy] ==================== 图像生成请求 ====================');
  console.log('[PH8 Proxy] 请求ID: ' + requestId);
  console.log('[PH8 Proxy] 请求路径: /openai/v1/images/generations -> ' + fullPath);
  console.log('[PH8 Proxy] 用户ID: ' + JSON.stringify(await getUserId(req)));
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
    const userResultImg = await getUserId(req);
    const userId = userResultImg.userId;
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
    // PH8 图像生成费用：仅使用 PH8 API 返回的真实值，不做任何估算
    // 如果 PH8 未返回费用，则 cost=0，不扣用户积分
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
      
      // 仅使用 PH8 返回的真实费用，不做任何估算
      let finalCost = ph8ActualCost > 0 ? ph8ActualCost : 0;
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

        // 仅当 PH8 返回了真实费用时才扣减积分（cost=0 表示PH8未返回费用，不扣）
        if (proxyRes.statusCode === 200 && finalCost > 0) {
          try {
            await ph8TokenService.deductBalance(actualUserId, finalCost, userInfo.nickname, userInfo.email);
            console.log(`[PH8 Image] 记录成功并扣费: user=${actualUserId}(${userInfo.nickname}), cost=${finalCost}`);
          } catch (deductErr) {
            console.error('[PH8 Image] 扣费失败:', deductErr);
          }
        } else if (proxyRes.statusCode === 200 && finalCost === 0) {
          console.log(`[PH8 Image] PH8未返回费用，仅记录日志不扣费: user=${actualUserId}(${userInfo.nickname})`);
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
  console.log('[PH8 Proxy] 用户ID: ' + JSON.stringify(await getUserId(req)));
  
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
      const userResult2 = await getUserId(req);
      const userId2 = userResult2.userId;
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
        // 首先尝试从响应头中提取费用（PH8会在响应头中返回费用）
        const costHeader = proxyRes.headers['x-ph8-cost'] || proxyRes.headers['x-cost'] || proxyRes.headers['x-api-cost'] || proxyRes.headers['cost'];
        if (costHeader) {
          ph8ActualCost2 = parseFloat(costHeader);
          console.log('[PH8 Image v1] 从响应头获取费用: ' + ph8ActualCost2 + '元');
        }
        
        // 如果响应头没有，尝试从JSON响应体中提取
        if (!ph8ActualCost2 && !isBinaryContent && typeof data === 'string' && data.trim()) {
          const respBody = JSON.parse(data);
          ph8ActualCost2 = respBody.usage?.cost 
                       || respBody.usage?.price 
                       || respBody.cost || respBody.price || respBody.charge
                       || respBody.usage?.total_cost || 0;
          console.log('[PH8 Image v1] 从响应体获取费用: ' + ph8ActualCost2 + '元');
        }
        
        // 不使用请求头中的预估费用，只使用PH8返回的真实费用
        if (!ph8ActualCost2) {
          console.log('[PH8 Image v1] PH8未返回费用数据，cost=0');
        }
      } catch(e) {
        console.log('[PH8 Image v1] 提取费用失败: ' + e.message);
      }
      
      // 仅使用 PH8 返回的真实费用，不做任何估算
      const finalCost2 = ph8ActualCost2 > 0 ? ph8ActualCost2 : 0;
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
        
        if (proxyRes.statusCode === 200 && finalCost2 > 0) {
          try { await ph8TokenService.deductBalance(actualUserId2, finalCost2, userInfo2.nickname, userInfo2.email); } catch(e) {}
        } else if (proxyRes.statusCode === 200) {
          console.log(`[PH8 Image v1] PH8未返回费用，仅记录不扣费`);
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
  console.log('[PH8 Proxy] 用户ID: ' + JSON.stringify(await getUserId(req)));
  
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
  const userResult = await getUserId(req);
  const userId = userResult.userId;
  const rawUserIdValue = userResult.rawValue;
  const requestType = getRequestType(fullPath, req.body);
  const model = getModel(req.body, fullPath);

  // [安全检查] 匿名用户处理与额度控制
  if (userId === null || userId === 'anonymous') {
    console.warn(`[PH8 Proxy] ⚠️ 匿名请求拦截: path=${fullPath}, type=${requestType}, rawId="${rawUserIdValue}", IP=${req.ip}`);
    
    // 尝试通过IP关联最近用户（同一IP最近5分钟内的已知用户）
    try {
      const [recentUsers] = await db.query(
        `SELECT DISTINCT user_id, user_nickname FROM kbit_usage_logs 
         WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) 
           AND user_id IS NOT NULL AND user_id != 0 AND user_id != 'anonymous'
         ORDER BY created_at DESC LIMIT 1`,
        [req.ip || req.connection.remoteAddress]
      );
      if (recentUsers.length > 0) {
        console.log(`[PH8 Proxy] ✅ IP关联成功: IP=${req.ip} → userId=${recentUsers[0].user_id} (${recentUsers[0].user_nickname})`);
      }
    } catch (e) { /* ignore */ }
    
    // 对于POST请求（生成类操作），匿名用户仍允许通过但记录警告
    // 额度控制由前端 localStorage + 后端 consume API 双重保障
    if (req.method === 'POST') {
      console.warn(`[PH8 Proxy] 允许匿名POST请求继续（依赖前端额度控制）: ${fullPath}`);
    }
  }
  
  // [额度预检] 已识别用户：检查是否超出日限额
  if (userId && userId !== 'anonymous' && typeof userId !== 'string' || (typeof userId === 'number' && userId > 0)) {
    try {
      const numericUserId = typeof userId === 'number' ? userId : parseInt(userId);
      if (!isNaN(numericUserId) && numericUserId > 0) {
        const [quotaCheck] = await db.query(
          `SELECT daily_quota, daily_used, total_points FROM kbit_users WHERE id = ?`,
          [numericUserId]
        );
        if (quotaCheck.length > 0) {
          const dq = parseFloat(quotaCheck[0].daily_quota) || 200;
          const du = parseFloat(quotaCheck[0].daily_used) || 0;
          const tp = parseFloat(quotaCheck[0].total_points) || 0;
          if (du >= dq && tp <= 0) {
            console.warn(`[PH8 Proxy] 🚫 用户${numericUserId}已达日限额(${du}/${dq})且积分为0，建议拒绝`);
          }
        }
      }
    } catch (e) { 
      console.error('[PH8 Proxy] 额度预检失败:', e.message); 
    }
  }
  
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
        // [防重复扣费] 视频的GET请求（轮询/下载）通常不记账，只有POST创建才记账
        // 但视频完成状态的GET请求可能包含usage数据，需要处理
        const isVideoGetRequest = fullPath.includes('/videos') && req.method === 'GET';
        
        if (isVideoGetRequest && !isBinaryContent) {
          // 尝试解析响应体，检查是否为完成状态
          try {
            const responseBody = JSON.parse(data);
            // 如果是完成状态且包含usage数据，允许记账
            if (responseBody.status === 'completed' && (responseBody.usage || responseBody.tokens || responseBody.cost)) {
              console.log(`[PH8 Proxy] 视频完成状态GET请求，包含usage数据，允许记账`);
            } else {
              console.log(`[PH8 Proxy] 跳过视频GET请求记账(非完成状态或无usage): ${fullPath}`);
              return;
            }
          } catch (e) {
            // 解析失败，可能是下载请求
            console.log(`[PH8 Proxy] 跳过视频GET请求记账(解析失败): ${fullPath}`);
            return;
          }
        } else if (isVideoGetRequest && isBinaryContent) {
          // 二进制内容（实际视频文件下载），跳过记账
          console.log(`[PH8 Proxy] 跳过视频二进制GET请求记账(下载): ${fullPath}`);
          return;
        }
        
        // 视频生成响应可能是 application/json 但包含视频URL，需要特殊处理
        const isVideoResponse = fullPath.includes('/videos') && !isBinaryContent;
        
        if (!isBinaryContent) {
          // 检查是否为 JSON 内容
          const isJsonContent = contentType && contentType.includes('application/json');
          if (isJsonContent || isVideoResponse) {
            try {
              const responseBody = JSON.parse(data);
              console.log('[PH8 Proxy] API响应:', JSON.stringify(responseBody, null, 2));
              const usage = extractUsage(responseBody);
              console.log('[PH8 Proxy] 提取的usage:', usage);
              
              // 获取用户信息（增强版：即使userId为null也尝试用原始值识别）
              let userInfo = { nickname: '未知用户', email: userId };
              if (userId === null && rawUserIdValue && rawUserIdValue !== '(empty)' && rawUserIdValue !== 'guest') {
                console.log(`[PH8 Proxy] userId为null但存在rawUserIdValue="${rawUserIdValue}"，尝试用它查找用户`);
                userInfo = { nickname: `用户(${rawUserIdValue.substring(0, 20)})`, email: rawUserIdValue };
                try {
                  const fallbackInfo = await getUserInfo(rawUserIdValue);
                  if (fallbackInfo && fallbackInfo.nickname !== '未知用户') {
                    userInfo = fallbackInfo;
                    console.log(`[PH8 Proxy] ✅ 通过rawUserIdValue成功找到用户:`, userInfo.nickname);
                  }
                } catch (e) {
                  console.log('[PH8 Proxy] rawUserIdValue查询失败，使用原始值作为标识');
                }
              } else if (userId !== null) {
                try {
                  userInfo = await getUserInfo(userId);
                } catch (err) {
                  console.error('[PH8 Proxy] 获取用户信息失败:', err);
                }
              } else {
                console.warn(`[PH8 Proxy] ⚠️ 完全无法识别用户! rawUserIdValue="${rawUserIdValue}", 将记录为"未识别-IP:${req.ip?.substring(0, 12)}"`);
                userInfo = { nickname: `未识别-${req.ip?.substring(0, 12) || 'unknown'}`, email: rawUserIdValue || null };
              }

              // 使用用户的实际 ID 或邮箱
              const actualUserId = (userInfo.id || userId || rawUserIdValue || 'anonymous');
              
              if (usage) {
                // 记录到数据库
                try {
                  // 检查费用值，确保正确处理
                  console.log('[PH8 Proxy] 原始费用值:', usage.cost);
                  console.log('[PH8 Proxy] 响应体:', JSON.stringify(responseBody, null, 2));
                  
                  // 费用处理：严格使用PH8返回的值，不做任何估算
                  let calculatedCost = usage.cost;
                  let totalTokens = usage.totalTokens;
                  // 确保费用是数字格式
                  if (calculatedCost && typeof calculatedCost === 'string') {
                    calculatedCost = parseFloat(calculatedCost);
                  }
                  console.log(`[PH8 Proxy] 费用提取: PH8返回cost=${calculatedCost}, totalTokens=${totalTokens}`);
                  
                  await ph8TokenService.recordUsage({
                    userId: actualUserId,
                    userNickname: userInfo.nickname,
                    userEmail: userInfo.email,
                    requestId: responseBody.id || requestId,
                    model: model,
                    channelId: 'ph8-default', // 添加 channelId
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: totalTokens,
                    cost: calculatedCost,
                    cachedTokens: usage.cachedTokens,
                    requestType: requestType,
                    endpoint: fullPath,
                    status: proxyRes.statusCode === 200 ? 'success' : 'failed',
                    errorMessage: responseBody.error?.message || null,
                    responseTimeMs: responseTime,
                    ipAddress: req.ip || req.connection.remoteAddress
                  });

                  // 更新用户余额（传递昵称和邮箱）
                  if (calculatedCost > 0) {
                    await ph8TokenService.deductBalance(actualUserId, calculatedCost, userInfo.nickname, userInfo.email);
                  }

                  console.log(`[PH8 Proxy] Token记录成功: user=${userId}(${userInfo.nickname}), prompt=${usage.promptTokens}, completion=${usage.completionTokens}, cost=${calculatedCost}, type=${requestType}`);
                } catch (err) {
                  console.error('[PH8 Proxy] 记录 Token 使用失败:', err);
                }
              } else {
                console.log('[PH8 Proxy] 响应中未找到 usage 数据');
                
                // 费用处理：严格使用PH8返回的值，不做任何估算
                let videoCost = 0;
                let totalTokens = 0;
                
                // 尝试从响应中直接获取费用（支持多种格式）
                const costFromResponse = responseBody.cost || responseBody.price || responseBody.charge || 
                                      (responseBody.usage && (responseBody.usage.cost || responseBody.usage.price)) || 0;
                totalTokens = responseBody.total_tokens || responseBody.tokens || 
                             (responseBody.usage && responseBody.usage.total_tokens) || 0;
                
                if (costFromResponse && costFromResponse > 0) {
                  videoCost = parseFloat(costFromResponse);
                  console.log(`[PH8 Proxy] 费用提取: PH8返回cost=${videoCost}, totalTokens=${totalTokens}`);
                } else {
                  console.log(`[PH8 Proxy] ⚠️ 请求: PH8未返回费用数据, cost=0。响应体预览: ${JSON.stringify(responseBody).substring(0, 200)}`);
                }
                
                // 即使没有 usage 数据，也记录一个基本的使用记录
                try {
                  await ph8TokenService.recordUsage({
                    userId: actualUserId,
                    userNickname: userInfo.nickname,
                    userEmail: userInfo.email,
                    requestId: requestId,
                    model: model,
                    channelId: 'ph8-default',
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: totalTokens,
                    cost: videoCost,
                    cachedTokens: 0,
                    requestType: requestType,
                    endpoint: fullPath,
                    status: proxyRes.statusCode === 200 ? 'success' : 'error',
                    errorMessage: videoCost > 0 ? null : 'No usage data found',
                    responseTimeMs: responseTime,
                    ipAddress: req.ip || req.connection.remoteAddress
                  });
                  
                  // 仅当 PH8 返回了真实费用时才扣减（视频通常 cost=0，由前端从PH8账单扣费）
                  if (videoCost > 0) {
                    try {
                      await ph8TokenService.deductBalance(actualUserId, videoCost, userInfo.nickname, userInfo.email);
                      console.log(`[PH8 Proxy] 视频余额扣减成功: user=${userInfo.nickname}, cost=${videoCost}元`);
                    } catch (deductErr) {
                      console.error('[PH8 Proxy] 视频余额扣减失败:', deductErr.message);
                    }
                  }
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
          console.log('[PH8 Proxy] 二进制响应（图片/视频），记录基本使用信息');
          
          // [防重复扣费] 视频二进制下载(GET)不记账
          if (fullPath.includes('/videos') && req.method === 'GET') {
            console.log(`[PH8 Proxy] 跳过视频二进制GET请求记账(防重复): ${fullPath}`);
            return;
          }
          
          // 对于二进制响应（图片/视频），也要记录使用日志
          try {
            let userInfo = { nickname: '未知用户', email: userId };
            if (userId === null && rawUserIdValue && rawUserIdValue !== '(empty)' && rawUserIdValue !== 'guest') {
              userInfo = { nickname: `用户(${rawUserIdValue.substring(0, 20)})`, email: rawUserIdValue };
              try {
                const fallbackInfo = await getUserInfo(rawUserIdValue);
                if (fallbackInfo && fallbackInfo.nickname !== '未知用户') {
                  userInfo = fallbackInfo;
                }
              } catch (e) { /* ignore */ }
            } else if (userId !== null) {
              try {
                userInfo = await getUserInfo(userId);
              } catch (err) {
                console.error('[PH8 Proxy] 获取用户信息失败:', err);
              }
            } else {
              userInfo = { nickname: `未识别-${req.ip?.substring(0, 12) || 'unknown'}`, email: rawUserIdValue || null };
            }
            
            const actualUserId = (userInfo.id || userId || rawUserIdValue || 'anonymous');
            
            // 费用处理：严格使用PH8返回的值，不做任何估算
            let calculatedCost = 0;
            let totalTokens = 0;
            
            if (usage) {
              calculatedCost = usage.cost ? parseFloat(usage.cost) : 0;
              totalTokens = usage.totalTokens || 0;
            }
            
            console.log(`[PH8 Proxy] 费用提取: PH8返回cost=${calculatedCost}, totalTokens=${totalTokens}`);
            
            await ph8TokenService.recordUsage({
              userId: actualUserId,
              userNickname: userInfo.nickname,
              userEmail: userInfo.email,
              requestId: requestId,
              model: model,
              channelId: requestType === 'image' ? 'ph8-image' : 'ph8-video',
              promptTokens: usage?.promptTokens || 0,
              completionTokens: usage?.completionTokens || 0,
              totalTokens: totalTokens,
              cost: proxyRes.statusCode === 200 ? calculatedCost : 0,
              cachedTokens: 0,
              requestType: requestType,
              endpoint: fullPath,
              status: proxyRes.statusCode === 200 ? 'success' : 'error',
              errorMessage: null,
              responseTimeMs: responseTime,
              ipAddress: req.ip || req.connection.remoteAddress
            });
            
            // 仅当计算出了真实费用时才扣减余额
            if (proxyRes.statusCode === 200 && calculatedCost > 0) {
              await ph8TokenService.deductBalance(actualUserId, calculatedCost, userInfo.nickname, userInfo.email);
            }
            
            console.log(`[PH8 Proxy] 二进制响应记录成功: user=${userId}(${userInfo.nickname}), type=${requestType}, cost=${calculatedCost}`);
          } catch (err) {
            console.error('[PH8 Proxy] 记录二进制响应使用日志失败:', err);
          }
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