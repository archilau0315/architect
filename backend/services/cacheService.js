const redis = require('redis');

// Redis 客户端配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('[Cache] Redis server connection refused');
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

// 创建 Redis 客户端
let client = null;
let isConnected = false;

// 初始化 Redis 连接
const initRedis = async () => {
  try {
    client = redis.createClient(redisConfig);

    client.on('error', (err) => {
      console.error('[Cache] Redis error:', err);
      isConnected = false;
    });

    client.on('connect', () => {
      console.log('[Cache] Redis connected');
      isConnected = true;
    });

    client.on('reconnecting', () => {
      console.log('[Cache] Redis reconnecting...');
    });

    await client.connect();
    return true;
  } catch (error) {
    console.error('[Cache] Failed to connect to Redis:', error.message);
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
      console.log(`[Cache] Hit: ${key}`);
      return JSON.parse(value);
    }
    console.log(`[Cache] Miss: ${key}`);
    return null;
  } catch (error) {
    console.error(`[Cache] Get error for key ${key}:`, error.message);
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
    console.log(`[Cache] Set: ${key} (TTL: ${expireSeconds}s)`);
    return true;
  } catch (error) {
    console.error(`[Cache] Set error for key ${key}:`, error.message);
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
    console.log(`[Cache] Deleted: ${key}`);
    return true;
  } catch (error) {
    console.error(`[Cache] Delete error for key ${key}:`, error.message);
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
      console.log(`[Cache] Deleted pattern: ${pattern} (${keys.length} keys)`);
    }
    return true;
  } catch (error) {
    console.error(`[Cache] Delete pattern error for ${pattern}:`, error.message);
    return false;
  }
};

// 获取或设置缓存（Cache-Aside模式）
const getOrSet = async (key, factory, expireSeconds = 3600) => {
  // 先尝试从缓存获取
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }
  
  // 执行工厂函数获取数据
  try {
    const data = await factory();
    if (data !== null && data !== undefined) {
      await set(key, data, expireSeconds);
    }
    return data;
  } catch (error) {
    console.error(`[Cache] Factory error for key ${key}:`, error.message);
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
    console.log('[Cache] Flushed all cache');
    return true;
  } catch (error) {
    console.error('[Cache] Flush error:', error.message);
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
    console.error('[Cache] Stats error:', error.message);
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
    console.log('[Cache] Redis connection closed');
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
