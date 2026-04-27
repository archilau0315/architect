const tavilyService = require('./tavilyService');
const axios = require('axios');

/**
 * Tavily Search 与 AI 对话系统集成示例
 * 
 * 使用方法：
 * 1. 在 .env 文件中配置 TAVILY_API_KEY
 * 2. 在对话处理逻辑中调用 completeConversationWithSearch 方法
 * 
 * 示例：
 * const { completeConversationWithSearch } = require('./tavilyIntegration');
 * const result = await completeConversationWithSearch(userMessage, chatHistory);
 * 
 * 返回结果：
 * {
 *   searched: boolean,      // 是否执行了搜索
 *   context: string,        // 搜索上下文（用于大模型）
 *   searchInfo: object,     // 搜索详情
 *   finalAnswer: string     // 最终回答（如果调用了大模型）
 * }
 */

class TavilyIntegration {
  constructor() {
    // 大模型 API 配置（根据实际情况修改）
    this.llmConfig = {
      apiBase: process.env.LLM_API_BASE || 'https://api.kbitai.com.cn/api/gateway/ph8',
      model: process.env.LLM_MODEL || 'gpt-4o'
    };
  }

  /**
   * 完整对话流程：判断搜索 -> 执行搜索 -> 调用大模型
   * @param {string} userMessage - 用户消息
   * @param {array} chatHistory - 对话历史
   * @param {object} options - 选项
   * @returns {object} - 完整结果
   */
  async completeConversationWithSearch(userMessage, chatHistory = [], options = {}) {
    // 1. 判断是否需要搜索
    const searchResult = await tavilyService.completeSearch(userMessage);

    // 2. 构建大模型提示词
    let prompt = this.buildPrompt(userMessage, chatHistory, searchResult.context);

    // 3. 调用大模型生成回答
    const llmResult = await this.callLLM(prompt, chatHistory);

    return {
      searched: searchResult.searched,
      reason: searchResult.reason,
      context: searchResult.context,
      searchInfo: searchResult.result ? {
        answer: searchResult.result.answer,
        totalResults: searchResult.result.results.length
      } : null,
      finalAnswer: llmResult,
      error: searchResult.error
    };
  }

  /**
   * 构建大模型提示词
   * @param {string} userMessage - 用户消息
   * @param {array} chatHistory - 对话历史
   * @param {string} searchContext - 搜索上下文
   * @returns {string} - 完整提示词
   */
  buildPrompt(userMessage, chatHistory = [], searchContext = '') {
    let prompt = `你是一个智能助手，请根据以下信息回答用户问题。\n\n`;

    // 添加搜索上下文（如果有）
    if (searchContext) {
      prompt += `【联网搜索信息】\n${searchContext}\n\n`;
      prompt += `请参考以上搜索结果回答问题，如果搜索结果中没有相关信息，可以忽略。\n\n`;
    }

    // 添加对话历史
    if (chatHistory && chatHistory.length > 0) {
      prompt += `【对话历史】\n`;
      chatHistory.forEach((msg, index) => {
        prompt += `${index + 1}. ${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    // 添加用户问题
    prompt += `【用户问题】\n${userMessage}\n\n`;
    prompt += `请用自然、友好的语言回答用户的问题。`;

    return prompt;
  }

  /**
   * 调用大模型
   * @param {string} prompt - 提示词
   * @param {array} chatHistory - 对话历史
   * @returns {string} - 模型回答
   */
  async callLLM(prompt, chatHistory = []) {
    try {
      // 构建 messages 格式
      const messages = [];
      
      // 添加系统提示
      messages.push({
        role: 'system',
        content: '你是一个专业的AI助手，擅长回答各种问题。'
      });

      // 添加对话历史
      chatHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });

      // 添加当前提示
      messages.push({
        role: 'user',
        content: prompt
      });

      // 调用大模型 API
      const response = await axios.post(
        `${this.llmConfig.apiBase}/chat/completions`,
        {
          model: this.llmConfig.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 4096
        },
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // 解析响应
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message?.content || '';
      } else {
        return '抱歉，我无法回答这个问题。';
      }
    } catch (error) {
      console.error('[LLM API] 调用失败:', error.message);
      return '抱歉，服务暂时不可用，请稍后重试。';
    }
  }

  /**
   * 仅执行搜索（不调用大模型）
   * @param {string} query - 用户提问
   * @param {object} options - 搜索选项
   * @returns {object} - 搜索结果
   */
  async searchOnly(query, options = {}) {
    return await tavilyService.completeSearch(query, options);
  }

  /**
   * 判断是否需要搜索（独立方法）
   * @param {string} query - 用户提问
   * @returns {boolean} - 是否需要搜索
   */
  shouldSearch(query) {
    return tavilyService.shouldSearch(query);
  }
}

module.exports = new TavilyIntegration();

/**
 * 使用示例：
 * 
 * // 示例1：完整集成（搜索 + 大模型）
 * const tavilyIntegration = require('./tavilyIntegration');
 * const result = await tavilyIntegration.completeConversationWithSearch(
 *   '2024年人工智能发展趋势是什么？',
 *   []
 * );
 * console.log(result.finalAnswer);
 * 
 * // 示例2：仅判断是否需要搜索
 * const needsSearch = tavilyIntegration.shouldSearch('今天天气怎么样？');
 * console.log(needsSearch); // true
 * 
 * // 示例3：仅执行搜索
 * const searchResult = await tavilyIntegration.searchOnly('人工智能最新新闻');
 * console.log(searchResult.context);
 */