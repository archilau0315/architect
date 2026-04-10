const db = require('../db');
const os = require('os');

// 监控数据收集服务
class MonitoringService {
  constructor() {
    this.metrics = {
      apiCalls: 0,
      errorCount: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      uptime: 0
    };
    this.startTime = Date.now();
  }

  // 记录API调用
  async recordApiCall(duration, success = true, endpoint = '') {
    this.metrics.apiCalls++;
    this.metrics.totalResponseTime += duration;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.apiCalls;
    
    if (!success) {
      this.metrics.errorCount++;
    }
    
    // 保存到数据库
    try {
      await db.query(
        'INSERT INTO monitoring_logs (endpoint, duration, success, timestamp) VALUES (?, ?, ?, ?)',
        [endpoint, duration, success ? 1 : 0, new Date()]
      );
    } catch (error) {
      console.error('Failed to record monitoring data:', error);
    }
  }

  // 收集系统资源使用情况
  async collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = os.loadavg()[0]; // 1分钟平均负载
    const uptime = process.uptime();
    
    this.metrics.memoryUsage = memoryUsage.rss / 1024 / 1024; // 转换为MB
    this.metrics.cpuUsage = cpuUsage;
    this.metrics.uptime = uptime;
    
    // 保存到数据库
    try {
      await db.query(
        'INSERT INTO system_metrics (memory_usage, cpu_usage, uptime, timestamp) VALUES (?, ?, ?, ?)',
        [this.metrics.memoryUsage, this.metrics.cpuUsage, this.metrics.uptime, new Date()]
      );
    } catch (error) {
      console.error('Failed to record system metrics:', error);
    }
    
    return this.metrics;
  }

  // 获取当前监控数据
  getMetrics() {
    return this.metrics;
  }

  // 重置监控数据
  resetMetrics() {
    this.metrics = {
      apiCalls: 0,
      errorCount: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      uptime: 0
    };
  }
}

// 导出单例
module.exports = new MonitoringService();
