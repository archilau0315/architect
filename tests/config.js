const path = require('path');

// 测试配置
module.exports = {
  PH8_API_KEY: 'test-api-key',
  TEST_USER_ID: 13,
  TEST_USER_EMAIL: '172392827@qq.com',
  TEST_MODEL: 'doubao-seedance-1-0-pro-fast-251015',
  PH8_VIDEO_TOKEN_PRICE: 0.0000042,
  EXPECTED_VIDEO_COST: 0.42,
  EXPECTED_VIDEO_POINTS: 420,
  BACKEND_BASE_URL: 'http://localhost:3001',
  FRONTEND_BASE_URL: 'http://localhost:3000',
  TEST_VIDEO_TOKENS: 100000,
  
  // 测试数据库连接配置
  DB_CONFIG: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kbitai0302'
  },
  
  // 测试超时配置
  TIMEOUTS: {
    UNIT: 10000,
    INTEGRATION: 30000,
    E2E: 60000
  }
};