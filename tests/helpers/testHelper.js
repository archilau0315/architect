// 测试工具类
class TestHelper {
  // 模拟响应生成器
  static createMockVideoResponse(status = 'queued', includeUsage = false) {
    const response = {
      id: 'video_' + Date.now(),
      status: status,
      progress: status === 'queued' ? 0 : 100,
      created_at: new Date().toISOString()
    };
    
    if (status === 'completed') {
      response.url = 'https://example.com/video.mp4';
    }
    
    if (includeUsage) {
      response.usage = {
        prompt_tokens: 0,
        completion_tokens: 100000,
        total_tokens: 100000,
        cost: 0.42
      };
    } else {
      response.total_tokens = 100000;
      response.cost = 0.42;
    }
    
    return response;
  }
  
  // 模拟PH8 API响应
  static createMockPh8Response(hasUsage = true, cost = 0.42) {
    const response = {
      id: 'req_' + Date.now(),
      object: 'video',
      created: Date.now(),
      status: 'completed'
    };
    
    if (hasUsage) {
      response.usage = {
        prompt_tokens: 0,
        completion_tokens: 100000,
        total_tokens: 100000,
        cost: cost
      };
    } else {
      response.total_tokens = 100000;
      response.cost = cost;
    }
    
    return response;
  }
  
  // 生成测试数据
  static generateTestVideoRequest() {
    return {
      model: 'doubao-seedance-1-0-pro-fast-251015',
      prompt: '生成一个建筑动画',
      duration: 5,
      resolution: '1080p',
      ratio: '16:9',
      watermark: false
    };
  }
  
  // 模拟数据库操作
  static createMockDb() {
    const mockDb = {
      query: jest.fn(),
      insertId: 1
    };
    
    mockDb.query.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT')) {
        return [{ insertId: mockDb.insertId++ }];
      }
      if (sql.includes('SELECT') && sql.includes('kbit_users')) {
        return [[{
          id: 13,
          total_points: 1000,
          daily_quota: 200,
          daily_used: 0,
          email: '172392827@qq.com'
        }]];
      }
      if (sql.includes('SELECT') && sql.includes('kbit_usage_logs')) {
        return [[{
          id: 567,
          user_id: 13,
          feature: 'video_gen',
          actual_cost: 0.42,
          points_cost: 420,
          created_at: new Date()
        }]];
      }
      return [[]];
    });
    
    return mockDb;
  }
  
  // 延时工具
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // 验证费用计算
  static validateVideoCost(tokens, expectedCost = 0.42) {
    const PH8_VIDEO_TOKEN_PRICE = 0.0000042;
    const calculatedCost = tokens * PH8_VIDEO_TOKEN_PRICE;
    return {
      calculated: calculatedCost,
      expected: expectedCost,
      isValid: Math.abs(calculatedCost - expectedCost) < 0.0001
    };
  }
  
  // 验证积分计算
  static validatePointsCost(cost, expectedPoints = 420) {
    const calculatedPoints = Math.round(cost * 1000);
    return {
      calculated: calculatedPoints,
      expected: expectedPoints,
      isValid: calculatedPoints === expectedPoints
    };
  }
}

module.exports = TestHelper;