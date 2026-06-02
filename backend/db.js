require('dotenv').config();
const mysql = require('mysql2/promise');
const EventEmitter = require('events');

// 创建数据库监控事件发射器
const dbMonitor = new EventEmitter();

// 数据库连接池配置
// [安全修复] 从环境变量加载，兼容多种变量名（DB_USER / DB_USERNAME）
const poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER || process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // 连接超时设置
  connectTimeout: 10000,
  // 启用keepAlive
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

const pool = mysql.createPool(poolConfig);

// 连接池监控统计
const poolStats = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  queuedRequests: 0,
  totalQueries: 0,
  errorCount: 0,
  slowQueries: 0,
  lastError: null,
  lastErrorTime: null,
};

// 慢查询阈值（毫秒）
const SLOW_QUERY_THRESHOLD = 1000;

// 监听连接获取
pool.on('acquire', function (connection) {
  poolStats.activeConnections++;
  poolStats.totalQueries++;
  console.log(`[DB] Connection ${connection.threadId} acquired. Active: ${poolStats.activeConnections}`);
});

// 监听连接释放
pool.on('release', function (connection) {
  poolStats.activeConnections--;
  console.log(`[DB] Connection ${connection.threadId} released. Active: ${poolStats.activeConnections}`);
});

// 监听连接排队
pool.on('enqueue', function () {
  poolStats.queuedRequests++;
  console.log(`[DB] Waiting for available connection slot. Queue: ${poolStats.queuedRequests}`);
});

// 监听连接创建
pool.on('connection', function (connection) {
  poolStats.totalConnections++;
  console.log(`[DB] New connection ${connection.threadId} created. Total: ${poolStats.totalConnections}`);
});

// 包装查询方法以添加监控
const originalQuery = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);

// 监控查询性能
const monitorQuery = async (queryFn, sql, params) => {
  const startTime = Date.now();
  try {
    const result = await queryFn(sql, params);
    const duration = Date.now() - startTime;
    
    if (duration > SLOW_QUERY_THRESHOLD) {
      poolStats.slowQueries++;
      console.warn(`[DB] Slow query detected (${duration}ms): ${sql.substring(0, 100)}...`);
      dbMonitor.emit('slowQuery', { sql, duration, params });
    }
    
    return result;
  } catch (error) {
    poolStats.errorCount++;
    poolStats.lastError = error.message;
    poolStats.lastErrorTime = new Date();
    console.error(`[DB] Query error: ${error.message}`);
    // 移除错误事件发射，避免未处理的错误导致应用崩溃
    throw error;
  }
};

// 重写 query 方法
pool.query = async function(sql, params) {
  return monitorQuery(originalQuery, sql, params);
};

// 重写 execute 方法
pool.execute = async function(sql, params) {
  return monitorQuery(originalExecute, sql, params);
};

// 获取连接池状态
const getPoolStatus = () => {
  return {
    ...poolStats,
    timestamp: new Date().toISOString(),
    config: {
      connectionLimit: poolConfig.connectionLimit,
      host: poolConfig.host,
      database: poolConfig.database,
    }
  };
};

// 健康检查
const healthCheck = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { healthy: true, latency: Date.now() };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};

// 重置统计
const resetStats = () => {
  poolStats.totalQueries = 0;
  poolStats.errorCount = 0;
  poolStats.slowQueries = 0;
  poolStats.lastError = null;
  poolStats.lastErrorTime = null;
};

// 定期报告（每5分钟）
setInterval(() => {
  const status = getPoolStatus();
  console.log('[DB] Pool Status Report:', JSON.stringify(status, null, 2));
}, 300000);

module.exports = pool;
module.exports.dbMonitor = dbMonitor;
module.exports.getPoolStatus = getPoolStatus;
module.exports.healthCheck = healthCheck;
module.exports.resetStats = resetStats;

// [安全修复] 启动时校验必要的环境变量，兼容 DB_USER / DB_USERNAME
function getDbUser() { return process.env.DB_USER || process.env.DB_USERNAME; }
const dbEnvCheck = {
  DB_HOST: process.env.DB_HOST,
  DB_USER: getDbUser(),
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_DATABASE: process.env.DB_DATABASE,
};
const missingEnvVars = Object.entries(dbEnvCheck).filter(([, v]) => !v).map(([k]) => k);
if (missingEnvVars.length > 0) {
  console.error(`[FATAL] 数据库: 缺少环境变量: ${missingEnvVars.join(', ')}`);
  console.error('[FATAL] 当前已配置:', Object.keys(dbEnvCheck).filter(k => dbEnvCheck[k]).join(', ') || '(无)');
  console.error('[FATAL] 请在 backend/.env 中配置（注意: 用户名字段支持 DB_USER 或 DB_USERNAME）:');
  missingEnvVars.forEach(v => console.error(`  - ${v}=你的值`));
} else {
  console.log('[DB] 数据库配置校验通过 ✅ (host=' + dbEnvCheck.DB_HOST + ', user=' + dbEnvCheck.DB_USER + ', db=' + dbEnvCheck.DB_DATABASE + ')');
}
