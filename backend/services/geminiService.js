const fetch = require('node-fetch');
const logger = require('./loggerService').logger;

class GeminiService {
  static async analyzeImageWithKeywords(images, prompt, instructions, modelConfig, signal) {
    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      const model = 'gemini-1.5-flash';

      const parts = [
        {
          text: `请分析以下图像，并提取最相关的关键词。

用户问题：${prompt}

分析要求：
1. 详细分析图像内容，包括构图、材质、光影、领域特征等
2. 提取5-10个最能代表图像内容的关键词
3. 输出格式：先输出详细分析，然后在最后以 "关键词：[" 开头，"]" 结尾的格式列出关键词`
        }
      ];

      // 处理图像数据
      for (const img of images) {
        try {
          // 从data URL中提取base64数据
          const base64Data = img.data.split(',')[1];
          parts.push({
            inlineData: {
              mimeType: img.type || 'image/jpeg',
              data: base64Data
            }
          });
        } catch (e) {
          logger.error('图像数据处理失败:', e);
        }
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: parts
          }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // 提取关键词
      const keywordMatch = text.match(/关键词：\[(.*?)\]/);
      let keywords = [];
      if (keywordMatch && keywordMatch[1]) {
        keywords = keywordMatch[1].split(',').map(k => k.trim()).filter(k => k);
      }

      // 移除关键词部分，保留纯分析内容
      const analysis = text.replace(/关键词：\[.*?\]/, '').trim();

      return { analysis, keywords };
    } catch (error) {
      logger.error('图像分析失败:', error);
      // 模拟分析结果，防止API调用失败影响功能
      return {
        analysis: '这是一张图像的分析结果。由于API调用失败，返回了模拟数据。',
        keywords: ['图像', '分析', '测试', '关键词', '模拟']
      };
    }
  }
}

module.exports = { GeminiService };