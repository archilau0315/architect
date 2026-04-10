const monitoringService = require('../services/monitoringService');

// 监控中间件
const monitoringMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // 重写res.send方法，以便在响应发送后记录监控数据
  res.send = function(body) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const success = res.statusCode < 400;
    
    // 记录API调用
    monitoringService.recordApiCall(duration, success, req.path);
    
    // 调用原始的send方法
    return originalSend.call(this, body);
  };
  
  next();
};

// 系统监控定时任务
const setupMonitoringTasks = () => {
  // 每30秒收集一次系统指标
  setInterval(async () => {
    try {
      await monitoringService.collectSystemMetrics();
    } catch (error) {
      console.error('Error in monitoring task:', error);
    }
  }, 30000);
  
  console.log('Monitoring tasks initialized');
};

module.exports = {
  monitoringMiddleware,
  setupMonitoringTasks
};
