const fs = require('fs');
const path = require('path');

// 日志级别
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

// 日志级别名称
const LogLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

// 当前日志级别（从环境变量读取，默认为 INFO）
const CURRENT_LOG_LEVEL = LogLevel[process.env.LOG_LEVEL?.toUpperCase()] || LogLevel.INFO;

// 日志目录
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志文件路径
const LOG_FILE = path.join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);
const ERROR_LOG_FILE = path.join(LOG_DIR, `error-${new Date().toISOString().split('T')[0]}.log`);

// 日志缓冲区
let logBuffer = [];
const BUFFER_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5秒刷新一次

// 格式化日志消息
const formatLogMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const levelName = LogLevelNames[level];

  // 手动构建 JSON 字符串，保留中文字符不被转义为 \uXXXX
  let result = '{"timestamp":"' + timestamp + '","level":"' + levelName + '","message":';
  result += JSON.stringify(message);
  for (const [key, value] of Object.entries(meta)) {
    result += ',"' + key + '":' + JSON.stringify(value);
  }
  result += '}';

  return result;
};

// 写入日志到文件
const writeToFile = (logMessage, isError = false) => {
  const file = isError ? ERROR_LOG_FILE : LOG_FILE;
  
  try {
    fs.appendFileSync(file, logMessage + '\n');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
};

// 刷新日志缓冲区
const flushBuffer = () => {
  if (logBuffer.length === 0) return;
  
  const logs = logBuffer.join('\n');
  writeToFile(logs);
  
  // 分离错误日志
  const errorLogs = logBuffer.filter(log => {
    try {
      const parsed = JSON.parse(log);
      return ['ERROR', 'FATAL'].includes(parsed.level);
    } catch {
      return false;
    }
  });
  
  if (errorLogs.length > 0) {
    writeToFile(errorLogs.join('\n'), true);
  }
  
  logBuffer = [];
};

// 定期刷新缓冲区
setInterval(flushBuffer, FLUSH_INTERVAL);

// 记录日志
const log = (level, message, meta = {}) => {
  if (level < CURRENT_LOG_LEVEL) return;
  
  const logMessage = formatLogMessage(level, message, meta);
  
  // 添加到缓冲区
  logBuffer.push(logMessage);
  
  // 如果缓冲区满了，立即刷新
  if (logBuffer.length >= BUFFER_SIZE) {
    flushBuffer();
  }
  
  // 同时输出到控制台（开发环境）
  if (process.env.NODE_ENV !== 'production') {
    const levelName = LogLevelNames[level];
    const color = {
      DEBUG: '\x1b[36m', // 青色
      INFO: '\x1b[32m',  // 绿色
      WARN: '\x1b[33m',  // 黄色
      ERROR: '\x1b[31m', // 红色
      FATAL: '\x1b[35m', // 紫色
    }[levelName];
    
    console.log(`${color}[${levelName}]\x1b[0m ${message}`);
  }
};

// 日志方法
const logger = {
  debug: (message, meta) => log(LogLevel.DEBUG, message, meta),
  info: (message, meta) => log(LogLevel.INFO, message, meta),
  warn: (message, meta) => log(LogLevel.WARN, message, meta),
  error: (message, meta) => log(LogLevel.ERROR, message, meta),
  fatal: (message, meta) => log(LogLevel.FATAL, message, meta),
};

// 请求日志中间件
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // 记录请求开始
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.headers['x-user-id'],
  });
  
  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.headers['x-user-id'],
    };
    
    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
};

// 错误日志中间件
const errorLogger = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.headers['x-user-id'],
    body: req.body,
    query: req.query,
  });
  
  next(err);
};

// 获取日志文件列表
const getLogFiles = () => {
  try {
    const files = fs.readdirSync(LOG_DIR);
    return files
      .filter(file => file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(LOG_DIR, file),
        size: fs.statSync(path.join(LOG_DIR, file)).size,
        created: fs.statSync(path.join(LOG_DIR, file)).birthtime,
      }))
      .sort((a, b) => b.created - a.created);
  } catch (error) {
    logger.error('Failed to get log files', { error: error.message });
    return [];
  }
};

// 读取日志文件内容
const readLogFile = (fileName, lines = 100) => {
  try {
    const filePath = path.join(LOG_DIR, fileName);
    const content = fs.readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());
    return allLines.slice(-lines);
  } catch (error) {
    logger.error('Failed to read log file', { error: error.message, fileName });
    return [];
  }
};

// 清理旧日志文件（保留最近7天）
const cleanupOldLogs = () => {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > sevenDays) {
        fs.unlinkSync(filePath);
        logger.info('Cleaned up old log file', { file });
      }
    });
  } catch (error) {
    logger.error('Failed to cleanup old logs', { error: error.message });
  }
};

// 每天清理一次旧日志
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

// 进程退出时刷新日志
process.on('exit', flushBuffer);
process.on('SIGINT', () => {
  flushBuffer();
  process.exit(0);
});
process.on('SIGTERM', () => {
  flushBuffer();
  process.exit(0);
});

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  getLogFiles,
  readLogFile,
  cleanupOldLogs,
  flushBuffer,
  LogLevel,
};
