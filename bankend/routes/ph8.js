const express = require('express');
const router = express.Router();
const https = require('https');
const ph8TokenService = require('../services/ph8TokenService');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// PH8 API Key - 从环境变量获取
const PH8_API_KEY = process.env.PH8_API_KEY || 'sk-2f6ff8aba4d541d591d17e8eae60e75c';

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
        cachedTokens: responseBody.usage.cached_tokens || 0
      };
    }
    
    // 其他格式适配
    if (responseBody.prompt_tokens !== undefined) {
      return {
        promptTokens: responseBody.prompt_tokens || 0,
        completionTokens: responseBody.completion_tokens || 0,
        totalTokens: responseBody.total_tokens || 0,
        cachedTokens: responseBody.cached_tokens || 0
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
function getUserId(req) {
  // 优先从请求头获取
  const userId = req.headers['x-user-id'] || req.headers['x-user-email'];
  if (userId) return userId;

  // 从请求体中获取
  if (req.body && req.body.user_id) {
    return req.body.user_id;
  }

  // 默认返回 guest
  return 'guest';
}

/**
 * 获取用户信息（昵称和邮箱）
 * @param {string} userId - 用户ID
 * @returns {Promise<{nickname: string, email: string}>} - 用户信息
 */
async function getUserInfo(userId) {
  try {
    // 从 users 表查询用户信息
    const [rows] = await db.query(
      'SELECT nickname, email FROM `kbit_users` WHERE user_id = ? OR email = ?',
      [userId, userId]
    );

    if (rows.length > 0) {
      return {
        nickname: rows[0].nickname || '未知用户',
        email: rows[0].email || userId
      };
    }

    // 如果没找到，返回默认值
    return {
      nickname: '未知用户',
      email: userId
    };
  } catch (err) {
    console.error('[PH8 Proxy] 获取用户信息失败:', err);
    return {
      nickname: '未知用户',
      email: userId
    };
  }
}

router.all('/*', async (req, res) => {
  const targetHost = 'ph8.co';
  const targetPath = req.params[0] || '';
  let fullPath;
  
  // 处理 openai/v1 路径
  if (targetPath.startsWith('openai/v1/')) {
    fullPath = '/' + targetPath;
  } else {
    fullPath = '/v1/' + targetPath;
  }
  
  const requestId = uuidv4();
  const startTime = Date.now();
  
  console.log('[PH8 Proxy] ' + req.method + ' ' + fullPath + ' [ID: ' + requestId + ']');
  
  const bodyData = req.body ? JSON.stringify(req.body) : '';
  const userId = getUserId(req);
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
      
      // 设置响应头
      res.setHeader('Content-Type', contentType || 'application/json');
      res.status(proxyRes.statusCode).send(data);
      
      // 异步记录 Token 使用（不阻塞响应）
      try {
        const responseBody = JSON.parse(data);
        const usage = extractUsage(responseBody);
        
        // 获取用户信息
        let userInfo = { nickname: '未知用户', email: userId };
        try {
          userInfo = await getUserInfo(userId);
        } catch (err) {
          console.error('[PH8 Proxy] 获取用户信息失败:', err);
        }

        if (usage) {
          // 记录到数据库
          try {
            await ph8TokenService.recordUsage({
              userId: userId,
              userNickname: userInfo.nickname,
              userEmail: userInfo.email,
              requestId: responseBody.id || requestId,
              model: model,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
              cachedTokens: usage.cachedTokens,
              requestType: requestType,
              endpoint: fullPath,
              status: proxyRes.statusCode === 200 ? 'success' : 'error',
              errorMessage: responseBody.error?.message || null,
              responseTimeMs: responseTime,
              ipAddress: req.ip || req.connection.remoteAddress
            });

            // 更新用户余额（传递昵称和邮箱）
            await ph8TokenService.deductBalance(userId, usage.totalTokens, userInfo.nickname, userInfo.email);

            console.log(`[PH8 Proxy] Token记录成功: user=${userId}(${userInfo.nickname}), tokens=${usage.totalTokens}, type=${requestType}`);
          } catch (err) {
            console.error('[PH8 Proxy] 记录 Token 使用失败:', err);
          }
        } else {
          console.log('[PH8 Proxy] 响应中未找到 usage 数据');
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
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      requestType: requestType,
      endpoint: fullPath,
      status: 'error',
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