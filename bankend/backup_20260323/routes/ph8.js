const express = require('express');
const router = express.Router();
const https = require('https');
const ph8TokenService = require('../services/ph8TokenService');
const { v4: uuidv4 } = require('uuid');

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

router.all('/*', async (req, res) => {
  const targetHost = 'ph8.co';
  const targetPath = req.params[0] || '';
  const fullPath = '/v1/' + targetPath;
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
    let data = '';
    proxyRes.on('data', (chunk) => { data += chunk; });
    proxyRes.on('end', async () => {
      const responseTime = Date.now() - startTime;
      
      // 设置响应头
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
      res.status(proxyRes.statusCode).send(data);
      
      // 异步记录 Token 使用（不阻塞响应）
      try {
        const responseBody = JSON.parse(data);
        const usage = extractUsage(responseBody);
        
        if (usage) {
          // 记录到数据库
          await ph8TokenService.recordUsage({
            userId: userId,
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
          
          // 更新用户余额
          await ph8TokenService.deductBalance(userId, usage.totalTokens);
          
          console.log(`[PH8 Proxy] Token记录成功: user=${userId}, tokens=${usage.totalTokens}, type=${requestType}`);
        } else {
          console.log('[PH8 Proxy] 响应中未找到 usage 数据');
        }
        
        // 记录 API 调用日志（可选，用于调试）
        // await ph8TokenService.logApiCall({
        //   userId: userId,
        //   endpoint: fullPath,
        //   requestBody: bodyData.substring(0, 1000), // 限制长度
        //   responseBody: data.substring(0, 1000),
        //   statusCode: proxyRes.statusCode
        // });
        
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
      requestId: requestId,
      model: model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
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
      requestId: requestId,
      model: model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
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