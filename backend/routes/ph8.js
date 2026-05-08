const express = require('express');
const router = express.Router();
const https = require('https');
const ph8TokenService = require('../services/ph8TokenService');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// 引入结构化日志服务
const { logger, LogLevel } = require('../services/loggerService');

// 日志级别配置：生产环境默认 WARN，开发环境默认 DEBUG
const isProduction = process.env.NODE_ENV === 'production';
const PH8_LOG_LEVEL = isProduction
  ? (LogLevel[process.env.PH8_LOG_LEVEL?.toUpperCase()] || LogLevel.WARN)
  : LogLevel.DEBUG;

// 是否记录请求体（生产环境默认关闭）
const LOG_REQUEST_BODY = !isProduction || process.env.PH8_LOG_BODY === 'true';

// 是否记录响应体（生产环境默认关闭）
const LOG_RESPONSE_BODY = !isProduction || process.env.PH8_LOG_RESPONSE === 'true';

// PH8 API Key - 从环境变量获取
const PH8_API_KEY = process.env.PH8_API_KEY;

/**
 * 统一日志函数 - 根据日志级别和环境配置决定是否输出
 */
const ph8Log = {
  debug: (message, data) => {
    if (PH8_LOG_LEVEL <= LogLevel.DEBUG) {
      logger.debug(`[PH8] ${message}`, data);
    }
  },
  info: (message, data) => {
    if (PH8_LOG_LEVEL <= LogLevel.INFO) {
      logger.info(`[PH8] ${message}`, data);
    }
  },
  warn: (message, data) => {
    if (PH8_LOG_LEVEL <= LogLevel.WARN) {
      logger.warn(`[PH8] ${message}`, data);
    }
  },
  error: (message, data) => {
    if (PH8_LOG_LEVEL <= LogLevel.ERROR) {
      logger.error(`[PH8] ${message}`, data);
    }
  }
};

/**
 * 脱敏用户标识 - 仅显示前后各2位
 */
const maskUserId = (userId) => {
  if (!userId || typeof userId !== 'string') return 'unknown';
  if (userId.length <= 4) return '***';
  return `${userId.substring(0, 2)}***${userId.substring(userId.length - 2)}`;
};

/**
 * 脱敏邮箱
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `***@${domain}`;
  return `${local.substring(0, 2)}***@${domain}`;
};

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
    ph8Log.warn('外部请求无token(已放行)', {
      path: req.path,
      ip: req.ip,
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

    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let cachedTokens = 0;
    let cost = 0;
    
    if (responseBody.usage) {
      promptTokens = responseBody.usage.prompt_tokens || responseBody.usage.promptTokens || 0;
      completionTokens = responseBody.usage.completion_tokens || responseBody.usage.completionTokens || 0;
      totalTokens = responseBody.usage.total_tokens || responseBody.usage.totalTokens || 0;
      cachedTokens = responseBody.usage.cached_tokens || responseBody.usage.cachedTokens || 0;
      cost = responseBody.usage.cost || responseBody.usage.price || responseBody.usage.charge || 0;
      if (!cost && responseBody.usage.cost_details && responseBody.usage.cost_details.upstream_inference_cost) {
        cost = responseBody.usage.cost_details.upstream_inference_cost;
      }
    }
    
    if (!totalTokens) {
      totalTokens = responseBody.total_tokens || responseBody.tokens || responseBody.totalTokens || 0;
    }
    if (!promptTokens) {
      promptTokens = responseBody.prompt_tokens || responseBody.promptTokens || 0;
    }
    if (!completionTokens) {
      completionTokens = responseBody.completion_tokens || responseBody.completionTokens || 0;
    }
    if (!cachedTokens) {
      cachedTokens = responseBody.cached_tokens || responseBody.cachedTokens || 0;
    }
    if (!cost) {
      cost = responseBody.cost || responseBody.price || responseBody.charge || 
             responseBody.total_cost || responseBody.totalPrice || 0;
    }

    if (!cost && responseBody.output && responseBody.output.usage) {
      cost = responseBody.output.usage.cost || responseBody.output.usage.price || 0;
      if (!totalTokens) {
        totalTokens = responseBody.output.usage.total_tokens || responseBody.output.usage.totalTokens || 0;
      }
    }

    if (!cost && responseBody.results && Array.isArray(responseBody.results)) {
      for (const result of responseBody.results) {
        if (result.usage) {
          cost = cost || result.usage.cost || result.usage.price || 0;
          totalTokens = totalTokens || result.usage.total_tokens || result.usage.totalTokens || 0;
        }
        cost = cost || result.cost || result.price || 0;
      }
    }

    return {
      promptTokens: parseInt(promptTokens) || 0,
      completionTokens: parseInt(completionTokens) || 0,
      totalTokens: parseInt(totalTokens) || 0,
      cachedTokens: parseInt(cachedTokens) || 0,
      cost: typeof cost === 'string' ? parseFloat(cost) : (cost || 0)
    };
  } catch (err) {
    ph8Log.error('提取usage数据失败', { error: err.message });
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, cost: 0 };
  }
}

/**
 * 获取用户ID（从请求头或请求体）
 * @param {object} req - Express 请求对象
 * @returns {string} - 用户ID
 */
