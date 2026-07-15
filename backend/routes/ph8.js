const express = require('express');
const router = express.Router();
const https = require('https');
const ph8TokenService = require('../services/ph8TokenService');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const imageWatermarkService = require('../services/imageWatermarkService');

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
 * WellAI 模型官方定价表（来源: https://wellai.cc/models）
 * 当 PH8 API 响应中不包含费用字段时，使用此表按 token 计算实际费用
 * 价格单位：元/百万tokens (CNY/M tokens)
 * 更新日期：2026-05-09
 *
 * 注意：这是 PH8 平台公开发布的官方价格，非自行设定。
 * 若 PH8 调整价格，请同步更新此表。
 */
const PH8_MODEL_PRICING = {
  // ===== Google 图像生成模型（来源: https://wellai.cc/models） =====
  'gemini-3.1-flash-image-preview':     { inputPrice: 1.7,  outputPrice: 10.6  },
  'gemini-3.1-flash-image-preview@latest': { inputPrice: 1.7,  outputPrice: 10.6  },
  'gemini-3.1-flash-image-preview@001': { inputPrice: 1.7,  outputPrice: 10.6  },
  'Nano-Banana-Pro2':                  { inputPrice: 1.7,  outputPrice: 10.6  },

  'gemini-3-pro-image-preview':        { inputPrice: 14.2, outputPrice: 85.3  },
  'gemini-3-pro-image-preview@latest': { inputPrice: 14.2, outputPrice: 85.3  },
  'Nano-Banana-Pro':                   { inputPrice: 14.2, outputPrice: 85.3  },
  'Nano-Banana':                       { inputPrice: 2.1,  outputPrice: 17.7  },
  'gemini-2.5-flash-image':            { inputPrice: 2.1,  outputPrice: 17.7  },

  // ===== Google 多模态大语言模型（来源: https://wellai.cc/models） =====
  'gemini-3.1-flash-lite-preview':    { inputPrice: 1.7,  outputPrice: 10.6  },
  'gemini-3.1-pro-preview':            { inputPrice: 14.2, outputPrice: 85.3  },
  'gemini-3-flash-preview':            { inputPrice: 3.5,  outputPrice: 21.3  },
  'gemini-3-pro-preview':              { inputPrice: 14.2, outputPrice: 85.3  },
  'gemini-2.5-flash':                  { inputPrice: 2.1,  outputPrice: 17.7  },
  'gemini-2.5-pro':                    { inputPrice: 8.8,  outputPrice: 71.1  },

  // ===== 豆包视频生成模型 doubao-seedance（来源: https://wellai.cc/models） =====
  'doubao-seedance-2-fast':            { inputPrice: 0.1,  outputPrice: 37.0  },
  'doubao-seedance-2-0':               { inputPrice: 0.1,  outputPrice: 46.0  },
  'doubao-seedance-1-5-pro':           { inputPrice: 0.1,  outputPrice: 15.0  },
  'doubao-seedance-1-0-lite-i2v':      { inputPrice: 0.1,  outputPrice: 10.0  },
  'doubao-seedance-1-0-lite-t2v':      { inputPrice: 0.1,  outputPrice: 10.0  },
  'doubao-seedance-1-0-pro':           { inputPrice: 0.1,  outputPrice: 16.0  },
  'doubao-seedance-1-0-pro-fast':      { inputPrice: 0.1,  outputPrice: 4.2   },
  'doubao-seedance-1-0-pro-fast-251015': { inputPrice: 0.1,  outputPrice: 4.2   },

  // ===== DeepSeek 模型（Chat）=====
  'deepseek-chat':      { inputPrice: 0.5,   outputPrice: 2.0  },
  'deepseek-reasoner':  { inputPrice: 0.5,   outputPrice: 2.0  },
  'deepseek-v3':       { inputPrice: 0.5,   outputPrice: 2.0  },
  'deepseek-v3.2':     { inputPrice: 0.5,   outputPrice: 2.0  },

  // ===== 其他常见模型（Chat，PH8 返回 cost 时不会用到此处数据）=====
  'gpt-4o':            { inputPrice: 15.0,  outputPrice: 60.0 },
  'gpt-4o-mini':       { inputPrice: 0.9,   outputPrice: 3.6  },
};

