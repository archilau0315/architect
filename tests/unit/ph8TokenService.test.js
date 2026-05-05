const { expect } = require('chai');
const sinon = require('sinon');
const TestHelper = require('../helpers/testHelper');
const config = require('../config');

describe('PH8 Token Service 单元测试', () => {
  let ph8TokenService;
  let mockDb;
  
  beforeAll(() => {
    mockDb = TestHelper.createMockDb();
    
    jest.doMock('../../backend/db', () => mockDb);
    ph8TokenService = require('../../backend/services/ph8TokenService');
  });
  
  afterAll(() => {
    jest.clearAllMocks();
  });
  
  describe('费用计算功能测试', () => {
    
    test('TC-001: 正确计算视频费用 - 100000 tokens', () => {
      const tokens = 100000;
      const result = TestHelper.validateVideoCost(tokens, 0.42);
      
      expect(result.isValid).to.be.true;
      expect(result.calculated).to.be.closeTo(0.42, 0.0001);
      console.log(`✓ TC-001: ${tokens} tokens = ¥${result.calculated}`);
    });
    
    test('TC-002: 正确计算积分 - 0.42元', () => {
      const cost = 0.42;
      const result = TestHelper.validatePointsCost(cost, 420);
      
      expect(result.isValid).to.be.true;
      expect(result.calculated).to.equal(420);
      console.log(`✓ TC-002: ¥${cost} = ${result.calculated}积分`);
    });
    
    test('TC-003: 边界条件测试 - 0 tokens', () => {
      const tokens = 0;
      const result = TestHelper.validateVideoCost(tokens, 0);
      
      expect(result.isValid).to.be.true;
      expect(result.calculated).to.equal(0);
      console.log(`✓ TC-003: ${tokens} tokens = ¥${result.calculated}`);
    });
    
    test('TC-004: 边界条件测试 - 1 token', () => {
      const tokens = 1;
      const result = TestHelper.validateVideoCost(tokens, 0.0000042);
      
      expect(result.calculated).to.be.closeTo(0.0000042, 0.00000001);
      console.log(`✓ TC-004: ${tokens} token = ¥${result.calculated}`);
    });
    
    test('TC-005: ph8TokenService.recordUsage 函数测试', async () => {
      const testData = {
        userId: 13,
        userNickname: '测试用户',
        userEmail: 'test@test.com',
        requestId: 'test_req_001',
        model: config.TEST_MODEL,
        channelId: 'ph8-video',
        promptTokens: 0,
        completionTokens: 100000,
        totalTokens: 100000,
        cost: 0.42,
        cachedTokens: 0,
        requestType: 'video',
        endpoint: '/ph8/videos',
        status: 'success',
        errorMessage: null,
        responseTimeMs: 5000,
        ipAddress: '127.0.0.1'
      };
      
      const result = await ph8TokenService.recordUsage(testData);
      
      expect(result).to.be.true;
      expect(mockDb.query).toHaveBeenCalled();
      
      const queryCall = mockDb.query.mock.calls[mockDb.query.mock.calls.length - 1];
      expect(queryCall[0]).to.include('INSERT');
      expect(queryCall[0]).to.include('kbit_usage_logs');
      
      console.log('✓ TC-005: recordUsage 函数执行成功');
    });
    
    test('TC-006: ph8TokenService.deductBalance 函数测试', async () => {
      const userId = 13;
      const cost = 0.42;
      const nickname = '测试用户';
      const email = 'test@test.com';
      
      await ph8TokenService.deductBalance(userId, cost, nickname, email);
      
      expect(mockDb.query).toHaveBeenCalled();
      console.log('✓ TC-006: deductBalance 函数执行成功');
    });
  });
  
  describe('异常场景测试', () => {
    
    test('TC-007: 费用为0时的处理', async () => {
      const testData = {
        userId: 13,
        userNickname: '测试用户',
        userEmail: 'test@test.com',
        requestId: 'test_req_002',
        model: config.TEST_MODEL,
        channelId: 'ph8-video',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        cachedTokens: 0,
        requestType: 'video',
        endpoint: '/ph8/videos',
        status: 'error',
        errorMessage: 'test error',
        responseTimeMs: 1000,
        ipAddress: '127.0.0.1'
      };
      
      const result = await ph8TokenService.recordUsage(testData);
      
      expect(result).to.be.true;
      console.log('✓ TC-007: 费用为0时处理正常');
    });
    
    test('TC-008: 无效用户ID的处理', async () => {
      const testData = {
        userId: 'invalid_user',
        userNickname: '未知用户',
        userEmail: null,
        requestId: 'test_req_003',
        model: config.TEST_MODEL,
        channelId: 'ph8-video',
        promptTokens: 0,
        completionTokens: 100000,
        totalTokens: 100000,
        cost: 0.42,
        cachedTokens: 0,
        requestType: 'video',
        endpoint: '/ph8/videos',
        status: 'success',
        errorMessage: null,
        responseTimeMs: 5000,
        ipAddress: '127.0.0.1'
      };
      
      const result = await ph8TokenService.recordUsage(testData);
      
      expect(result).to.be.true;
      console.log('✓ TC-008: 无效用户ID处理正常');
    });
  });
  
  describe('费用精度测试', () => {
    
    test('TC-009: 费用精度验证 - 小数点后6位', () => {
      const testCases = [
        { tokens: 100000, expectedCost: 0.42 },
        { tokens: 50000, expectedCost: 0.21 },
        { tokens: 10000, expectedCost: 0.042 },
        { tokens: 1000, expectedCost: 0.0042 }
      ];
      
      testCases.forEach(({ tokens, expectedCost }) => {
        const result = TestHelper.validateVideoCost(tokens, expectedCost);
        expect(result.isValid).to.be.true;
      });
      
      console.log('✓ TC-009: 费用精度验证通过');
    });
    
    test('TC-010: 积分四舍五入测试', () => {
      const testCases = [
        { cost: 0.424, expectedPoints: 424 },
        { cost: 0.425, expectedPoints: 425 },
        { cost: 0.4249, expectedPoints: 424 },
        { cost: 0.4251, expectedPoints: 425 }
      ];
      
      testCases.forEach(({ cost, expectedPoints }) => {
        const calculatedPoints = Math.round(cost * 1000);
        expect(calculatedPoints).to.equal(expectedPoints);
      });
      
      console.log('✓ TC-010: 积分四舍五入测试通过');
    });
  });
});