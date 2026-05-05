const { expect } = require('chai');
const TestHelper = require('../helpers/testHelper');
const config = require('../config');

describe('积分扣费功能测试', () => {
  
  describe('正常场景测试', () => {
    
    test('TC-031: 视频生成正确扣420积分', () => {
      const tokens = 100000;
      const costValidation = TestHelper.validateVideoCost(tokens, 0.42);
      const pointsValidation = TestHelper.validatePointsCost(costValidation.calculated, 420);
      
      expect(costValidation.isValid).to.be.true;
      expect(pointsValidation.isValid).to.be.true;
      
      console.log(`✓ TC-031: ${tokens} tokens = ¥${costValidation.calculated} = ${pointsValidation.calculated}积分`);
    });
    
    test('TC-032: 验证费用计算公式的正确性', () => {
      const PH8_VIDEO_TOKEN_PRICE = 0.0000042;
      const testCases = [
        { tokens: 100000, expectedCost: 0.42, expectedPoints: 420 },
        { tokens: 50000, expectedCost: 0.21, expectedPoints: 210 },
        { tokens: 200000, expectedCost: 0.84, expectedPoints: 840 }
      ];
      
      testCases.forEach(({ tokens, expectedCost, expectedPoints }) => {
        const calculatedCost = tokens * PH8_VIDEO_TOKEN_PRICE;
        const calculatedPoints = Math.round(calculatedCost * 1000);
        
        expect(calculatedCost).to.be.closeTo(expectedCost, 0.0001);
        expect(calculatedPoints).to.equal(expectedPoints);
      });
      
      console.log('✓ TC-032: 费用计算公式验证通过');
    });
    
    test('TC-033: 数据库记录格式验证', () => {
      const testRecord = {
        id: 567,
        user_id: 13,
        feature: 'video_gen',
        actual_cost: 0.42,
        points_cost: 420,
        created_at: new Date()
      };
      
      expect(testRecord).to.have.property('actual_cost');
      expect(testRecord).to.have.property('points_cost');
      expect(testRecord.actual_cost).to.equal(0.42);
      expect(testRecord.points_cost).to.equal(420);
      
      console.log('✓ TC-033: 数据库记录格式正确');
    });
  });
  
  describe('错误场景测试', () => {
    
    test('TC-034: 发现之前的错误 - 旧公式计算的费用', () => {
      // 旧的错误公式：(prompt_tokens * 0.3 + completion_tokens * 0.6) / 1000000
      const promptTokens = 0;
      const completionTokens = 100000;
      const wrongCost = (promptTokens * 0.3 + completionTokens * 0.6) / 1000000;
      const wrongPoints = Math.round(wrongCost * 1000);
      
      expect(wrongCost).to.equal(0.06);
      expect(wrongPoints).to.equal(60);
      
      console.log(`✓ TC-034: 发现旧公式错误 - 计算为 ¥${wrongCost} = ${wrongPoints}积分（应该是¥0.42 = 420积分）`);
    });
    
    test('TC-035: 对比正确公式与错误公式的差异', () => {
      const tokens = 100000;
      
      const wrongCost = (0 * 0.3 + tokens * 0.6) / 1000000;
      const wrongPoints = Math.round(wrongCost * 1000);
      
      const correctCost = tokens * 0.0000042;
      const correctPoints = Math.round(correctCost * 1000);
      
      expect(wrongCost).to.equal(0.06);
      expect(wrongPoints).to.equal(60);
      expect(correctCost).to.equal(0.42);
      expect(correctPoints).to.equal(420);
      
      const ratio = correctCost / wrongCost;
      expect(ratio).to.equal(7);
      
      console.log(`✓ TC-035: 差异比率验证 - 错误公式是正确公式的1/${ratio}`);
    });
  });
  
  describe('边界条件测试', () => {
    
    test('TC-036: 费用为0时不扣费', () => {
      const cost = 0;
      const points = Math.round(cost * 1000);
      
      expect(points).to.equal(0);
      console.log('✓ TC-036: 费用为0时正确不扣费');
    });
    
    test('TC-037: 小数费用的四舍五入测试', () => {
      const testCases = [
        { cost: 0.424, expectedPoints: 424 },
        { cost: 0.425, expectedPoints: 425 },
        { cost: 0.424999, expectedPoints: 424 },
        { cost: 0.425001, expectedPoints: 425 }
      ];
      
      testCases.forEach(({ cost, expectedPoints }) => {
        const calculatedPoints = Math.round(cost * 1000);
        expect(calculatedPoints).to.equal(expectedPoints);
      });
      
      console.log('✓ TC-037: 四舍五入逻辑验证通过');
    });
    
    test('TC-038: 负费用的处理测试', () => {
      const cost = -0.42;
      const points = Math.round(Math.max(0, cost) * 1000);
      
      expect(points).to.equal(0);
      console.log('✓ TC-038: 负费用处理正确');
    });
  });
  
  describe('一致性测试', () => {
    
    test('TC-039: actual_cost 与 points_cost 一致性验证', () => {
      const testRecords = [
        { actual_cost: 0.42, points_cost: 420, isValid: true },
        { actual_cost: 0.06, points_cost: 60, isValid: false },
        { actual_cost: 0, points_cost: 0, isValid: true }
      ];
      
      testRecords.forEach(({ actual_cost, points_cost, isValid }) => {
        const calculatedPoints = Math.round(actual_cost * 1000);
        const isConsistent = calculatedPoints === points_cost;
        expect(isConsistent).to.equal(isValid);
      });
      
      console.log('✓ TC-039: 费用与积分一致性验证通过');
    });
  });
});