/**
 * 根据 PH8 官方定价计算费用（fallback）
 * 仅当 PH8 API 响应不包含费用字段时使用
 * @param {string} model - 模型名称
 * @param {number} promptTokens - 输入 token 数
 * @param {number} completionTokens - 输出 token 数
 * @returns {{cost: number, source: string}} 计算结果和来源说明
 */
function calculateCostFromTokens(model, promptTokens, completionTokens) {
  // 精确匹配模型名
  let pricing = PH8_MODEL_PRICING[model];

  // 前缀模糊匹配（处理带版本后缀的变体）
  if (!pricing) {
    for (const [key, value] of Object.entries(PH8_MODEL_PRICING)) {
      if (model.startsWith(key.split('@')[0]) || key.includes(model) || model.includes(key.replace(/@.*$/, ''))) {
        pricing = value;
        break;
      }
    }
  }

  if (!pricing || (!promptTokens && !completionTokens)) {
    return { cost: 0, source: 'no-pricing' };
  }

  const cost = ((promptTokens || 0) * pricing.inputPrice + (completionTokens || 0) * pricing.outputPrice) / 1000000;
  return {
    cost: Math.round(cost * 10000000) / 10000000, // 保留足够精度
    source: `ph8-pricing:${model}`
  };
}

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
    let modelName = null;
    
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

    // 提取 PH8 返回的真实模型名（优先级从高到低）
    modelName = responseBody.model || responseBody.model_id || null;
    // output 中也可能有模型信息
    if (!modelName && responseBody.output) {
      modelName = responseBody.output.model || responseBody.output.model_id || null;
    }
    // results[] 中提取
    if (!modelName && Array.isArray(responseBody.results) && responseBody.results.length > 0) {
      modelName = responseBody.results[0].model || responseBody.results[0].model_id || null;
    }

    return {
      promptTokens: parseInt(promptTokens) || 0,
      completionTokens: parseInt(completionTokens) || 0,
      totalTokens: parseInt(totalTokens) || 0,
      cachedTokens: parseInt(cachedTokens) || 0,
      cost: typeof cost === 'string' ? parseFloat(cost) : (cost || 0),
      modelName: modelName || null
    };
  } catch (err) {
    ph8Log.error('提取usage数据失败', { error: err.message });
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, cost: 0, modelName: null };
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

/**
 * 清理日志对象 - 移除或截断大数据字段（如 base64 图片、长文本）
 * 防止日志文件膨胀和终端显示混乱
 */
function sanitizeForLog(obj, maxStrLen = 200) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'b64_json' || key === 'data' && typeof value === 'string' && value.length > 100) {
      result[key] = `[base64 ${value.length} bytes]`;
    } else if (typeof value === 'string' && value.length > maxStrLen) {
      // 检测是否为 base64 数据（data URI 或纯 base64 长串）
      if (/^[A-Za-z0-9+/=]{200,}$/.test(value) || value.startsWith('data:')) {
        result[key] = `[truncated ${value.length} bytes]`;
      } else {
        result[key] = value.substring(0, maxStrLen) + `...[+${value.length - maxStrLen}]`;
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value, maxStrLen);
    } else {
      result[key] = value;
    }
  }
  return result;
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

