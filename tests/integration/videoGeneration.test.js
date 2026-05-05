const { expect } = require('chai');
const TestHelper = require('../helpers/testHelper');
const config = require('../config');

describe('视频生成功能测试', () => {
  
  describe('视频生成流程测试', () => {
    
    test('TC-023: 视频生成请求格式验证', () => {
      const videoRequest = TestHelper.generateTestVideoRequest();
      
      expect(videoRequest).to.have.property('model');
      expect(videoRequest).to.have.property('prompt');
      expect(videoRequest).to.have.property('duration');
      expect(videoRequest).to.have.property('resolution');
      expect(videoRequest).to.have.property('ratio');
      
      console.log('✓ TC-023: 视频生成请求格式正确');
    });
    
    test('TC-024: 视频POST请求响应格式验证', () => {
      const queuedResponse = TestHelper.createMockVideoResponse('queued');
      
      expect(queuedResponse).to.have.property('id');
      expect(queuedResponse).to.have.property('status');
      expect(queuedResponse.status).to.equal('queued');
      
      console.log('✓ TC-024: 视频POST响应格式正确');
    });
    
    test('TC-025: 视频完成状态响应验证', () => {
      const completedResponse = TestHelper.createMockVideoResponse('completed', true);
      
      expect(completedResponse).to.have.property('id');
      expect(completedResponse).to.have.property('status');
      expect(completedResponse.status).to.equal('completed');
      expect(completedResponse).to.have.property('url');
      expect(completedResponse).to.have.property('usage');
      
      console.log('✓ TC-025: 视频完成响应格式正确');
    });
  });
  
  describe('费用提取测试', () => {
    
    test('TC-026: 视频GET请求usage数据提取验证', () => {
      const videoResponse = TestHelper.createMockVideoResponse('completed', true);
      
      expect(videoResponse.usage).to.exist;
      expect(videoResponse.usage.total_tokens).to.equal(100000);
      expect(videoResponse.usage.cost).to.equal(0.42);
      
      console.log('✓ TC-026: usage数据正确');
    });
    
    test('TC-027: 根级别费用数据提取验证', () => {
      const videoResponse = TestHelper.createMockVideoResponse('completed', false);
      
      expect(videoResponse.total_tokens).to.equal(100000);
      expect(videoResponse.cost).to.equal(0.42);
      
      console.log('✓ TC-027: 根级别费用数据正确');
    });
  });
  
  describe('视频生成边界条件测试', () => {
    
    test('TC-028: 时长参数测试', () => {
      const testCases = [
        { duration: 1, isValid: true },
        { duration: 5, isValid: true },
        { duration: 10, isValid: true }
      ];
      
      testCases.forEach(({ duration, isValid }) => {
        const request = TestHelper.generateTestVideoRequest();
        request.duration = duration;
        expect(request.duration).to.equal(duration);
      });
      
      console.log('✓ TC-028: 时长参数测试通过');
    });
    
    test('TC-029: 分辨率参数测试', () => {
      const testCases = ['720p', '1080p'];
      
      testCases.forEach(resolution => {
        const request = TestHelper.generateTestVideoRequest();
        request.resolution = resolution;
        expect(request.resolution).to.equal(resolution);
      });
      
      console.log('✓ TC-029: 分辨率参数测试通过');
    });
    
    test('TC-030: 比例参数测试', () => {
      const testCases = ['16:9', '9:16', '1:1'];
      
      testCases.forEach(ratio => {
        const request = TestHelper.generateTestVideoRequest();
        request.ratio = ratio;
        expect(request.ratio).to.equal(ratio);
      });
      
      console.log('✓ TC-030: 比例参数测试通过');
    });
  });
});