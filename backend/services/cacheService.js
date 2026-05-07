const redis = require('redis');

// 引入结构化日志服务
const { logger, LogLevel } = require('./loggerService');

// 日志级别配置
const isProduction = process.env.NODE_ENV === 'production';
const CACHE_LOG_LEVEL = isProduction
  ? (LogLevel[process.env.CACHE_LOG_LEVEL?.toUpperCase()] || LogLevel.WARN)
  : LogLevel.INFO;

// Redis 客户端配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('[Cache] Redis连接被拒绝', { error: options.error.message });
      return new Error('Redis server connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
};

// 统一日志函数
const cacheLog = {
  debug: (message, data) => {
    if (CACHE_LOG_LEVEL <= LogLevel.DEBUG) {
      logger.debug(`[Cache] ${message}`, data);
    }
  },
  info: (message, data) => {
    if (CACHE_LOG_LEVEL <= LogLevel.INFO) {
      logger.info(`[Cache] ${message}`, data);
    }
  },
  warn: (message, data) => {
    if (CACHE_LOG_LEVEL <= LogLevel.WARN) {
      logger.warn(`[Cache] ${message}`, data);
    }
  },
  error: (message, data) => {
    if (CACHE_LOG_LEVEL <= LogLevel.ERROR) {
      logger.error(`[Cache] ${message}`, data);
    }
  }
};

// 创建 Redis 客户端
let client = null;
let isConnected = false;

// 初始化 Redis 连接
const initRedis = async () => {
  try {
    client = redis.createClient(redisConfig);

    client.on('error', (err) => {
      cacheLog.error('Redis错误', { error: err.message });
      isConnected = false;
    });

    client.on('connect', () => {
      cacheLog.info('Redis已连接');
      isConnected = true;
    });

    client.on('reconnecting', () => {
      cacheLog.warn('Redis重新连接中');
    });

    await client.connect();
    return true;
  } catch (error) {
    cacheLog.error('连接Redis失败', { error: error.message });
    isConnected = false;
    return false;
  }
};

// 获取缓存
const get = async (key) => {
  if (!isConnected || !client) {
    return null;
  }

  try {
    const value = await client.get(key);
    if (value) {
      cacheLog.debug('缓存命中', { key });
      return JSON.parse(value);
    }
    cacheLog.debug('缓存未命中', { key });
    return null;
  } catch (error) {
    cacheLog.error('获取缓存失败', { key, error: error.message });
    return null;
  }
};

// 设置缓存
const set = async (key, value, expireSeconds = 3600) => {
  if (!isConnected || !client) {
    return false;
  }

  try {
    await client.setEx(key, expireSeconds, JSON.stringify(value));
    cacheLog.debug('设置缓存', { key, ttl: expireSeconds });
    return true;
  } catch (error) {
    cacheLog.error('设置缓存失败', { key, error: error.message });
    return false;
  }
};

// 删除缓存
const del = async (key) => {
  if (!isConnected || !client) {
    return false;
  }

  try {
    await client.del(key);
    cacheLog.debug('删除缓存', { key });
    return true;
  } catch (error) {
    cacheLog.error('删除缓存失败', { key, error: error.message });
    return false;
  }
};

// 批量删除缓存（支持通配符）
const delPattern = async (pattern) => {
  if (!isConnected || !client) {
    return false;
  }

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
      cacheLog.info('批量删除缓存', { pattern, count: keys.length });
    }
    return true;
  } catch (error) {
    cacheLog.error('批量删除缓存失败', { pattern, error: error.message });
    return false;
  }
};

// 获取或设置缓存（Cache-Aside模式）
const getOrSet = async (key, factory, expireSeconds = 3600) => {
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }

  try {
    const data = await factory();
    if (data !== null && data !== undefined) {
      await set(key, data, expireSeconds);
    }
    return data;
  } catch (error) {
    cacheLog.error('Factory执行失败', { key, error: error.message });
    throw error;
  }
};

// 清空所有缓存
const flush = async () => {
  if (!isConnected || !client) {
    return false;
  }

  try {
    await client.flushDb();
    cacheLog.info('清空所有缓存');
    return true;
  } catch (error) {
    cacheLog.error('清空缓存失败', { error: error.message });
    return false;
  }
};

// 获取缓存统计
const getStats = async () => {
  if (!isConnected || !client) {
    return {
      connected: false,
      keys: 0,
    };
  }

  try {
    const info = await client.info('memory');
    const keys = await client.dbSize();

    return {
      connected: true,
      keys,
      info: info.split('\r\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          acc[key] = value;
        }
        return acc;
      }, {}),
    };
  } catch (error) {
    cacheLog.error('获取缓存统计失败', { error: error.message });
    return {
      connected: false,
      error: error.message,
    };
  }
};

// 关闭连接
const close = async () => {
  if (client) {
    await client.quit();
    isConnected = false;
    cacheLog.info('Redis连接已关闭');
  }
};

// 缓存键生成器
const generateKey = (prefix, ...parts) => {
  return `${prefix}:${parts.join(':')}`;
};

// 用户相关缓存键
const userKeys = {
  info: (userId) => generateKey('user', userId, 'info'),
  quota: (userId) => generateKey('user', userId, 'quota'),
  tier: (userId) => generateKey('user', userId, 'tier'),
};

// 系统相关缓存键
const systemKeys = {
  config: () => generateKey('system', 'config'),
  tierLimits: () => generateKey('system', 'tier', 'limits'),
  models: () => generateKey('system', 'models'),
};

module.exports = {
  initRedis,
  get,
  set,
  del,
  delPattern,
  getOrSet,
  flush,
  getStats,
  close,
  generateKey,
  userKeys,
  systemKeys,
  get isConnected() {
    return isConnected;
  },
};