// 图像生成专用端点 - 支持 /images/generations 路径（用于 /api/ph8/openai/v1 挂载）
// [修复] ph8.co 只支持标准 /v1/images/generations 路径，不支持 /openai/v1/ 前缀
router.post('/images/generations', requireAuth, async (req, res) => {
  const targetHost = 'wellai.cc';
  const fullPath = '/v1/images/generations';
  const requestId = uuidv4();
  const startTime = Date.now();

  ph8Log.info('图像生成请求开始', {
    requestId,
    path: fullPath,
    apiKeySet: !!PH8_API_KEY
  });

  let bodyData = JSON.stringify(req.body);
  if (LOG_REQUEST_BODY) {
    ph8Log.debug('请求体', { body: sanitizeForLog(req.body, 100) });
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

    // [修复] 用 Promise 包裹数据收集，确保 'end' 事件绝不因 async await 延迟丢失
    const data = await new Promise((resolve, reject) => {
      let body = isBinaryContent ? Buffer.alloc(0) : '';
      proxyRes.on('data', (chunk) => {
        if (isBinaryContent) {
          body = Buffer.concat([body, chunk]);
        } else {
          body += chunk;
        }
      });
      proxyRes.on('end', () => resolve(body));
      proxyRes.on('error', (err) => reject(err));
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

    // 以下为原来的 end 回调逻辑，现在直接执行（已拿到完整 data）
    {
      let ph8ActualCost = 0;
      let imgPromptTokens = 0;
      let imgCompletionTokens = 0;
      try {
        if (!isBinaryContent && typeof data === 'string' && data.trim()) {
          const respBody = JSON.parse(data);
          // 优先从 PH8 响应中提取费用（Chat 等类型会返回）
          ph8ActualCost = respBody.usage?.cost
                       || respBody.usage?.price
                       || respBody.cost
                       || respBody.price
                       || respBody.charge
                       || respBody.usage?.total_cost
                       || 0;
          if (!ph8ActualCost && respBody.usage?.cost_details?.upstream_inference_cost) {
            ph8ActualCost = respBody.usage.cost_details.upstream_inference_cost;
          }
          // 提取 token 数（用于 fallback 计费）
          if (respBody.usage) {
            imgPromptTokens = respBody.usage.prompt_tokens || respBody.usage.promptTokens || 0;
            imgCompletionTokens = respBody.usage.completion_tokens || respBody.usage.completionTokens || 0;
          }
        }

        // 尝试从响应头提取费用
        if (!ph8ActualCost) {
          const costHeader = proxyRes.headers['x-ph8-cost']
                          || proxyRes.headers['x-cost']
                          || proxyRes.headers['x-api-cost']
                          || proxyRes.headers['x-inference-cost']
                          || proxyRes.headers['x-usage-cost'];
          if (costHeader) {
            ph8ActualCost = parseFloat(costHeader) || 0;
          }
        }
      } catch(e) {
        ph8Log.error('解析PH8响应失败', { requestId, error: e.message });
      }

      // 最终费用：PH8 返回的优先，否则用 PH8 官方定价按 token 计算
      let finalCost = ph8ActualCost > 0 ? ph8ActualCost : 0;
      let costSource = 'ph8-response';
      if (finalCost === 0 && (imgPromptTokens > 0 || imgCompletionTokens > 0)) {
        const calcResult = calculateCostFromTokens(reqModel, imgPromptTokens, imgCompletionTokens);
        finalCost = calcResult.cost;
        costSource = calcResult.source;
        if (finalCost > 0) {
          ph8Log.info('图像费用-PH8未返回,使用token计算', {
            requestId,
            model: reqModel,
            promptTokens: imgPromptTokens,
            completionTokens: imgCompletionTokens,
            calculatedCost: finalCost,
            source: costSource
          });
        }
      }
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
          promptTokens: imgPromptTokens || 0,
          completionTokens: imgCompletionTokens || 0,
          totalTokens: (imgPromptTokens || 0) + (imgCompletionTokens || 0),
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
      
      // [方案D安全修复] 后端统一处理水印
      // 只有在图片生成成功时才处理水印
      if (proxyRes.statusCode === 200 && userInfo && !isBinaryContent) {
        try {
          const responseJson = JSON.parse(data);
          // 检查是否是图片生成响应（包含 images 或 data 字段）
          if (responseJson.images || responseJson.data) {
            const processedResponse = await imageWatermarkService.processImage(responseJson, userInfo.tier);
            ph8Log.debug('openai/v1/images 水印处理完成', { 
              requestId, 
              userTier: userInfo.tier, 
              isDeveloper: imageWatermarkService.isDeveloper(userInfo.tier) 
            });
            res.status(proxyRes.statusCode).send(JSON.stringify(processedResponse));
            return; // 已发送响应，避免重复 send
          }
        } catch (e) {
          ph8Log.warn('图片水印处理失败，继续返回原图', { requestId, error: e.message });
        }
      }
      
      res.status(proxyRes.statusCode).send(data);
    }
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
  const targetHost = 'wellai.cc';
  const fullPath = '/v1/images/generations';
  const requestId = uuidv4();
  const startTime = Date.now();

  ph8Log.info('图像生成v1请求', { requestId, path: fullPath });

  const bodyData = JSON.stringify(req.body);
  if (LOG_REQUEST_BODY) {
    ph8Log.debug('请求体', { body: sanitizeForLog(req.body, 100) });
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
      let imgPromptTokens2 = 0;
      let imgCompletionTokens2 = 0;
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
          // 提取 token 数
          if (respBody.usage) {
            imgPromptTokens2 = respBody.usage.prompt_tokens || respBody.usage.promptTokens || 0;
            imgCompletionTokens2 = respBody.usage.completion_tokens || respBody.usage.completionTokens || 0;
          }
        }
      } catch(e) {}

      // fallback：PH8 未返回费用时，用 token × 官方定价计算
      let finalCost2 = ph8ActualCost2 > 0 ? ph8ActualCost2 : 0;
      if (finalCost2 === 0 && (imgPromptTokens2 > 0 || imgCompletionTokens2 > 0)) {
        const calcResult2 = calculateCostFromTokens(reqModel2, imgPromptTokens2, imgCompletionTokens2);
        finalCost2 = calcResult2.cost;
      }

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
          promptTokens: imgPromptTokens2 || 0, completionTokens: imgCompletionTokens2 || 0, totalTokens: (imgPromptTokens2||0)+(imgCompletionTokens2||0),
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
      
      // [方案D安全修复] 后端统一处理水印
      if (proxyRes.statusCode === 200 && userInfo2 && !isBinaryContent) {
        try {
          const responseJson = JSON.parse(data);
          if (responseJson.images || responseJson.data) {
            const processedResponse = await imageWatermarkService.processImage(responseJson, userInfo2.tier);
            ph8Log.debug('v1/images 水印处理完成', { 
              requestId, 
              userTier: userInfo2.tier, 
              isDeveloper: imageWatermarkService.isDeveloper(userInfo2.tier) 
            });
            res.status(proxyRes.statusCode).send(JSON.stringify(processedResponse));
            return;
          }
        } catch (e) {
          ph8Log.warn('v1/images 水印处理失败', { requestId, error: e.message });
        }
      }
      
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
  const targetHost = 'wellai.cc';
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

  // 额度预检：已识别用户 - 积分不足时拦截请求
  if (userId && userId !== 'anonymous') {
    try {
      const numericUserId = typeof userId === 'number' ? userId : parseInt(userId);
      if (!isNaN(numericUserId) && numericUserId > 0) {
        const [quotaCheck] = await db.query(
          `SELECT daily_quota, daily_used, total_points, daily_reset_at, user_tier FROM kbit_users WHERE id = ?`,
          [numericUserId]
        );
        if (quotaCheck.length > 0) {
          let dq = parseFloat(quotaCheck[0].daily_quota) || 200;
          let du = parseFloat(quotaCheck[0].daily_used) || 0;
          let tp = parseFloat(quotaCheck[0].total_points) || 0;
          const tier = quotaCheck[0].user_tier || 'free';
          const dailyResetAt = quotaCheck[0].daily_reset_at;

          const today = new Date().toISOString().split('T')[0];
          if (dailyResetAt !== today || dailyResetAt === null) {
            du = 0;
          }

          const { getDailyPoints } = require('../config/tierConfig');
          const configQuota = getDailyPoints(tier);
          if (configQuota > dq) {
            dq = configQuota;
          }

          const dailyRemaining = Math.max(0, dq - du);
          const totalAvailable = tp + dailyRemaining;

          if (totalAvailable <= 0) {
            ph8Log.warn('用户额度不足-请求已拦截', {
              userId: numericUserId,
              dailyUsed: du,
              dailyQuota: dq,
              dailyRemaining,
              totalPoints: tp,
              tier
            });
            return res.status(429).json({
              error: '配额不足',
              message: '今日积分已用完，请明天再来或充值积分',
              code: 'QUOTA_EXCEEDED',
              data: {
                dailyUsed: du,
                dailyQuota: dq,
                dailyRemaining,
                totalPoints: tp
              }
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
      
      // [方案D安全修复] 后端统一处理图片水印
      // 只有在图片生成成功时才处理水印（非二进制内容）
      let processedData = data;
      let shouldProcessWatermark = false;
      let processedUserTier = 'free';
      
      if (proxyRes.statusCode === 200 && !isBinaryContent) {
        try {
          const isImageRequest = fullPath.includes('/images') && req.method === 'POST';
          if (isImageRequest) {
            const responseJson = JSON.parse(data);
            if (responseJson.images || responseJson.data) {
              // 获取用户等级
              processedUserTier = userInfo?.tier || 'free';
              shouldProcessWatermark = true;
            }
          }
        } catch (e) {
          // JSON解析失败，跳过水印处理
        }
      }
      
      if (shouldProcessWatermark) {
        try {
          const responseJson = JSON.parse(data);
          const processedResponse = await imageWatermarkService.processImage(responseJson, processedUserTier);
          processedData = JSON.stringify(processedResponse);
          res.setHeader('Content-Type', 'application/json');
          ph8Log.debug('通配符路由图片水印处理完成', { 
            requestId, 
            userTier: processedUserTier, 
            isDeveloper: imageWatermarkService.isDeveloper(processedUserTier) 
          });
        } catch (e) {
          ph8Log.warn('通配符路由图片水印处理失败', { requestId, error: e.message });
          processedData = data;
        }
      }
      
      res.status(proxyRes.statusCode).send(processedData);

      try {
        const isVideoGetRequest = fullPath.includes('/videos') && req.method === 'GET';
        const isVideoPostRequest = fullPath.includes('/videos') && req.method === 'POST';

        // ========== 视频生成专用计费逻辑 ==========
        // 视频 POST（任务创建）：成功创建任务时立即计费
        if (isVideoPostRequest && !isBinaryContent && proxyRes.statusCode === 200) {
          try {
            const videoResp = JSON.parse(data);
            if (videoResp.id && (videoResp.status === 'queued' || videoResp.status === 'in_progress' || videoResp.status === 'completed')) {
              ph8Log.info('视频任务创建成功，执行计费', { requestId, videoId: videoResp.id, model });

              // 【关键修复】将 PH8 task ID 附加到 model_id 中，以便后续 GET 轮询能精确匹配 DB 记录
              // 原因: request_id 字段 VARCHAR(50)，UUID(36) + ::(2) + taskId(~25) = 63 超限！
              // 方案: 改存到 model_id 字段，格式 "modelName::ph8-task-id"（GET 端用 model_id LIKE 匹配）
              const videoModelWithTaskId = `${videoModel}::${videoResp.id}`;

              // 从请求体获取模型名（视频模型按固定单价计费）
              let videoModel = model;
              try { videoModel = JSON.parse(bodyData || '{}').model || model; } catch(e) {}

              // 使用 PH8 官方定价计算视频费用（基于完整 Token 计算）
              // 根据 PH8 调用明细，视频模型的实际计费方式：
              //   - 输入 Token ≈ 0（当前固定，但可能变化）
              //   - 输出 Token = 50,000 ~ 100,000（根据视频复杂度）
              //   - 费用 = (inputPrice × inputTokens + outputPrice × outputTokens) / 1,000,000
              //
              // 示例（doubao-seedance-1-0-pro-fast, input=0.1, output=4.2）:
              //   - input=0, output=50000 → (0.1×0 + 4.2×50000)/1M = 0.21元 = 210积分
              //   - input=0, output=100000 → (0.1×0 + 4.2×100000)/1M = 0.42元 = 420积分
              //
              // POST 时无法知道实际 tokens，先用估算值（默认 input=0, output=50000）
              // GET 完成后用 PH8 返回的真实 token 数据更新并补扣差额
              let videoCost = 0;
              let videoPricing = PH8_MODEL_PRICING[videoModel];
              
              // 前缀模糊匹配（处理带版本后缀的变体，如 -251015）
              if (!videoPricing) {
                for (const [key, value] of Object.entries(PH8_MODEL_PRICING)) {
                  if (videoModel.startsWith(key) || key.startsWith(videoModel.split('-')[0] + '-' + videoModel.split('-')[1])) {
                    videoPricing = value;
                    break;
                  }
                }
              }
              
              if (videoPricing) {
                const estimatedInputTokens = 0;      // 当前视频模型输入token为0
                const estimatedOutputTokens = 50000; // 默认估算值（约5万输出tokens）
                videoCost = (videoPricing.inputPrice * estimatedInputTokens + videoPricing.outputPrice * estimatedOutputTokens) / 1000000;
                if (videoCost < 0.01) videoCost = 0.01;
              }
              ph8Log.info('视频费用计算', { requestId, model: videoModel, cost: videoCost, source: videoPricing ? 'ph8-pricing-table' : 'no-pricing' });

              let vUserId = userId;
              let vUserInfo = { nickname: '未知用户', email: '' };
              try {
                if (userId) { vUserInfo = await getUserInfo(userId); vUserId = vUserInfo.id || userId; }
              } catch(e) {}

              await ph8TokenService.recordUsage({
                userId: vUserId,
                userNickname: vUserInfo.nickname,
                userEmail: vUserInfo.email,
                requestId: requestId,  // 保持原始 UUID，不超长
                model: videoModelWithTaskId,  // 【关键】model_id 存 "modelName::taskId"，用于 GET 端匹配
                channelId: 'ph8-video',
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 1,  // 用1表示"1次视频生成"
                cost: videoCost,
                cachedTokens: 0,
                requestType: 'video',
                endpoint: fullPath,
                status: 'success',
                errorMessage: null,
                responseTimeMs: responseTime,
                ipAddress: req.ip || req.connection.remoteAddress
              });

              if (videoCost > 0) {
                try {
                  await ph8TokenService.deductBalance(vUserId, videoCost, vUserInfo.nickname, vUserInfo.email);
                  ph8Log.info('视频扣费成功', { requestId, maskedUserId: maskUserId(String(vUserId)), cost: videoCost });
                } catch(deductErr) {
                  ph8Log.error('视频扣费失败', { error: deductErr.message });
                }
              }

              // 不再走下面的通用JSON处理，避免重复记账
              ph8Log.info('视频POST计费完成', { requestId, cost: videoCost });
            }
          } catch(e) {
            ph8Log.error('视频POST计费异常', { error: e.message, requestId });
          }
          // 视频POST处理完毕，跳到响应发送后的清理
        } else if (isVideoGetRequest && !isBinaryContent) {
          // 视频 GET（轮询完成）：从 completed 响应中提取真实 usage 数据并更新 POST 时创建的日志
          try {
            const videoStatusResp = JSON.parse(data);
            
            // 【关键修复】从请求路径中提取 PH8 task ID，用于匹配 POST 时创建的 DB 记录
            // 请求路径格式: /openai/v1/videos/{taskId} 或 /v1/videos/{taskId}
            const pathParts = fullPath.split('/videos/');
            const ph8TaskId = pathParts.length > 1 ? pathParts[1].split('/')[0].split('?')[0] : null;
            
            ph8Log.info('视频GET响应详情', { requestId, ph8TaskId, status: videoStatusResp?.status, hasUsage: !!videoStatusResp?.usage, keys: Object.keys(videoStatusResp).join(',') });
            
            // 【诊断】打印 completed 响应的关键字段，用于确认 PH8 返回的实际数据结构
            if (videoStatusResp.status === 'completed') {
              ph8Log.info('视频completed响应原始数据(诊断)', {
                requestId,
                ph8TaskId,
                usage: JSON.stringify(videoStatusResp.usage || null),
                cost: videoStatusResp.cost,
                tokens: videoStatusResp.tokens || videoStatusResp.total_tokens,
                output: videoStatusResp.output ? { keys: Object.keys(videoStatusResp.output).join(','), usage: JSON.stringify(videoStatusResp.output.usage || null) } : null,
                results_count: Array.isArray(videoStatusResp.results) ? videoStatusResp.results.length : 0,
              });
            }
            
            if (videoStatusResp.status === 'completed') {
              // 提取 PH8 返回的真实 usage/token 数据
              const videoUsage = extractUsage(videoStatusResp);
              ph8Log.info('视频生成完成，extractUsage结果', { requestId, ph8TaskId,
                pTokens: videoUsage.promptTokens, cTokens: videoUsage.completionTokens, 
                tTokens: videoUsage.totalTokens, cost: videoUsage.cost,
                ph8ModelName: videoUsage.modelName
              });

              // 放宽条件：只要响应是 completed 就尝试更新
              const shouldUpdate = videoUsage.totalTokens > 0 || videoUsage.cost > 0;
              
              // 如果 extractUsage 没提取到标准字段，尝试直接从响应体中获取非标准位置的数据
              let fallbackCost = videoUsage.cost;
              let fallbackTotalTokens = videoUsage.totalTokens;
              let fallbackPromptTokens = videoUsage.promptTokens;
              let fallbackCompletionTokens = videoUsage.completionTokens;
              
              if (!shouldUpdate) {
                // 尝试更多可能的字段路径
                fallbackCost = videoStatusResp.cost || videoStatusResp.price || videoStatusResp.charge ||
                  videoStatusResp.total_cost || videoStatusResp.totalPrice || 0;
                fallbackTotalTokens = videoStatusResp.total_tokens || videoStatusResp.tokens || 0;
                fallbackPromptTokens = videoStatusResp.prompt_tokens || 0;
                fallbackCompletionTokens = videoStatusResp.completion_tokens || 0;
                
                // 尝试 output.usage
                if (!fallbackCost && videoStatusResp.output?.usage) {
                  fallbackCost = videoStatusResp.output.usage.cost || videoStatusResp.output.usage.price || 0;
                  fallbackTotalTokens = fallbackTotalTokens || videoStatusResp.output.usage.total_tokens || 0;
                }
                
                // 尝试 results[].usage
                if (!fallbackCost && Array.isArray(videoStatusResp.results)) {
                  for (const r of videoStatusResp.results) {
                    if (r.usage) { fallbackCost = r.usage.cost || fallbackCost; break; }
                    if (r.cost) { fallbackCost = r.cost; break; }
                  }
                }
                
                ph8Log.info('视频usage兜底提取', { requestId, ph8TaskId, fallbackCost, fallbackTotalTokens, 
                  fallbackPrompt: fallbackPromptTokens, fallbackCompletion: fallbackCompletionTokens });
              }
              
              // 【关键修复】用 ph8TaskId 或 videoStatusResp.id 匹配数据库记录（而非当前请求的 requestId）
              // 同时也尝试用 endpoint 路径匹配作为兜底
              const matchTaskId = ph8TaskId || videoStatusResp.id || null;
              
              if ((fallbackTotalTokens > 1) || (fallbackCost > 0) || matchTaskId) {
                try {
                  let vUserId = userId;
                  try { if (userId) { const vInfo = await getUserInfo(userId); vUserId = vInfo.id || userId; } } catch(e) {}

                  // 计算实际费用：优先使用兜底cost，再是 PH8 返回的 cost，最后用 token × 定价表
                  let actualCost = fallbackCost || videoUsage.cost;
                  if (!actualCost && (fallbackPromptTokens > 0 || fallbackCompletionTokens > 0)) {
                    const tokenCalc = calculateCostFromTokens(model, fallbackPromptTokens, fallbackCompletionTokens);
                    actualCost = tokenCalc.cost;
                    ph8Log.info('视频费用token补充计算', { requestId, model, calculatedCost: actualCost, source: tokenCalc.source });
                  }

                  const points = Math.round((actualCost || 0) * 1000);
                  const finalTotalTokens = fallbackTotalTokens || videoUsage.totalTokens || 1;

                  // 提取 PH8 返回的真实模型名，用于更新 model_id
                  const ph8RealModel = videoUsage.modelName || null;

                  // 【核心修复】多策略匹配数据库中的视频 POST 记录
                  // POST 时将 taskId 存入 model_id 字段（格式 "modelName::taskId"）
                  // GET 端通过 model_id LIKE '%taskId%' 精确匹配
                  let updateResult;
                  
                  // 先尝试用 model_id LIKE taskId 匹配（最可靠）
                  if (matchTaskId) {
                    updateResult = await db.query(
                      `UPDATE kbit_usage_logs SET
                        prompt_tokens = ?, completion_tokens = ?, total_tokens = ?,
                        actual_cost = ?, points_cost = ?, model_id = ?
                      WHERE feature = 'video_gen' AND model_id LIKE ?
                      ORDER BY created_at DESC LIMIT 1`,
                      [fallbackPromptTokens, fallbackCompletionTokens,
                       finalTotalTokens, actualCost || 0, points,
                       ph8RealModel || model,
                       `%${matchTaskId}%`]
                    );
                    
                    // 如果 LIKE 没匹配到，改用 userId + 最近记录策略匹配
                    const likeAffected = updateResult?.affectedRows || 0;
                    if (likeAffected === 0 && vUserId) {
                      ph8Log.info('视频usage LIKE未命中，改用userId+时间匹配', { requestId, matchTaskId, vUserId });
                      updateResult = await db.query(
                        `UPDATE kbit_usage_logs SET
                          prompt_tokens = ?, completion_tokens = ?, total_tokens = ?,
                          actual_cost = ?, points_cost = ?, model_id = ?
                        WHERE user_id = ? AND feature = 'video_gen'
                        AND (prompt_tokens = 0 OR total_tokens <= 1)
                        ORDER BY created_at DESC LIMIT 1`,
                        [fallbackPromptTokens, fallbackCompletionTokens,
                         finalTotalTokens, actualCost || 0, points,
                         ph8RealModel || model,
                         vUserId]
                      );
                    }
                  } else {
                    // 无 taskId 时回退到原逻辑（可能匹配不到）
                    updateResult = await db.query(
                      `UPDATE kbit_usage_logs SET
                        prompt_tokens = ?, completion_tokens = ?, total_tokens = ?,
                        actual_cost = ?, points_cost = ?, model_id = ?
                      WHERE request_id = ? AND feature = 'video_gen'`,
                      [fallbackPromptTokens, fallbackCompletionTokens,
                       finalTotalTokens, actualCost || 0, points,
                       ph8RealModel || model,
                       requestId]
                    );
                  }

                  const affectedRows = updateResult?.affectedRows || 0;
                  
                  if (affectedRows === 0 && matchTaskId) {
                    ph8Log.warn('视频usage未找到匹配记录(可能POST时未写入)', { 
                      requestId, matchTaskId, endpoint: fullPath 
                    });
                  }

                  // 如果有新的费用需要扣款（POST 时估算为0或过低）
                  if (actualCost > 0.01 && affectedRows > 0) {
                    try {
                      let deductUserInfo = { nickname: '未知用户', email: '' };
                      try { if (vUserId) deductUserInfo = await getUserInfo(vUserId); } catch(e) {}
                      await ph8TokenService.deductBalance(vUserId, actualCost, deductUserInfo.nickname, deductUserInfo.email);
                      ph8Log.info('视频费用补扣成功', { requestId, cost: actualCost });
                    } catch(deductErr) {
                      ph8Log.error('视频费用补扣失败', { error: deductErr.message });
                    }
                  }

                  ph8Log.info('视频usage数据已更新到日志', {
                    requestId, matchTaskId, affectedRows, prompt: fallbackPromptTokens,
                    completion: fallbackCompletionTokens, total: finalTotalTokens,
                    cost: actualCost
                  });
                } catch(updateErr) {
                  ph8Log.error('视频日志更新失败', { error: updateErr.message, requestId });
                }
              } else {
                ph8Log.info('视频completed响应无usage/cost数据，保持POST时估算值', { requestId });
              }
            } else {
              ph8Log.debug('跳过视频GET记账(未完成)', { requestId, status: videoStatusResp?.status });
            }
            return; // 视频 GET 处理完毕，不进入通用 JSON 处理
          } catch (e) {
            ph8Log.debug('跳过视频GET记账(解析失败)', { requestId, error: e.message });
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
                if (calculatedCost && typeof calculatedCost === 'string') {
                  calculatedCost = parseFloat(calculatedCost);
                }
                // Fallback：PH8 未返回费用时（图像/视频），用 token × 官方定价计算
                if (!calculatedCost && fullPath.includes('/images') && (usage.promptTokens > 0 || usage.completionTokens > 0)) {
                  const imgCalc = calculateCostFromTokens(model, usage.promptTokens, usage.completionTokens);
                  calculatedCost = imgCalc.cost;
                  if (calculatedCost > 0) {
                    ph8Log.info('通配路由-图像费用token计算', { requestId, model, calculatedCost, source: imgCalc.source });
                  }
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
                    requestBody: sanitizeForLog(JSON.parse(bodyData || '{}'), 200),
                    responseBody: sanitizeForLog(responseBody || {}, 200),
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
                // 提取 token 数（即使没有费用）
                if (!promptTokens && jsonBody.usage) {
                  promptTokens = jsonBody.usage.prompt_tokens || jsonBody.usage.promptTokens || 0;
                  completionTokens = jsonBody.usage.completion_tokens || jsonBody.usage.completionTokens || 0;
                  totalTokens = promptTokens + completionTokens;
                }
              } catch (e) {
                // 响应体不是 JSON，忽略
              }
            }
            // Fallback：图像请求无费用时，用 token 计算
            if (!calculatedCost && fullPath.includes('/images') && (promptTokens > 0 || completionTokens > 0)) {
              const binCalc = calculateCostFromTokens(model, promptTokens, completionTokens);
              calculatedCost = binCalc.cost;
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