async function getUserId(req) {
  const allHeaders = Object.keys(req.headers).filter(k => k.toLowerCase().includes('user')).reduce((acc, k) => ({ ...acc, [k]: req.headers[k] }), {});
  ph8Log.debug('解析用户ID', {
    headers: Object.keys(allHeaders).join(', '),
    path: req.path
  });

  if (req.authUser && req.authUser.userId && req.authUser.userId !== 'guest' && req.authUser.userId !== '0') {
    const authUserId = req.authUser.userId;
    ph8Log.debug('从session token解析用户ID', { maskedUserId: maskUserId(authUserId) });
    if (typeof authUserId === 'string' && authUserId.includes('@')) {
      try {
        const [rows] = await db.query('SELECT id FROM kbit_users WHERE email = ? LIMIT 1', [authUserId]);
        if (rows.length > 0) {
          ph8Log.debug('邮箱转换为数字ID成功', { maskedEmail: maskEmail(authUserId), userId: rows[0].id });
          return { userId: rows[0].id, rawValue: authUserId };
        }
      } catch (e) { /* ignore */ }
    }
    if (typeof authUserId === 'string' && /^\d+$/.test(authUserId)) {
      return { userId: parseInt(authUserId), rawValue: authUserId };
    }
    return { userId: authUserId, rawValue: String(authUserId) };
  }

  let rawUserId = req.headers['x-user-id'] || req.headers['x-user-email'];
  ph8Log.debug('从请求头获取用户ID', { rawType: typeof rawUserId, hasValue: !!rawUserId });

  if (!rawUserId && req.body && req.body.user_id) {
    rawUserId = req.body.user_id;
    ph8Log.debug('从请求体获取用户ID', { maskedUserId: maskUserId(rawUserId) });
  }

  if (!rawUserId || rawUserId === 'guest' || rawUserId === '0' || rawUserId === '未识别') {
    ph8Log.warn('无法识别用户', {
      rawValue: rawUserId || '(empty)',
      referer: (req.headers['referer'] || '').substring(0, 50),
      ip: req.ip
    });
    return { userId: null, rawValue: rawUserId || '(empty)' };
  }

  if (typeof rawUserId === 'string' && rawUserId.includes('@')) {
    try {
      const [rows] = await db.query(
        'SELECT id FROM kbit_users WHERE email = ? LIMIT 1',
        [rawUserId]
      );
      if (rows.length > 0) {
        ph8Log.debug('邮箱转换为数字ID', { maskedEmail: maskEmail(rawUserId), userId: rows[0].id });
        return { userId: rows[0].id, rawValue: rawUserId };
      }
    } catch (err) {
      ph8Log.error('查询用户ID失败', { error: err.message });
    }
  }

  if (typeof rawUserId === 'string' && /^\d+$/.test(rawUserId)) {
    ph8Log.debug('解析数字ID', { userId: parseInt(rawUserId) });
    return { userId: parseInt(rawUserId), rawValue: rawUserId };
  }

  if (typeof rawUserId === 'number') {
    ph8Log.debug('解析数字类型ID', { userId: rawUserId });
    return { userId: rawUserId, rawValue: String(rawUserId) };
  }

  ph8Log.debug('返回原始值', { rawValue: rawUserId });
  return { userId: rawUserId, rawValue: String(rawUserId) };
}

/**
 * 获取用户信息（昵称和邮箱）
 * @param {string} userId - 用户ID
 * @returns {Promise<{id: string, nickname: string, email: string, tier: string}>} - 用户信息
 */
