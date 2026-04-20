/**
 * 通用网关代理路由
 * 支持多网关配置，动态路由到不同的第三方 API 服务
 * 配置从环境变量读取，避免 API Key 泄露
 * 
 * 安全说明：所有 API Key 都在服务器端管理，前端完全不接触
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');

// 网关配置（从环境变量读取，避免硬编码）
const GATEWAY_CONFIG = {
  ph8: {
    name: 'PH8.co',
    url: process.env.PH8_GATEWAY_URL || 'https://ph8.co',
    api_key: process.env.PH8_API_KEY,
    enabled: process.env.PH8_ENABLED !== 'false',
    proxy_path: '/v1'
  },
  gemini: {
    name: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com',
    api_key: process.env.GEMINI_API_KEY,
    enabled: !!process.env.GEMINI_API_KEY,
    proxy_path: '/v1beta'
  }
};

/**
 * 获取网关配置
 * @param {string} gatewayKey - 网关标识（如 'ph8'）
 * @returns {Object|null} - 网关配置
 */
function getGatewayConfig(gatewayKey) {
  return GATEWAY_CONFIG[gatewayKey] || null;
}

/**
 * 验证网关是否启用
 * @param {string} gatewayKey - 网关标识
 * @returns {boolean} - 是否启用
 */
function isGatewayEnabled(gatewayKey) {
  const config = getGatewayConfig(gatewayKey);
  return config && config.enabled !== false;
}

/**
 * 获取网关 API Key
 * @param {string} gatewayKey - 网关标识
 * @returns {string|null} - API Key
 */
function getGatewayApiKey(gatewayKey) {
  const config = getGatewayConfig(gatewayKey);
  return config?.api_key || null;
}

/**
 * 获取网关基础 URL
 * @param {string} gatewayKey - 网关标识
 * @returns {string|null} - 基础 URL
 */
function getGatewayUrl(gatewayKey) {
  const config = getGatewayConfig(gatewayKey);
  return config?.url || null;
}

/**
 * 从请求路径中提取网关标识
 * @param {string} path - 请求路径
 * @returns {string|null} - 网关标识
 */
function extractGatewayKey(path) {
  // 从路径中提取网关标识，如 /api/gateway/ph8/chat/completions -> ph8
  const match = path.match(/^\/gateway\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * 通用的网关代理处理函数
 */
async function handleGatewayProxy(req, res, gatewayKey, targetPath) {
  if (!isGatewayEnabled(gatewayKey)) {
    return res.status(503).json({ error: '网关未启用' });
  }

  const gatewayUrl = getGatewayUrl(gatewayKey);
  const apiKey = getGatewayApiKey(gatewayKey);

  if (!gatewayUrl || !apiKey) {
    return res.status(500).json({ error: '网关配置错误，请检查环境变量' });
  }

  const targetUrl = `${gatewayUrl}${targetPath}`;
  const requestId = req.headers['x-request-id'] || require('uuid').v4();

  console.log(`[Gateway ${gatewayKey}] ${req.method} ${targetPath} [ID: ${requestId}]`);

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...req.headers,
        'host': new URL(gatewayUrl).host
      },
      data: req.body,
      responseType: 'stream',
      timeout: 300000
    });

    // 转发响应头
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);
    response.data.pipe(res);

  } catch (error) {
    console.error(`[Gateway ${gatewayKey}] 代理错误:`, error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: '网关代理失败' });
    }
  }
}

// ==================== 动态路由 ====================

// 处理所有 /api/gateway/:gatewayKey/* 请求
router.all('/:gatewayKey/*', async (req, res) => {
  const gatewayKey = req.params.gatewayKey;
  const targetPath = '/' + req.params[0];

  await handleGatewayProxy(req, res, gatewayKey, targetPath);
});

// 处理 /api/gateway/:gatewayKey 根路径
router.all('/:gatewayKey', async (req, res) => {
  const gatewayKey = req.params.gatewayKey;
  await handleGatewayProxy(req, res, gatewayKey, '/');
});

// ==================== 网关管理 API ====================

// 获取所有网关状态
router.get('/admin/gateways', async (req, res) => {
  try {
    const gatewayList = Object.entries(GATEWAY_CONFIG).map(([key, config]) => ({
      key,
      name: config.name,
      url: config.url,
      enabled: config.enabled !== false,
      hasApiKey: !!config.api_key
    }));

    res.json({ success: true, gateways: gatewayList });
  } catch (err) {
    console.error('[Gateway Admin] 获取网关列表失败:', err);
    res.status(500).json({ error: '获取网关列表失败' });
  }
});

// 获取指定网关详情
router.get('/admin/gateways/:gatewayKey', async (req, res) => {
  try {
    const { gatewayKey } = req.params;
    const config = getGatewayConfig(gatewayKey);

    if (!config) {
      return res.status(404).json({ error: '网关不存在' });
    }

    res.json({
      success: true,
      gateway: {
        key: gatewayKey,
        name: config.name,
        url: config.url,
        enabled: config.enabled !== false,
        proxy_path: config.proxy_path
      }
    });
  } catch (err) {
    console.error('[Gateway Admin] 获取网关详情失败:', err);
    res.status(500).json({ error: '获取网关详情失败' });
  }
});

module.exports = router;
module.exports.getGatewayConfig = getGatewayConfig;
module.exports.isGatewayEnabled = isGatewayEnabled;
module.exports.getGatewayApiKey = getGatewayApiKey;
module.exports.getGatewayUrl = getGatewayUrl;
