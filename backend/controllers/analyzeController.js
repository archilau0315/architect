const { GeminiService } = require('../services/geminiService');
const TextAnalyzer = require('../services/textAnalyzer');
const logger = require('../services/loggerService').logger;

class AnalyzeController {
  // 图像分析
  static async analyzeImage(req, res) {
    try {
      const { images, prompt } = req.body;

      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({
          success: false,
          error: '缺少图像数据',
          message: '请提供至少一张图像进行分析'
        });
      }

      // 调用GeminiService进行图像分析
      const result = await GeminiService.analyzeImageWithKeywords(
        images,
        prompt || '分析这张图像'
      );

      // 使用TextAnalyzer分析文本，生成结构化数据
      const structuredData = TextAnalyzer.analyzeText(result.analysis);

      return res.json({
        success: true,
        analysis: result.analysis,
        keywords: structuredData.keywords,
        search_query: structuredData.search_query,
        structured_data: structuredData
      });
    } catch (error) {
      logger.error('[AnalyzeController] 图像分析失败:', error);
      return res.status(500).json({
        success: false,
        error: '图像分析失败',
        message: error.message || '服务器内部错误'
      });
    }
  }
}

module.exports = AnalyzeController;