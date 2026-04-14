require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { getPoolStatus, healthCheck } = require('./db');
const inviteRoutes = require('./routes/invite');
const watermarkRoutes = require('./routes/watermark');
const usageRoutes = require('./routes/usage');
const betaRoutes = require('./routes/beta');
const ph8Routes = require('./routes/ph8');
const planRoutes = require('./routes/plan');
const ph8BalanceRoutes = require('./routes/ph8Balance');
const gatewayRoutes = require('./routes/gateway');
const ph8TokenService = require('./services/ph8TokenService');
const mailService = require('./services/mailService');
const cacheService = require('./services/cacheService');
const { logger, requestLogger, errorLogger, getLogFiles, readLogFile } = require('./services/loggerService');

// 导入控制器
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const contentController = require('./controllers/contentController');
const adminController = require('./controllers/adminController');

// 导入错误处理中间件
const { errorHandler, notFound } = require('./middleware/errorHandler');

// 导入监控中间件
const { monitoringMiddleware, setupMonitoringTasks } = require('./middleware/monitoring');

// 导入验证中间件
const {
  validateRequest,
  validateLoginRequest,
  validateConsumePointsRequest,
  validateUserIdParam,
  sqlInjectionProtection,
} = require('./middleware/validation');

const app = express();
// 本地开发环境处理 CORS
app.use(cors({
  origin: ['https://www.kbitai.com.cn', 'https://kbitai.com.cn', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 添加安全验证中间件（顺序很重要）
app.use(requestLogger);           // 首先记录请求日志
app.use(sqlInjectionProtection);  // 然后检查SQL注入
app.use(validateRequest);         // 清理和验证输入
app.use(monitoringMiddleware);    // 添加监控

app.use('/api/invite', inviteRoutes);
app.use('/api/watermark', watermarkRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/plan', planRoutes);
// PH8 余额路由必须在 ph8Routes 之前加载，避免被通配符路由捕获
app.use('/api/ph8', ph8BalanceRoutes);
app.use('/api/ph8', ph8Routes);

// 通用网关路由（支持多网关）
// 新格式: /api/gateway/:gatewayKey/*
// 示例: /api/gateway/ph8/chat/completions
app.use('/api/gateway', gatewayRoutes);

// 兼容旧路由：/api/ph8/* 仍然可用
// 后续可以逐步迁移到 /api/gateway/ph8/*

// ==================== 用户认证 API ====================

// 用户登录
app.post('/api/auth/login', validateLoginRequest, authController.login);

// 请求密码重置
app.post('/api/auth/forgot-password', authController.forgotPassword);

// 验证重置令牌
app.get('/api/auth/verify-reset-token', authController.verifyResetToken);

// 重置密码
app.post('/api/auth/reset-password', authController.resetPassword);

// 获取用户信息
app.get('/api/user/info', validateUserIdParam, userController.getUserInfo);

// 消耗积分
app.post('/api/user/consume', validateUserIdParam, validateConsumePointsRequest, userController.consumePoints);

// ==================== 内容注册 API ====================

app.post('/api/content/register', contentController.registerContent);

app.get('/api/content/verify/:contentId', contentController.verifyContent);

// ==================== 下载日志 API ====================

app.post('/api/logs/download', contentController.logDownload);

// ==================== 管理后台 API ====================

// 管理员登录
app.post('/api/admin/login', adminController.login);

app.get('/api/admin/users', adminController.getUsers);
app.get('/api/admin/users/:id', adminController.getUser);
app.put('/api/admin/users/:id', adminController.updateUser);
app.delete('/api/admin/users/:id', adminController.deleteUser);
app.get('/api/admin/dashboard', adminController.getDashboard);
app.get('/api/admin/logs', adminController.getLogs);
app.get('/api/admin/configs', adminController.getConfigs);
app.put('/api/admin/configs/:key', adminController.updateConfig);
app.get('/api/admin/beta-requests', adminController.getBetaRequests);
app.post('/api/admin/beta-requests/:id/approve', adminController.approveBetaRequest);
app.post('/api/admin/beta-requests/:id/reject', adminController.rejectBetaRequest);

// ==================== 定时任务：每日重置 ====================
// 每天凌晨 0:00 重置每日使用计数
function scheduleDailyReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow - now;
  
  console.log(`[定时任务] 下次每日重置将在 ${Math.round(msUntilMidnight / 1000 / 60)} 分钟后执行`);
  
  setTimeout(async () => {
    console.log('[定时任务] 执行每日重置...');
    await ph8TokenService.resetDailyUsage();

    // 检查是否需要重置每月计数（每月1号）
    const today = new Date();
    if (today.getDate() === 1) {
      console.log('[定时任务] 执行每月重置...');
      await ph8TokenService.resetMonthlyUsage();
    }
    
    // 递归设置下一次重置
    scheduleDailyReset();
  }, msUntilMidnight);
}

// 启动定时任务
scheduleDailyReset();

// 启动监控任务
setupMonitoringTasks();

// ==================== 数据库监控 API ====================

// 获取数据库连接池状态
app.get('/api/admin/db-status', async (req, res) => {
  try {
    const status = getPoolStatus();
    const health = await healthCheck();
    res.json({
      success: true,
      data: {
        ...status,
        health,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取数据库状态失败',
      message: error.message,
    });
  }
});

// 数据库健康检查
app.get('/api/health', async (req, res) => {
  try {
    const health = await healthCheck();
    const cacheStats = await cacheService.getStats();
    
    if (health.healthy) {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cache: cacheStats,
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: health.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 缓存管理 API
app.get('/api/admin/cache-stats', async (req, res) => {
  try {
    const stats = await cacheService.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取缓存统计失败',
      message: error.message,
    });
  }
});

// 清空缓存
app.post('/api/admin/cache-flush', async (req, res) => {
  try {
    await cacheService.flush();
    res.json({
      success: true,
      message: '缓存已清空',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '清空缓存失败',
      message: error.message,
    });
  }
});

// 日志管理 API
app.get('/api/admin/logs', async (req, res) => {
  try {
    const files = getLogFiles();
    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取日志列表失败',
      message: error.message,
    });
  }
});

// 读取日志内容
app.get('/api/admin/logs/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const lines = parseInt(req.query.lines) || 100;
    const content = readLogFile(fileName, lines);
    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '读取日志失败',
      message: error.message,
    });
  }
});

// 添加错误日志中间件（在错误处理之前）
app.use(errorLogger);

// 添加错误处理中间件
app.use(notFound);
app.use(errorHandler);

// 初始化 Redis 缓存
cacheService.initRedis().then((connected) => {
  if (connected) {
    logger.info('Redis cache initialized');
  } else {
    logger.warn('Redis cache not available, continuing without cache');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`API Server running on port ${PORT}`);
});