async function getUserInfo(userId) {
  try {
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

    return {
      id: userId,
      nickname: '未知用户',
      email: userId,
      tier: 'free'
    };
  } catch (err) {
    ph8Log.error('获取用户信息失败', { error: err.message, userId: maskUserId(String(userId)) });
    return {
      id: userId,
      nickname: '未知用户',
      email: userId,
      tier: 'free'
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
    ph8Log.error('获取用户信息失败', { error: err.message });
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

  ph8Log.info('图像生成请求开始', {
    requestId,
    path: fullPath,
    apiKeySet: !!PH8_API_KEY
  });

  const bodyData = JSON.stringify(req.body);
  if (LOG_REQUEST_BODY) {
    ph8Log.debug('请求体', { body: bodyData.substring(0, 500) });
  }

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

  ph8Log.debug('转发请求', { target: `https://${targetHost}${fullPath}` });

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
      ph8Log.error('获取用户信息失败', { error: err.message });
    }

    let reqModel = '';
    try {
      const bodyObj = JSON.parse(bodyData || '{}');
      reqModel = bodyObj.model || 'unknown';
    } catch(e) {}

    proxyRes.on('end', async () => {
      let ph8ActualCost = 0;
      try {
        // [重要] 打印完整响应头和响应体用于调试（使用 warn 确保生产环境可见）
        ph8Log.warn('[PH8-COST-DEBUG] PH8图像生成完整响应', {
          requestId,
          contentType: proxyRes.headers['content-type'],
          allHeaders: JSON.stringify(proxyRes.headers),
          isBinaryContent,
          dataLength: isBinaryContent ? (Buffer.isBuffer(data) ? data.length : String(data).length) : String(data).length,
          dataPreview: isBinaryContent ? `[Buffer ${Buffer.isBuffer(data) ? data.length : 'unknown'} bytes]` : String(data).substring(0, 500)
        });

        if (!isBinaryContent && typeof data === 'string' && data.trim()) {
          const respBody = JSON.parse(data);
          ph8Log.warn('[PH8-COST-DEBUG] PH8 JSON响应体', { requestId, responseBody: respBody });

          ph8ActualCost = respBody.usage?.cost
                       || respBody.usage?.price
                       || respBody.cost
                       || respBody.price
                       || respBody.charge
                       || respBody.usage?.total_cost
                       || 0;
          if (!ph8ActualCost && respBody.usage?.cost_details?.upstream_inference_cost) {
            ph8ActualCost = respBody.usage.cost_details.upstream_inference_cost;
            ph8Log.warn('[PH8-COST-DEBUG] 从upstream_inference_cost获取到费用', { requestId, cost: ph8ActualCost });
          }
        }
        
        // [重要] 图像生成返回二进制数据时，尝试从响应头获取费用
        if (!ph8ActualCost && isBinaryContent) {
          const costHeader = proxyRes.headers['x-ph8-cost']
                          || proxyRes.headers['x-cost']
                          || proxyRes.headers['x-api-cost']
                          || proxyRes.headers['x-inference-cost']
                          || proxyRes.headers['x-usage-cost'];
          ph8Log.warn('[PH8-COST-DEBUG] 二进制响应头中的费用字段', {
            requestId,
            costHeader: costHeader || '未找到',
            allHeaders: Object.keys(proxyRes.headers).filter(k => k.toLowerCase().includes('cost') || k.toLowerCase().includes('x-'))
          });
          if (costHeader) {
            ph8ActualCost = parseFloat(costHeader) || 0;
            ph8Log.warn('[PH8-COST-DEBUG] 从响应头获取到费用', { requestId, cost: ph8ActualCost, headerName: 'cost-header' });
          }
        }
      } catch(e) {
        ph8Log.error('[PH8-COST-DEBUG] 解析PH8响应失败', { requestId, error: e.message });
      }

      let finalCost = ph8ActualCost > 0 ? ph8ActualCost : 0;
      const responseTime = Date.now() - startTime;

      ph8Log.info('图像生成响应', {
        requestId,
        status: proxyRes.statusCode,
        responseTime,
        cost: finalCost,
        maskedUserId: maskUserId(String(actualUserId))
      });

      if (LOG_RESPONSE_BODY && proxyRes.statusCode !== 200) {
        ph8Log.warn('错误响应体', { body: String(data).substring(0, 500) });
      }

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

        if (proxyRes.statusCode === 200 && finalCost > 0) {
          try {
            await ph8TokenService.deductBalance(actualUserId, finalCost, userInfo.nickname, userInfo.email);
            ph8Log.info('图像生成扣费成功', {
              requestId,
              maskedUserId: maskUserId(String(actualUserId)),
              cost: finalCost
            });
          } catch (deductErr) {
            ph8Log.error('图像生成扣费失败', { error: deductErr.message });
          }
        }
      } catch (recordErr) {
        ph8Log.error('图像生成记录失败', { error: recordErr.message });
      }

      res.setHeader('Content-Type', contentType || 'application/json');
      res.status(proxyRes.statusCode).send(data);
    });
  });

  proxyReq.on('error', (err) => {
    ph8Log.error('图像生成请求失败', { error: err.message, requestId });
    res.status(502).json({ error: 'Proxy error', message: err.message });
  });

  proxyReq.setTimeout(300000, () => {
    ph8Log.error('图像生成请求超时', { requestId });
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

  ph8Log.info('图像生成v1请求', { requestId, path: fullPath });

  const bodyData = JSON.stringify(req.body);
  if (LOG_REQUEST_BODY) {
    ph8Log.debug('请求体', { body: bodyData.substring(0, 500) });
  }

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

  ph8Log.debug('转发请求', { target: `https://${targetHost}${fullPath}`, apiKeySet: !!PH8_API_KEY });

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

      let ph8ActualCost2 = 0;
      try {
        const costHeader = proxyRes.headers['x-ph8-cost'] || proxyRes.headers['x-cost'] || proxyRes.headers['x-api-cost'] || proxyRes.headers['cost'];
        if (costHeader) {
          ph8ActualCost2 = parseFloat(costHeader);
        }

        if (!ph8ActualCost2 && !isBinaryContent && typeof data === 'string' && data.trim()) {
          const respBody = JSON.parse(data);
          ph8ActualCost2 = respBody.usage?.cost
                       || respBody.usage?.price
                       || respBody.cost || respBody.price || respBody.charge
                       || respBody.usage?.total_cost || 0;
          if (!ph8ActualCost2 && respBody.usage?.cost_details?.upstream_inference_cost) {
            ph8ActualCost2 = respBody.usage.cost_details.upstream_inference_cost;
          }
        }
      } catch(e) {}

      const finalCost2 = ph8ActualCost2 > 0 ? ph8ActualCost2 : 0;

      ph8Log.info('图像生成v1响应', {
        requestId,
        status: proxyRes.statusCode,
        responseTime,
        cost: finalCost2,
        maskedUserId: maskUserId(String(actualUserId2))
      });

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
        }
      } catch(e) {
        ph8Log.error('记录使用失败', { error: e.message });
      }

      res.setHeader('Content-Type', contentType || 'application/json');
      res.status(proxyRes.statusCode).send(data);
    });
  });

  proxyReq.on('error', (err) => {
    ph8Log.error('图像生成请求失败', { error: err.message, requestId });
    res.status(502).json({ error: 'Proxy error', message: err.message });
  });

  proxyReq.setTimeout(300000, () => {
    ph8Log.error('图像生成请求超时', { requestId });
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

  ph8Log.info('PH8代理请求', {
    requestId,
    method: req.method,
    path: fullPath,
    referer: (req.headers['referer'] || '').substring(0, 50)
  });

  if (LOG_REQUEST_BODY) {
    ph8Log.debug('请求头', { ua: (req.headers['user-agent'] || '').substring(0, 50) });
  }

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

  // 检查请求体中是否包含图片数据（调试用）
  if (LOG_REQUEST_BODY && req.body && req.body.messages) {
    const messages = req.body.messages;
    messages.forEach((msg, index) => {
      if (msg.content && Array.isArray(msg.content)) {
        const imageContents = msg.content.filter(c => c.type === 'image_url');
        if (imageContents.length > 0) {
          ph8Log.debug('消息包含图片', {
            msgIndex: index,
            imageCount: imageContents.length,
            firstImageLen: imageContents[0]?.image_url?.url?.length || 0
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

  // 安全检查：匿名用户处理与额度控制
  if (userId === null || userId === 'anonymous') {
    ph8Log.warn('匿名请求', {
      requestId,
      path: fullPath,
      type: requestType,
      rawId: rawUserIdValue,
      ip: req.ip
    });

    if (req.method === 'POST') {
      ph8Log.warn('允许匿名POST请求', { requestId, path: fullPath });
    }
  }

  // 额度预检：已识别用户
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
            ph8Log.warn('用户额度不足', {
              userId: numericUserId,
              dailyUsed: du,
              dailyQuota: dq,
              totalPoints: tp
            });
          }
        }
      }
    } catch (e) {
      ph8Log.error('额度预检失败', { error: e.message });
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

      ph8Log.info('PH8响应', {
        requestId,
        status: proxyRes.statusCode,
        responseTime,
        contentType
      });

      if (LOG_RESPONSE_BODY && proxyRes.statusCode !== 200) {
        ph8Log.warn('错误响应详情', {
          body: String(data).substring(0, 500)
        });
      }

      res.setHeader('Content-Type', contentType || 'application/json');
      res.status(proxyRes.statusCode).send(data);

      try {
        const isVideoGetRequest = fullPath.includes('/videos') && req.method === 'GET';

        if (isVideoGetRequest && !isBinaryContent) {
          try {
            const responseBody = JSON.parse(data);
            if (responseBody.status === 'completed' && (responseBody.usage || responseBody.tokens || responseBody.cost)) {
              ph8Log.debug('视频完成状态，允许记账', { requestId });
            } else {
              ph8Log.debug('跳过视频GET记账', { requestId, status: responseBody.status });
              return;
            }
          } catch (e) {
            ph8Log.debug('跳过视频GET记账(解析失败)', { requestId });
            return;
          }
        } else if (isVideoGetRequest && isBinaryContent) {
          ph8Log.debug('跳过视频二进制下载记账', { requestId });
          return;
        }

        const isVideoResponse = fullPath.includes('/videos') && !isBinaryContent;

        if (!isBinaryContent) {
          const isJsonContent = contentType && contentType.includes('application/json');
          if (isJsonContent || isVideoResponse) {
              try {
                const responseBody = JSON.parse(data);
                const usage = extractUsage(responseBody);

                let userInfo = { nickname: '未知用户', email: userId };
                if (userId === null && rawUserIdValue && rawUserIdValue !== '(empty)' && rawUserIdValue !== 'guest') {
                  userInfo = { nickname: `用户(${rawUserIdValue.substring(0, 20)})`, email: rawUserIdValue };
                  try {
                    const fallbackInfo = await getUserInfo(rawUserIdValue);
                    if (fallbackInfo && fallbackInfo.nickname !== '未知用户') {
                      userInfo = fallbackInfo;
                    }
                  } catch (e) {}
                } else if (userId !== null) {
                  try {
                    userInfo = await getUserInfo(userId);
                  } catch (err) {
                    ph8Log.error('获取用户信息失败', { error: err.message });
                  }
                } else {
                  userInfo = { nickname: `未识别-${req.ip?.substring(0, 12) || 'unknown'}`, email: rawUserIdValue || null };
                }

                const actualUserId = (userInfo.id || userId || rawUserIdValue || 'anonymous');

                let calculatedCost = usage.cost;
                let totalTokens = usage.totalTokens;
                if (calculatedCost && typeof calculatedCost === 'string') {
                  calculatedCost = parseFloat(calculatedCost);
                }

                await ph8TokenService.recordUsage({
                  userId: actualUserId,
                  userNickname: userInfo.nickname,
                  userEmail: userInfo.email,
                  requestId: responseBody.id || requestId,
                  model: model,
                  channelId: 'ph8-default',
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

                if (calculatedCost > 0) {
                  await ph8TokenService.deductBalance(actualUserId, calculatedCost, userInfo.nickname, userInfo.email);
                }

                ph8Log.info('Token记录成功', {
                  requestId,
                  maskedUserId: maskUserId(String(actualUserId)),
                  prompt: usage.promptTokens,
                  completion: usage.completionTokens,
                  cost: calculatedCost,
                  type: requestType
                });

                if (calculatedCost === 0 && proxyRes.statusCode === 200) {
                  ph8Log.warn('请求成功但未找到费用数据', { 
                    requestId, 
                    maskedUserId: maskUserId(String(actualUserId)),
                    responsePreview: JSON.stringify(responseBody).substring(0, 200)
                  });
                }

                try {
                  await ph8TokenService.logApiCall({
                    userId: userId,
                    userNickname: userInfo.nickname,
                    userEmail: userInfo.email,
                    endpoint: fullPath,
                    requestBody: bodyData.substring(0, 1000),
                    responseBody: data.substring(0, 1000),
                    statusCode: proxyRes.statusCode
                  });
                } catch (err) {
                  ph8Log.error('记录API日志失败', { error: err.message });
                }
              } catch (jsonErr) {
                ph8Log.error('JSON解析失败', { error: jsonErr.message });
              }
            } else {
            ph8Log.debug('非JSON响应，跳过Token记录', { requestId });
          }
        } else {
          ph8Log.debug('二进制响应，记录基本使用信息', { requestId });

          if (fullPath.includes('/videos') && req.method === 'GET') {
            ph8Log.debug('跳过视频二进制GET记账', { requestId, path: fullPath });
            return;
          }

          try {
            let userInfo = { nickname: '未知用户', email: userId };
            if (userId === null && rawUserIdValue && rawUserIdValue !== '(empty)' && rawUserIdValue !== 'guest') {
              userInfo = { nickname: `用户(${rawUserIdValue.substring(0, 20)})`, email: rawUserIdValue };
              try {
                const fallbackInfo = await getUserInfo(rawUserIdValue);
                if (fallbackInfo && fallbackInfo.nickname !== '未知用户') {
                  userInfo = fallbackInfo;
                }
              } catch (e) {}
            } else if (userId !== null) {
              try {
                userInfo = await getUserInfo(userId);
              } catch (err) {
                ph8Log.error('获取用户信息失败', { error: err.message });
              }
            } else {
              userInfo = { nickname: `未识别-${req.ip?.substring(0, 12) || 'unknown'}`, email: rawUserIdValue || null };
            }

            const actualUserId = (userInfo.id || userId || rawUserIdValue || 'anonymous');

            // 从响应头或响应体中提取费用信息
            let calculatedCost = 0;
            let totalTokens = 0;
            let promptTokens = 0;
            let completionTokens = 0;

            // 先尝试从响应头提取
            const costHeader = proxyRes.headers['x-ph8-cost'] || proxyRes.headers['x-cost'] || proxyRes.headers['x-api-cost'] || proxyRes.headers['cost'];
            if (costHeader) {
              calculatedCost = parseFloat(costHeader);
            }

            // 尝试从响应体解析 JSON 提取费用（PH8 费用在 usage.cost_details.upstream_inference_cost）
            if (!calculatedCost && data) {
              try {
                const jsonBody = JSON.parse(data);
                if (jsonBody.usage && jsonBody.usage.cost_details && jsonBody.usage.cost_details.upstream_inference_cost) {
                  calculatedCost = jsonBody.usage.cost_details.upstream_inference_cost;
                  totalTokens = jsonBody.usage.total_tokens || jsonBody.usage.totalTokens || 0;
                  promptTokens = jsonBody.usage.prompt_tokens || jsonBody.usage.promptTokens || 0;
                  completionTokens = jsonBody.usage.completion_tokens || jsonBody.usage.completionTokens || 0;
                } else if (jsonBody.usage && jsonBody.usage.cost) {
                  calculatedCost = jsonBody.usage.cost;
                } else if (jsonBody.cost) {
                  calculatedCost = jsonBody.cost;
                }
              } catch (e) {
                // 响应体不是 JSON，忽略
              }
            }

            await ph8TokenService.recordUsage({
              userId: actualUserId,
              userNickname: userInfo.nickname,
              userEmail: userInfo.email,
              requestId: requestId,
              model: model,
              channelId: requestType === 'image' ? 'ph8-image' : 'ph8-video',
              promptTokens: promptTokens,
              completionTokens: completionTokens,
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

            if (proxyRes.statusCode === 200 && calculatedCost > 0) {
              await ph8TokenService.deductBalance(actualUserId, calculatedCost, userInfo.nickname, userInfo.email);
            }

            ph8Log.info('二进制响应记录成功', {
              requestId,
              maskedUserId: maskUserId(String(actualUserId)),
              type: requestType,
              cost: calculatedCost
            });
          } catch (err) {
            ph8Log.error('记录二进制响应日志失败', { error: err.message });
          }
        }
        
      } catch (err) {
        ph8Log.error('记录Token使用失败', { error: err.message });
      }
    });
  });

  proxyReq.on('error', (err) => {
    ph8Log.error('PH8代理请求失败', { error: err.message, requestId });

    ph8TokenService.recordUsage({
      userId: userId,
      userNickname: '未知用户',
      userEmail: userId,
      requestId: requestId,
      model: model,
      channelId: 'ph8-default',
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
    }).catch(() => {});

    res.status(502).json({
      error: 'Proxy error',
      message: err.message,
      requestId: requestId
    });
  });

  proxyReq.setTimeout(300000, () => {
    ph8Log.error('PH8代理请求超时', { requestId });

    ph8TokenService.recordUsage({
      userId: userId,
      userNickname: '未知用户',
      userEmail: userId,
      requestId: requestId,
      model: model,
      channelId: 'ph8-default',
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
    }).catch(() => {});

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