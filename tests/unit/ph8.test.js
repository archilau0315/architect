const { expect } = require('chai');
const sinon = require('sinon');
const TestHelper = require('../helpers/testHelper');
const config = require('../config');

describe('PH8 Proxy 路由单元测试', () => {
  let ph8RouteModule;
  let mockDb;
  let extractUsageFunction;
  
  beforeAll(() => {
    mockDb = TestHelper.createMockDb();
    
    jest.doMock('../backend/db', () => mockDb);
    
    // 动态导入并提取extractUsage函数进行测试
    const fs = require('fs');
    const path = require('path');
    const ph8Content = fs.readFileSync(
      path.join(__dirname, '../../backend/routes/ph8.js'),
      'utf8'
    );
    
    // 提取extractUsage函数
    const extractUsageMatch = ph8Content.match(/function extractUsage\([\s\S]*?^}/m);
    if (extractUsageMatch) {
      const extractUsageCode = extractUsageMatch[0] + '\nmodule.exports = extractUsage;';
      const tempFile = path.join(__dirname, '../temp_extract_usage.js');
      fs.writeFileSync(tempFile, extractUsageCode);
      extractUsageFunction = require(tempFile);
    }
  });
  
  describe('extractUsage 函数测试', () => {
    
    test('TC-011: 提取 OpenAI 标准格式 usage', () => {
      const responseBody = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
          cost: 0.06
        }
      };
      
      const result = extractUsageFunction(responseBody);
      
      expect(result).to.exist;
      expect(result.promptTokens).to.equal(100);
      expect(result.completionTokens).to.equal(200);
      expect(result.totalTokens).to.equal(300);
      expect(result.cost).to.equal(0.06);
      console.log('✓ TC-011: OpenAI标准格式提取成功');
    });
    
    test('TC-012: 提取简化格式 usage', () => {
      const responseBody = {
        prompt_tokens: 0,
        completion_tokens: 100000,
        total_tokens: 100000,
        cost: 0.42
      };
      
      const result = extractUsageFunction(responseBody);
      
      expect(result).to.exist;
      expect(result.totalTokens).to.equal(100000);
      expect(result.cost).to.equal(0.42);
      console.log('✓ TC-012: 简化格式提取成功');
    });
    
    test('TC-013: 提取根级别 cost 字段', () => {
      const responseBody = {
        total_tokens: 100000,
        cost: 0.42
      };
      
      const result = extractUsageFunction(responseBody);
      
      expect(result).to.exist;
      expect(result.totalTokens).to.equal(100000);
      expect(result.cost).to.equal(0.42);
      console.log('✓ TC-013: 根级别cost提取成功');
    });
    
    test('TC-014: 提取根级别 price 字段', () => {
      const responseBody = {
        total_tokens: 100000,
        price: 0.42
      };
      
      const result = extractUsageFunction(responseBody);
      
      expect(result).to.exist;
      expect(result.cost).to.equal(0.42);
      console.log('✓ TC-014: 根级别price提取成功');
    });
    
    test('TC-015: 视频响应格式提取测试', () => {
      const videoResponse = TestHelper.createMockVideoResponse('completed', true);
      
      const result = extractUsageFunction(videoResponse);
      
      expect(result).to.exist;
      expect(result.totalTokens).to.equal(100000);
      expect(result.cost).to.equal(0.42);
      console.log('✓ TC-015: 视频响应格式提取成功');
    });
    
    test('TC-016: 无usage数据时返回null', () => {
      const responseBody = {
        id: 'test_id',
        status: 'completed',
        url: 'https://example.com/video.mp4'
      };
      
      const result = extractUsageFunction(responseBody);
      
      expect(result).to.be.null;
      console.log('✓ TC-016: 无usage数据时正确返回null');
    });
    
    test('TC-017: 字符串JSON解析测试', () => {
      const jsonString = JSON.stringify({
        usage: {
          prompt_tokens: 0,
          completion_tokens: 100000,
          total_tokens: 100000,
          cost: 0.42
        }
      });
      
      const result = extractUsageFunction(jsonString);
      
      expect(result).to.exist;
      expect(result.cost).to.equal(0.42);
      console.log('✓ TC-017: 字符串JSON解析成功');
    });
    
    test('TC-018: 费用为字符串格式时的处理', () => {
      const responseBody = {
        total_tokens: 100000,
        cost: "0.42"
      };
      
      const result = extractUsageFunction(responseBody);
      
      expect(result).to.exist;
      expect(result.cost).to.equal("0.42"); 
      console.log('✓ TC-018: 字符串格式费用处理');
    });
  });
  
  describe('视频费用计算逻辑验证', () => {
    
    test('TC-019: 视频费用计算公式验证', () => {
      const PH8_VIDEO_TOKEN_PRICE = 0.0000042;
      const tokens = 100000;
      const expectedCost = 0.42;
      
      const calculatedCost = tokens * PH8_VIDEO_TOKEN_PRICE;
      
      expect(calculatedCost).to.be.closeTo(expectedCost, 0.0001);
      console.log(`✓ TC-019: 视频费用计算公式验证 - ${tokens} tokens × ¥${PH8_VIDEO_TOKEN_PRICE} = ¥${calculatedCost}`);
    });
    
    test('TC-020: 不同token数量的费用计算', () => {
      const PH8_VIDEO_TOKEN_PRICE = 0.0000042;
      const testCases = [
        { tokens: 50000, expectedCost: 0.21 },
        { tokens: 150000, expectedCost: 0.63 },
        { tokens: 200000, expectedCost: 0.84 }
      ];
      
      testCases.forEach(({ tokens, expectedCost }) => {
        const calculatedCost = tokens * PH8_VIDEO_TOKEN_PRICE;
        expect(calculatedCost).to.be.closeTo(expectedCost, 0.0001);
      });
      
      console.log('✓ TC-020: 不同token数量的费用计算验证');
    });
  });
  
  describe('边界条件测试', () => {
    
    test('TC-021: 0 tokens 费用计算', () => {
      const PH8_VIDEO_TOKEN_PRICE = 0.0000042;
      const tokens = 0;
      const expectedCost = 0;
      
      const calculatedCost = tokens * PH8_VIDEO_TOKEN_PRICE;
      
      expect(calculatedCost).to.equal(expectedCost);
      console.log('✓ TC-021: 0 tokens费用计算正确');
    });
    
    test('TC-022: 极端大token数量计算', () => {
      const PH8_VIDEO_TOKEN_PRICE = 0.0000042;
      const tokens = 10000000;
      const expectedCost = 42;
      
      const calculatedCost = tokens * PH8_VIDEO_TOKEN_PRICE;
      
      expect(calculatedCost).to.equal(expectedCost);
      console.log('✓ TC-022: 极端大token数量计算正确');
    });
  });
});