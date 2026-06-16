import { GoogleGenAI } from "@google/genai";
import { CustomModel } from "../types.ts";
import { getProxiedUrl } from "./geminiService"; // [优化修复] 统一使用 geminiService 导出
import { fetchWithRetry } from "./apiService.ts"; // fetchWithRetry 保留在 apiService
import { GeminiService } from "./geminiService.ts";

// 聊天服务 - 处理所有与AI对话相关的功能

const isUsingThirdPartyGateway = () => {
  return (GeminiService as any).isUsingThirdPartyGateway?.() ?? true;
};

// 系统预设配置
export const DEFAULT_SYSTEM_PRESETS = {
  CREATIVE_CONSULTANT: `你是匡形无界开发的首席图像架构师，你是用户的创意设计顾问。

【品牌回答规则】
1. 当用户问"你是谁"、"你是什么"、"谁开发的你"等问题时：
   - 回答："我是匡形无界开发的首席图像架构师，我是你的创意设计顾问"
   - 禁止提及任何厂商名称（如Google、DeepSeek等）

2. 当用户问"你用的什么模型"、"你的模型是什么"等问题时：
   - 回答："我使用的是Kbitai合成模型"
   - 禁止提及任何原模型名称

3. 回答上述问题后，必须加一句：
   "我们的理念是：设计有形，科技无界！"

4. 然后继续回答用户的其他问题或提供帮助。

支持多模态分析，协助建筑、产品、艺术及角色设计。

【回复风格规则】
- 禁止在回复中使用任何 emoji 表情符号
- 保持专业、简洁的文字表达`,

  PROMPT_SPECIALIST: `你是一位全领域顶级创意指令专家。根据当前 [Creative Domain] 将用户意图转化为高端渲染指令.
输出严格 JSON 格式：{ "zh": "...", "en": "...", "analysis": "..." }。
在分析中，请从构图、材质、光影、专业术语四个维度进行极简审计。要求：字数严控在 50 字以内，使用短句或 Bullet Points，严禁废话以节省 Token。`,

  VISUAL_ANALYST: `你是一位顶级视觉基因审计专家。请对上传图像进行深度解构，输出一份结构严谨、术语专业的视觉分析报告。
报告必须包含以下维度：
1. [构图逻辑]：分析透视、比例及视觉重心。
2. [材质细节]：解构表面纹理、CMF特征及触感表现。
3. [光影氛围]：分析光源布局、色温及情绪表达。
4. [领域特征]：识别其所属设计流派或专业技术特征。
5. [专家建议]：提供如何复刻或改良该视觉基因的专业建议。
要求：使用 Markdown 格式，语言精炼且富有洞察力。`,
};

// 模型映射
const MODEL_MAPPING: Record<string, string> = {
  'KbitAi-Pro': 'gemini-3-pro-preview',
  'KbitAi-Flash': 'gemini-3-flash-preview',
  'KbitAi-Image': 'gemini-3.1-flash-image-preview',
  'KbitAi-Lite': 'gemini-1.5-flash'
};

// Token 报告处理器
let tokenReportHandler: ((usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void) | null = null;

export const setTokenReportHandler = (handler: typeof tokenReportHandler) => {
  tokenReportHandler = handler;
};

// 发送聊天消息
export const sendChatMessage = async (
  message: string,
  modelConfig: CustomModel,
  systemInstruction: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = [],
  options: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  } = {}
): Promise<{ text: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> => {
  try {
    const modelId = MODEL_MAPPING[modelConfig.modelId] || modelConfig.modelId;
    
    // 构建消息历史
    const contents = [
      ...history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    // 如果使用第三方网关
    if (isUsingThirdPartyGateway()) {
      const url = getProxiedUrl('https://wellai.cc/v1/chat/completions', true);
      
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemInstruction },
            ...contents.map(c => ({
              role: c.role,
              content: c.parts[0].text
            }))
          ],
          temperature: options.temperature ?? 0.7,
          top_p: options.topP ?? 0.9,
          max_tokens: options.maxTokens ?? 4096,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      
      // 报告 Token 使用情况
      if (data.usage && tokenReportHandler) {
        tokenReportHandler({
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        });
      }

      return {
        text: data.choices?.[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };
    }

    // 使用官方 API
    const apiKey = ''; // 由后端管理
    const genAI = new GoogleGenAI({ apiKey });
    
    const model = genAI.models.generateContent({
      model: modelId,
      contents,
      config: {
        systemInstruction,
        temperature: options.temperature ?? 0.7,
        topP: options.topP ?? 0.9,
        maxOutputTokens: options.maxTokens ?? 4096,
      }
    });

    const result = await model;
    const text = result.text || '';

    // 估算 Token 使用量
    const estimatedPromptTokens = Math.ceil(message.length / 4);
    const estimatedCompletionTokens = Math.ceil(text.length / 4);
    
    if (tokenReportHandler) {
      tokenReportHandler({
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens
      });
    }

    return {
      text,
      usage: {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens
      }
    };

  } catch (error: any) {
    console.error('[ChatService] 发送消息失败:', error);
    throw new Error(`聊天请求失败: ${error.message}`);
  }
};

// 流式聊天
export const sendChatMessageStream = async (
  message: string,
  modelConfig: CustomModel,
  systemInstruction: string,
  onChunk: (chunk: string) => void,
  history: Array<{ role: 'user' | 'model'; text: string }> = [],
  options: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  } = {}
): Promise<{ usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> => {
  try {
    const modelId = MODEL_MAPPING[modelConfig.modelId] || modelConfig.modelId;
    
    // 构建消息历史
    const messages = [
      { role: 'system', content: systemInstruction },
      ...history.map(h => ({
        role: h.role,
        content: h.text
      })),
      {
        role: 'user',
        content: message
      }
    ];

    const url = getProxiedUrl('https://wellai.cc/v1/chat/completions', true);
    
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 0.9,
        max_tokens: options.maxTokens ?? 4096,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                onChunk(content);
              }
              
              // 获取 usage 信息
              if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0
                };
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    // 报告 Token 使用情况
    if (usage && tokenReportHandler) {
      tokenReportHandler(usage);
    }

    return { usage };

  } catch (error: any) {
    console.error('[ChatService] 流式发送失败:', error);
    throw new Error(`流式聊天请求失败: ${error.message}`);
  }
};
