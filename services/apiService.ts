import gatewayConfig from "../config/gateway_config.json";

/**
 * 获取代理 URL
 * 所有请求都通过后端代理，前端不直接接触 API Key
 */
export const getProxiedUrl = (url: string, useOpenaiPath: boolean = false): string => {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const base = isDev ? '/architect' : 'https://api.kbitai.com.cn';
  const gateways = (gatewayConfig as any).gateways || {};

  for (const [key, config] of Object.entries(gateways)) {
    const gatewayConfig = config as any;
    if (gatewayConfig.url && gatewayConfig.proxy_path) {
      if (url.startsWith(gatewayConfig.url)) {
        if (useOpenaiPath) {
          let pathSuffix = '';
          if (url.includes('/v1/')) {
            pathSuffix = url.replace(gatewayConfig.url + '/v1/', '');
          } else {
            const urlObj = new URL(url);
            pathSuffix = urlObj.pathname.replace(/^\//, '');
          }
          if (!pathSuffix || pathSuffix === '/') {
            return `${base}${gatewayConfig.proxy_path}/openai/v1`;
          }
          return `${base}${gatewayConfig.proxy_path}/openai/v1/${pathSuffix}`;
        }
        return url.replace(gatewayConfig.url, `${base}${gatewayConfig.proxy_path}`);
      }
    }
  }

  if (url.includes('ph8.co')) {
    if (useOpenaiPath) {
      let pathSuffix = '';
      if (url.includes('/v1/')) {
        pathSuffix = url.replace('https://ph8.co/v1/', '');
      } else {
        const urlObj = new URL(url);
        pathSuffix = urlObj.pathname.replace(/^\//, '');
      }
      // 如果路径后缀为空或只有斜杠，返回基础路径
      if (!pathSuffix || pathSuffix === '/') {
        return `${base}/api/ph8/openai/v1`;
      }
      return `${base}/api/ph8/openai/v1/${pathSuffix}`;
    }
    return url.replace('https://ph8.co', `${base}/api/ph8`);
  }

  if (url.includes('api.kbitai.com.cn')) {
    return url.replace('https://api.kbitai.com.cn', base);
  }

  return url;
};

/**
 * 带自动重试的 fetch 函数
 * 用于处理服务器繁忙等临时性错误
 * 
 * @param url 请求URL
 * @param options fetch选项
 * @param maxRetries 最大重试次数（默认3次）
 * @returns Response对象
 */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // 如果响应正常，直接返回
      if (response.ok) {
        return response;
      }
      
      // 对于可重试的错误状态码，进行重试
      const isRetryable = [502, 503, 504].includes(response.status);
      
      if (isRetryable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 指数退避：1s, 2s, 4s
        console.warn(`[重试机制] HTTP ${response.status}，第 ${attempt + 1} 次重试，等待 ${delay/1000} 秒...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 不可重试的错误，直接返回响应（让调用方处理错误）
      return response;
      
    } catch (err: any) {
      lastError = err;
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[重试机制] 网络错误：${err.message}，第 ${attempt + 1} 次重试，等待 ${delay/1000} 秒...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // 所有重试都失败，抛出最后一个错误
  throw lastError || new Error('请求失败，已达到最大重试次数');
};

// 模型映射
const MODEL_MAPPING: Record<string, string> = {
  'KbitAi-Pro': 'gemini-3-pro-preview',
  'KbitAi-Flash': 'gemini-3-flash-preview',
  'KbitAi-Image': 'gemini-3.1-flash-image-preview',
  'KbitAi-Lite': 'gemini-1.5-flash'
};

let useThirdPartyGateway = false;

// 更新网关模式
export const updateGatewayMode = (enabled: boolean) => {
  const oldValue = useThirdPartyGateway;
  useThirdPartyGateway = enabled;
  console.log(`%c[GeminiService] 网关模式已更新: ${oldValue} -> ${enabled}`, 'color: #4f46e5; font-weight: bold; font-size: 14px;');
  console.log(`%c[GeminiService] 当前 useThirdPartyGateway = ${useThirdPartyGateway}`, 'color: #f59e0b; font-weight: bold; font-size: 14px;');
};

// 获取AI实例
export const getAI = (modelConfig?: any, targetModelId?: string) => {
  console.log(`%c[getAI] useThirdPartyGateway = ${useThirdPartyGateway}`, 'color: #f59e0b; font-weight: bold;');
  
  let apiKey = (modelConfig && !modelConfig.isOfficial && modelConfig.apiKey) 
    ? modelConfig.apiKey 
    : getNextApiKey(); // 使用循环API Key
  
  let baseUrl = (modelConfig && !modelConfig.isOfficial && modelConfig.baseUrl) 
    ? modelConfig.baseUrl 
    : undefined;

  let effectiveModelId = targetModelId;
  let providerName = "Google Official";
  let selectedNode = null;

  // 如果有目标模型，尝试从配置文件中获取节点信息
  if (targetModelId) {
    const modelNodes = (gatewayConfig.models as any)[targetModelId];
    if (modelNodes) {
      // 根据模式选择节点
      let targetNodes: any[] = [];
      
      if (useThirdPartyGateway) {
        // 第三方网关模式：选择非官方节点
        targetNodes = modelNodes.filter((n: any) => n.provider !== "Google Cloud" && n.active);
      } else {
        // 官网模式：选择所有活跃节点（包括第三方站）
        targetNodes = modelNodes.filter((n: any) => n.active);
      }
      
      if (targetNodes.length > 0) {
        selectedNode = targetNodes.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))[0];
        
        if (selectedNode) {
          baseUrl = selectedNode.url;
          providerName = selectedNode.provider;
          if (selectedNode.remoteModelId) {
            effectiveModelId = selectedNode.remoteModelId;
          }
          // 从网关配置中获取 API Key（支持多网关）
          const gateways = (gatewayConfig as any).gateways || {};
          const gatewayKey = Object.keys(gateways).find(key => 
            gateways[key].name === providerName || 
            gateways[key].url === baseUrl
          );
          
          if (gatewayKey && gateways[gatewayKey]?.api_key) {
            apiKey = gateways[gatewayKey].api_key;
          } else {
            // 兼容旧配置：如果是 ph8.co 节点，从 api_keys 中获取
            if (providerName === "ph8.co") {
              const ph8Key = (gatewayConfig.api_keys as any)?.ph8;
              if (ph8Key) {
                apiKey = ph8Key;
              }
            }
          }
        }
      }
    }
  }
  
  // 强力审计日志：在控制台以醒目颜色输出
  console.log(
    `%c[路由审计] 模式: ${useThirdPartyGateway ? '商业/网关' : '开发/官方'} | 节点: ${providerName} | 目标: ${effectiveModelId} | 地址: ${baseUrl || '默认官方'}`, 
    `color: ${useThirdPartyGateway ? '#4f46e5' : '#10b981'}; font-weight: bold; border: 1px solid ${useThirdPartyGateway ? '#4f46e5' : '#10b981'}; padding: 2px 6px; border-radius: 4px;`
  );
  
  const config: any = { apiKey };
  if (baseUrl) {
    config.baseUrl = baseUrl;
  }
  
  return { 
    apiKey,
    baseUrl,
    effectiveModelId: effectiveModelId || targetModelId,
    providerName,
    selectedNode
  };
};

// 获取模型名称
export const getModelName = (modelConfig: any, defaultModel: string) => {
  // 商业模式下，直接使用 defaultModel（通过 ph8 网关）
  if (useThirdPartyGateway) {
    return defaultModel;
  }
  if (!modelConfig) return defaultModel;
  if (modelConfig.isOfficial) {
    return MODEL_MAPPING[modelConfig.modelId] || defaultModel;
  }
  return modelConfig.modelId || defaultModel;
};

// 检查是否使用第三方网关
export const isUsingThirdPartyGateway = (): boolean => {
  return useThirdPartyGateway;
};
