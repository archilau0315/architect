import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";
import { CustomModel, CreativeDomain } from "../types.ts";
import gatewayConfig from "../config/gateway_config.json";

/**
 * 获取当前登录用户ID（统一入口，供所有API请求使用）
 * 优先级：user_id(下划线) > userId(驼峰) > email > guest
 */
export const getCurrentUserId = (): string => {
  try {
    const sessionData = localStorage.getItem('architect-invite-session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      return parsed.user_id || parsed.userId || parsed.email || 'guest';
    }
  } catch (e) {
    console.error('[getCurrentUserId] 解析用户会话失败:', e);
  }
  return 'guest';
};

/**
 * 获取代理 URL
 * 所有请求都通过后端代理，前端不直接接触 API Key
 * [优化修复] 改为导出函数，供其他模块复用（消除与 apiService 的重复）
 */
export const getProxiedUrl = (url: string, useOpenaiPath: boolean = false): string => {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  // 【修复】生产环境使用空字符串前缀，生成的URL如：
  //   /api/ph8/openai/v1/images/generations → 匹配 www.kbitai.com.cn Nginx的 location /api/ph8/ 规则（第113行）
  //   而非 /architect/api/ph8/...（会被SPA规则拦截返回405）或 https://api.kbitai.com.cn/...（跨域CORS错误）
  const base = '';
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
      if (!pathSuffix || pathSuffix === '/') {
        return `${base}/api/ph8/openai/v1`;
      }
      return `${base}/api/ph8/openai/v1/${pathSuffix}`;
    }
    return url.replace('https://ph8.co', `${base}/api/ph8`);
  }

  return url;
};

// 多颜色遮罩定义
const MASK_COLORS = [
  { name: 'white', rgb: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF' },
  { name: 'red', rgb: { r: 255, g: 0, b: 0 }, hex: '#FF0000' },
  { name: 'green', rgb: { r: 0, g: 255, b: 0 }, hex: '#00FF00' },
  { name: 'blue', rgb: { r: 0, g: 0, b: 255 }, hex: '#0000FF' },
  { name: 'yellow', rgb: { r: 255, g: 255, b: 0 }, hex: '#FFFF00' },
  { name: 'cyan', rgb: { r: 0, g: 255, b: 255 }, hex: '#00FFFF' },
];

// 检测遮罩中存在的颜色（单次遍历所有像素，同时匹配所有颜色）
const detectMaskColors = async (maskDataUrl: string): Promise<typeof MASK_COLORS> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx!.drawImage(img, 0, 0);

      const data = ctx!.getImageData(0, 0, canvas.width, canvas.height).data;
      const tolerance = 30;
      const found = new Set<string>();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        for (const c of MASK_COLORS) {
          if (!found.has(c.name) &&
              Math.abs(r - c.rgb.r) <= tolerance &&
              Math.abs(g - c.rgb.g) <= tolerance &&
              Math.abs(b - c.rgb.b) <= tolerance) {
            found.add(c.name);
          }
        }
        if (found.size === MASK_COLORS.length) break; // 全部找到，提前退出
      }

      resolve(MASK_COLORS.filter(c => found.has(c.name)));
    };

    img.src = maskDataUrl;
  });
};

// 把彩色遮罩叠加到底图上（半透明显示，用于语义遮盖方式）
const overlayMaskOnBaseImage = async (baseImageDataUrl: string, maskDataUrl: string, opacity: number = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    const baseImg = new Image();
    baseImg.onload = () => {
      const maskImg = new Image();
      maskImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(baseImageDataUrl);
          return;
        }
        
        // 1. 先绘制底图
        ctx.drawImage(baseImg, 0, 0);
        
        // 2. 在底图上叠加遮罩（半透明）
        ctx.globalAlpha = opacity;
        ctx.drawImage(maskImg, 0, 0, baseImg.width, baseImg.height);
        ctx.globalAlpha = 1.0;
        
        // 3. 输出为 JPEG
        const resultDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        console.log(`[语义遮盖] 已将遮罩叠加到底图，尺寸: ${canvas.width}x${canvas.height}`);
        resolve(resultDataUrl);
      };
      maskImg.onerror = () => {
        console.error('[语义遮盖] 遮罩图片加载失败');
        resolve(baseImageDataUrl);
      };
      maskImg.src = maskDataUrl;
    };
    baseImg.onerror = () => {
      console.error('[语义遮盖] 底图加载失败');
      resolve(baseImageDataUrl);
    };
    baseImg.src = baseImageDataUrl;
  });
};

// API Key 管理 - 已由后端接管，前端不直接持有任何 Key
const getNextApiKey = (): string => '';
const markApiKeyAsInactive = (_key: string): void => {};

// 底图缓存管理
interface BaseImageCache {
  cacheId: string;
  base64: string;
  model: string;
  createdAt: number;
  ttl: number; // 有效期（毫秒）
}

const baseImageCaches: Map<string, BaseImageCache> = new Map();
const BASE_IMAGE_CACHE_MAX_SIZE = 20; // [性能修复] 缓存上限，防止内存无限增长

// 生成底图缓存键
const generateBaseImageCacheKey = (base64: string, model: string): string => {
  return `base_image:${model}:${btoa(base64.substring(0, 1000))}`;
};

// 检查底图缓存是否有效
const getValidBaseImageCache = (base64: string, model: string): BaseImageCache | null => {
  const key = generateBaseImageCacheKey(base64, model);
  const cache = baseImageCaches.get(key);
  
  if (!cache) return null;
  
  const now = Date.now();
  if (now > cache.createdAt + cache.ttl) {
    baseImageCaches.delete(key);
    return null;
  }
  
  return cache;
};

// 设置底图缓存（带 LRU 淘汰策略，防止内存泄漏）
const setBaseImageCache = (base64: string, model: string, cacheId: string, ttl: number): void => {
  const key = generateBaseImageCacheKey(base64, model);
  
  // [性能修复] 达到上限时淘汰最旧的条目
  if (baseImageCaches.size >= BASE_IMAGE_CACHE_MAX_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    baseImageCaches.forEach((val, k) => {
      if (val.createdAt < oldestTime) {
        oldestTime = val.createdAt;
        oldestKey = k;
      }
    });
    if (oldestKey) {
      baseImageCaches.delete(oldestKey);
    }
  }
  
  baseImageCaches.set(key, {
    cacheId,
    base64,
    model,
    createdAt: Date.now(),
    ttl
  });
};

export interface ImageGenerationConfig {
  aspectRatio: string; 
  imageSize: "1K" | "2K" | "4K";
  modelTier?: "FAST" | "QUALITY";
  imageCount?: number;
  temperature?: number;
  top_p?: number;
}

export interface EnhancedPrompt {
  zh: string;
  en: string;
  analysis: string; 
}

/**
 * 带自动重试的 fetch 函数
 * 用于处理服务器繁忙等临时性错误
 * 
 * @param url 请求URL
 * @param options fetch选项
 * @param maxRetries 最大重试次数（默认3次）
 * @returns Response对象
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> => {
  // 统一注入用户ID到所有API请求，确保后端能正确记录日志
  const currentUserId = getCurrentUserId();
  if (!options.headers) {
    options.headers = {};
  }
  (options.headers as Record<string, string>)['x-user-id'] = currentUserId;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // 如果响应正常，直接返回
      if (response.ok) {
        return response;
      }
      
      // 对于可重试的错误状态码，进行重试
      const isRetryable = [429, 502, 503, 504].includes(response.status);

      if (isRetryable && attempt < maxRetries) {
        const delay = response.status === 429 ? Math.pow(2, attempt) * 3000 : Math.pow(2, attempt) * 1000; // 429 用更长延迟
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

const STATIC_QUALITY_SUFFIX = ", masterpiece, 8k resolution, highly detailed, professional lighting, sharp focus";

export const DEFAULT_SYSTEM_PRESETS = {
  IMAGE_ENGINE_ARCHITECTURE: `Kuanform Arch Engine. Focus: structural integrity, spatial logic, PBR. Use: Parametric, Brutalist, Minimalism.`,
  
  IMAGE_ENGINE_PRODUCT: `Kbit Product Engine. Focus: CMF, ergonomics, studio lighting, photorealism. Feasibility & geometric forms.`,
  
  IMAGE_ENGINE_ART: `Kbit Art Engine. Focus: Composition, color, branding, posters. Visual impact & style consistency.`,

  IMAGE_ENGINE_CHARACTER: `Kbit Character Engine. Focus: Anatomy, costumes, cinematic lighting. Silhouette & AAA concept art.`,

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
};

export const MASTER_STYLES = [
  // 建筑领域 (18位)
  { name: '扎哈·哈迪德 Zaha Hadid (流体曲线)', logic: 'Fluid curves, parametric complexity, futuristic fragmentation.', domain: 'architecture' },
  { name: '安藤忠雄 Tadao Ando (清水混凝土)', logic: 'Pure concrete, light and shadow play, geometric simplicity.', domain: 'architecture' },
  { name: '勒·柯布西耶 Le Corbusier (功能主义)', logic: 'Five points of architecture, brutalism, functionalism.', domain: 'architecture' },
  { name: '密斯·凡·德·罗 Mies van der Rohe (少即是多)', logic: 'Less is more, glass and steel, universal space.', domain: 'architecture' },
  { name: '弗兰克·劳埃德·赖特 Frank Lloyd Wright (有机建筑)', logic: 'Organic architecture, prairie style, horizontal lines.', domain: 'architecture' },
  { name: '伦佐·皮亚诺 Renzo Piano (高技结构)', logic: 'High-tech architecture, structural expressionism, lightness.', domain: 'architecture' },
  { name: '诺曼·福斯特 Norman Foster (工业高技)', logic: 'High-tech efficiency, steel and glass, sleek industrial aesthetic.', domain: 'architecture' },
  { name: '雷姆·库哈斯 Rem Koolhaas (解构主义)', logic: 'Deconstructivism, conceptual complexity, bold urban forms.', domain: 'architecture' },
  { name: '隈研吾 Kengo Kuma (负建筑)', logic: 'Wood materiality, rhythmic patterns, blending with nature.', domain: 'architecture' },
  { name: '比雅克·英格斯 Bjarke Ingels (实用乌托邦)', logic: 'Hedonistic sustainability, pragmatism, big bold diagrams.', domain: 'architecture' },
  { name: '让·努维尔 Jean Nouvel (光影幻境)', logic: 'Cultural context, play of light and transparency.', domain: 'architecture' },
  { name: '阿尔瓦罗·西扎 Alvaro Siza (诗意极简)', logic: 'Poetic minimalism, white planes, sculptural simplicity.', domain: 'architecture' },
  { name: '彼得·卒姆托 Peter Zumthor (感官氛围)', logic: 'Atmospheric phenomenology, material honesty, quiet power.', domain: 'architecture' },
  { name: '路易·康 Louis Kahn (几何永恒)', logic: 'Monumental weight, play of light, geometric purity.', domain: 'architecture' },
  { name: '赫尔佐格和德梅隆 Herzog & de Meuron (材质创新)', logic: 'Innovative skins, material experimentation, conceptual clarity.', domain: 'architecture' },
  { name: '妹岛和世与西泽立卫 SANAA (轻盈透明)', logic: 'Ethereal lightness, transparent boundaries, abstract purity.', domain: 'architecture' },
  { name: '理查德·迈耶 Richard Meier (纯白数学)', logic: 'Pure white geometry, mathematical order, play of shadow.', domain: 'architecture' },
  { name: '安东尼·高迪 Antoni Gaudi (自然有机)', logic: 'Organic curves, nature-inspired geometry, kaleidoscopic mosaics.', domain: 'architecture' },

  // 产品领域 (12位)
  { name: '迪特·拉姆斯 Dieter Rams (设计十诫)', logic: 'Minimalism, functionalism, "Less but better" principle.', domain: 'product' },
  { name: '乔尼·艾夫 Jony Ive (一体化极简)', logic: 'Aluminum unibody, seamless integration, clean surfaces.', domain: 'product' },
  { name: '菲利普·斯塔克 Philippe Starck (情感趣味)', logic: 'Democratic design, playful CEO, organic innovation.', domain: 'product' },
  { name: '深泽直人 Naoto Fukasawa (无意识设计)', logic: 'Without thought, ergonomic simplicity, daily life harmony.', domain: 'product' },
  { name: '凯瑞姆·瑞席 Karim Rashid (感官极简)', logic: 'Sensual minimalism, vibrant colors, futuristic plastic curves.', domain: 'product' },
  { name: '马克·纽森 Marc Newson (流线生物)', logic: 'Biomorphism, smooth continuous surfaces, aerospace influence.', domain: 'product' },
  { name: '帕特里夏·奥奇拉 Patricia Urquiola (触感工艺)', logic: 'Tactile richness, blend of craft and industry.', domain: 'product' },
  { name: '詹姆斯·戴森 James Dyson (硬核工程)', logic: 'Engineering lead, visible mechanism, high-tech industrial.', domain: 'product' },
  { name: '维纳·潘顿 Verner Panton (波普色彩)', logic: 'Pop art furniture, psychedelic colors, futuristic plastics.', domain: 'product' },
  { name: '伊姆斯 Eames (胶合板优雅)', logic: 'Plywood experimentation, functional elegance, timeless comfort.', domain: 'product' },
  { name: '贾斯珀·莫里森 Jasper Morrison (超级平凡)', logic: 'Super normal, understated utility, quiet design.', domain: 'product' },
  { name: '乔治亚罗 Giorgetto Giugiaro (折纸棱角)', logic: 'Automotive edge, wedge shape, Italian aerodynamic elegance.', domain: 'product' },

  // 艺术领域 (12位)
  { name: '草间弥生 Yayoi Kusama (波点幻觉)', logic: 'Polka dots, infinity nets, repetitive patterns.', domain: 'art' },
  { name: '班克西 Banksy (讽刺街头)', logic: 'Stencil graffiti, satirical street art, high contrast.', domain: 'art' },
  { name: '安迪·沃霍尔 Andy Warhol (商业复制)', logic: 'Pop art, screen print aesthetic, vibrant duplication.', domain: 'art' },
  { name: '皮特·蒙德里安 Piet Mondrian (几何格子)', logic: 'Primary colors, black grids, absolute abstraction.', domain: 'art' },
  { name: '萨尔瓦多·达利 Salvador Dalí (梦境写实)', logic: 'Surrealism, dream-like distortion, melting precision.', domain: 'art' },
  { name: '凯斯·哈林 Keith Haring (动感符号)', logic: 'Line art, kinetic figures, bold graphic simplicity.', domain: 'art' },
  { name: '杰克逊·波洛克 Jackson Pollock (行动滴画)', logic: 'Action painting, drip technique, abstract energy.', domain: 'art' },
  { name: '雷内·马格利特 René Magritte (错置写实)', logic: 'Surreal juxtaposition, mysterious realism, conceptual art.', domain: 'art' },
  { name: '大卫·霍克尼 David Hockney (明快拼贴)', logic: 'Vibrant pools, pop landscape, flat perspective art.', domain: 'art' },
  { name: '让-米歇尔·巴斯奎特 Jean-Michel Basquiat (涂鸦表现)', logic: 'Neo-expressionism, raw street power, symbolic chaos.', domain: 'art' },
  { name: '村上隆 Takashi Murakami (超扁平)', logic: 'Superflat, otaku culture, colorful anime synthesis.', domain: 'art' },
  { name: '爱德华·霍普 Edward Hopper (都市寂寞)', logic: 'Modern isolation, dramatic light and shadow, cinematic realism.', domain: 'art' },

  // 角色领域 (12位)
  { name: '宫崎英高 Hidetaka Miyazaki (碎片叙事)', logic: 'Dark fantasy, gothic details, melancholic atmosphere.', domain: 'character' },
  { name: '新川洋司 Yoji Shinkawa (笔墨写意)', logic: 'Brush stroke ink, mechanical-organic hybrid, tactical gear.', domain: 'character' },
  { name: 'H.R. 吉格尔 H.R. Giger (生物机械)', logic: 'Biomechanical, alien textures, dark erotic surrealism.', domain: 'character' },
  { name: '墨比斯 Moebius (明晰线条)', logic: 'Clear line, sci-fi landscape, visionary costume design.', domain: 'character' },
  { name: '天野喜孝 Yoshitaka Amano (纤细唯美)', logic: 'Ethereal elegance, flowy lines, delicate fantasy aesthetic.', domain: 'character' },
  { name: '宫崎骏 Hayao Miyazaki (童真自然)', logic: 'Hand-drawn charm, steampunk elements, whimsical nature.', domain: 'character' },
  { name: '席德·米德 Syd Mead (未来都市)', logic: 'Futuristic industrial design, visual futurism, glowing nightscapes.', domain: 'character' }
];

const MODEL_MAPPING: Record<string, string> = {
  'KbitAi-Pro': 'gemini-3-pro-preview',
  'KbitAi-Flash': 'gemini-3-flash-preview',
  'KbitAi-Image': 'gemini-3.1-flash-image-preview',
  'KbitAi-Lite': 'gemini-1.5-flash'
};

let useThirdPartyGateway = false;

const updateGatewayMode = (enabled: boolean) => {
  const oldValue = useThirdPartyGateway;
  useThirdPartyGateway = enabled;
  console.log(`%c[GeminiService] 网关模式已更新: ${oldValue} -> ${enabled}`, 'color: #4f46e5; font-weight: bold; font-size: 14px;');
  console.log(`%c[GeminiService] 当前 useThirdPartyGateway = ${useThirdPartyGateway}`, 'color: #f59e0b; font-weight: bold; font-size: 14px;');
};

const getAI = (modelConfig?: CustomModel, targetModelId?: string) => {
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
          // API Key 由后端代理管理，前端不持有任何 Key
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
    ai: new GoogleGenAI(config), 
    modelId: effectiveModelId || targetModelId,
    node: selectedNode,
    apiKey
  };
};

const getModelName = (modelConfig: any, defaultModel: string) => {
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

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

type TokenReportCallback = (usage: TokenUsage) => void;
let tokenReportHandler: TokenReportCallback | null = null;

export const GeminiService = {
  setTokenReportHandler(handler: TokenReportCallback) {
    tokenReportHandler = handler;
  },

  reportTokens(usage?: any) {
    if (usage && tokenReportHandler) {
      const prompt = usage.promptTokenCount || 0;
      const completion = usage.candidatesTokenCount || 0;
      tokenReportHandler({
        promptTokens: prompt,
        completionTokens: completion,
        totalTokens: prompt + completion
      });
    }
  },

  setGatewayMode(enabled: boolean) {
    updateGatewayMode(enabled);
  },

  isUsingThirdPartyGateway() {
    return useThirdPartyGateway;
  },

  getFinanceData() {
    return {
      balance: 1000,
      dailyUsage: 0,
    };
  },

  parseJsonSafely(text: string): any {
    try {
      let cleaned = text.replace(/```json\n?|```/g, "").trim();
      if (cleaned.startsWith("{") && !cleaned.endsWith("}")) {
        if (cleaned.endsWith('"')) cleaned += "}";
        else cleaned += '"}';
      }
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse error:", e, "Original text:", text);
      return {};
    }
  },

  isPermissionError(err: any): boolean {
    const msg = (err.message || "").toLowerCase();
    return msg.includes("permission") || 
           msg.includes("403") || 
           msg.includes("forbidden") || 
           msg.includes("not enabled") || 
           msg.includes("not found");
  },

  isQuotaError(err: any): boolean {
    const msg = (err.message || "").toLowerCase();
    return msg.includes("quota") || 
           msg.includes("exhausted") ||
           msg.includes("resource_exhausted");
  },

  isRateLimitError(err: any): boolean {
    const msg = (err.message || "").toLowerCase();
    return msg.includes("429") || 
           msg.includes("rate limit") ||
           msg.includes("too many requests");
  },

  formatError(err: any): string {
    const msg = (err.message || "").toLowerCase();
    if (this.isRateLimitError(err)) {
      // 频率限制 - 请求过快
      return "请求频率过快，请稍后再试（Rate Limit）。";
    }
    if (this.isQuotaError(err)) {
      // 配额耗尽
      if (useThirdPartyGateway) {
        return "API 额度已耗尽，请检查第三方服务商余额或稍后再试。";
      } else {
        return "Google API 配额已耗尽，请检查 API Key 配额或稍后再试。";
      }
    }
    if (this.isPermissionError(err)) {
      return "API 访问权限被拒绝，请检查 API Key 是否有效或模型是否已启用。";
    }
    return err.message || "未知 API 错误";
  },

  async compressImage(dataUrl: string, maxSize: number = 1024, quality: number = 0.85): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const max = maxSize;
        
        if (width > max || height > max) {
          if (width > height) {
            height = Math.round(height * (max / width));
            width = max;
          } else {
            width = Math.round(width * (max / height));
            height = max;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  },

  async applyWatermark(base64: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(base64);

        // 1. 绘制原图
        ctx.drawImage(img, 0, 0);

        // 2. 绘制 Logo 水印 (左下角)
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.onload = () => {
          const logoWidth = canvas.width * 0.15; // 占宽度的 15%
          const logoHeight = (logo.height / logo.width) * logoWidth;
          ctx.globalAlpha = 0.5; // 50%透明度
          ctx.drawImage(logo, 20, canvas.height - logoHeight - 20, logoWidth, logoHeight);
          
          // 3. 绘制文字水印 (右下角)
          ctx.globalAlpha = 0.5;
          const fontSize = Math.max(12, canvas.width * 0.02);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = "white";
          ctx.textAlign = "right";
          const timestamp = new Date().toISOString().split('T')[0];
          const text = `AI Generated | Chief Image Architect | ${timestamp}`;
          ctx.fillText(text, canvas.width - 20, canvas.height - 20);
          
          resolve(canvas.toDataURL("image/png"));
        };
        logo.onerror = () => {
          // 如果 Logo 加载失败，仅绘制文字
          ctx.globalAlpha = 0.5;
          const fontSize = Math.max(12, canvas.width * 0.02);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = "white";
          ctx.textAlign = "right";
          ctx.fillText("AI Generated | Chief Image Architect", canvas.width - 20, canvas.height - 20);
          resolve(canvas.toDataURL("image/png"));
        };
        logo.src = "/public/LOGOkbitwater.png";
      };
      img.src = base64;
    });
  },

  async enhancePrompt(idea: string, domain: CreativeDomain, instructions: any, modelConfig: any, signal?: AbortSignal): Promise<EnhancedPrompt> {
    const defaultModel = useThirdPartyGateway ? "deepseek-v3.2" : "gemini-1.5-flash";
    const requestedModel = getModelName(modelConfig, defaultModel);
    const { ai, modelId, node, apiKey } = getAI(modelConfig, requestedModel);
    
    const systemInstruction = instructions.PROMPT_SPECIALIST;
    const userPrompt = `[Creative Domain]: ${domain}\n[User Idea]: ${idea}`;

    // 如果是非官方节点且不是 Google Cloud，尝试使用 OpenAI 协议
    if (node && node.provider !== "Google Cloud") {
      try {
        const proxiedUrl = getProxiedUrl(node.url);
        const response = await fetch(`${proxiedUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // Authorization 头由后端代理自动添加
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            max_tokens: 512,
            stop: ["}"]
          }),
          signal
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error?.message || response.statusText;
          throw new Error(`Gateway Error: ${errorMsg} (Status: ${response.status})`);
        }
        const data = await response.json();
        const text = data.choices[0].message.content;
        return this.parseJsonSafely(text || '{}');
      } catch (err: any) {
        console.error("Gateway Text Error:", err);
        throw new Error(`[商业模式故障] 提示词增强异常: ${err.message}`);
      }
    }

    try {
      const genConfig: any = {
        systemInstruction: systemInstruction,
        maxOutputTokens: 1024,
      };
      if (modelId?.includes("gemini-3")) {
        genConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      const response = await ai.models.generateContent({
        model: modelId!,
        contents: userPrompt,
        config: genConfig,
      });
      this.reportTokens(response.usageMetadata);
      return this.parseJsonSafely(response.text || '{}');
    } catch (err: any) {
      if (this.isPermissionError(err) && modelId?.includes("pro")) {
        console.warn("Pro model failed, falling back to Flash for enhancement...");
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: userPrompt,
          config: { 
            systemInstruction: systemInstruction,
            maxOutputTokens: 512
          },
        });
        this.reportTokens(fallbackResponse.usageMetadata);
        return this.parseJsonSafely(fallbackResponse.text || '{}');
      }
      throw new Error(this.formatError(err));
    }
  },

  async generateImage(prompt: string, config: ImageGenerationConfig, isComposite: boolean, baseRefs: string[], slotARefs: string[], slotBRefs: string[], styleRefs: string[], maskB?: string, inpaintPrompt?: string, maskA?: string, instructions?: any, modelConfig?: any, signal?: AbortSignal, domain?: CreativeDomain, baseRefsOriginalSizes?: {width: number, height: number}[], isUpscale?: boolean) {
    let model = getModelName(modelConfig, "gemini-3.1-flash-image-preview");
    const tier = config.modelTier || "FAST";
    const size = config.imageSize;
    
    // 根据尺寸生成可读标签（用于提示词）
    let targetSizeLabel = '';
    if (size === '4K') targetSizeLabel = '4096px ultra-high resolution';
    else if (size === '2K') targetSizeLabel = '2048px high resolution';
    else targetSizeLabel = '1024px standard resolution';
    
    // 核心分流逻辑
    if (modelConfig?.isOfficial || !modelConfig) {
      if (useThirdPartyGateway) {
        // 商业模式矩阵 (ON)
        // 局部修改任务使用 gemini-3.1-flash-image-preview
        if (maskB && baseRefs.length > 0) {
          model = "gemini-3.1-flash-image-preview";
          console.log("[Inpainting] 使用 Flash 模型进行语义遮盖局部修改");
        }
        // 放大任务：商业模式统一使用 3.1 Flash
        else if (isUpscale) {
          model = "gemini-3.1-flash-image-preview";
          console.log("[Upscale] 使用 3.1 Flash 模型进行放大");
        }
        // 4K + QUALITY 使用 gemini-3-pro-image-preview
        else if (size === "4K" && tier === "QUALITY") {
          model = "gemini-3-pro-image-preview";
          console.log("[Image] 4K + QUALITY 模式使用 Pro 模型");
        }
        // 其他所有情况使用 gemini-3.1-flash-image-preview
        else {
          model = "gemini-3.1-flash-image-preview";
        }
      } else {
        // 开发模式 (OFF) - 默认使用 3.1 Flash
        model = "gemini-3.1-flash-image-preview";
        // 只有在强制要求 4K 时才考虑 Pro，否则保持 2.5 Flash 节省成本
        if (size === "4K") {
          model = "gemini-3-pro-image-preview";
        }
      }
    }
    
    const { ai, modelId, node, apiKey } = getAI(modelConfig, model);
    const parts: any[] = [];

    // 对所有参考图进行下采样压缩，防止请求体过大导致网关断连
    // Inpainting 任务需要更高质量的底图
    const compress = async (dataUrl: string, forInpainting: boolean = false) => {
      try {
        // Inpainting 任务使用更高分辨率（1024px）和质量（0.92）
        // 普通任务使用较低分辨率（512px）节省带宽
        const maxSize = forInpainting ? 1024 : 512;
        const quality = forInpainting ? 0.92 : 0.85;
        return (await this.compressImage(dataUrl, maxSize, quality)).split(",")[1];
      } catch (e) {
        return dataUrl.split(",")[1];
      }
    };
    
    // 检查是否有底图需要缓存
    let baseImageCacheId: string | null = null;
    let hasBaseImage = false;
    let originalImageWidth = 1024; // 原始图像宽度
    let originalImageHeight = 1024; // 原始图像高度
    
    // 如果传入了原始图像尺寸，使用传入的尺寸
    if (baseRefsOriginalSizes && baseRefsOriginalSizes.length > 0) {
      originalImageWidth = baseRefsOriginalSizes[0].width;
      originalImageHeight = baseRefsOriginalSizes[0].height;
      hasBaseImage = true;
      console.log(`使用传入的原始图像尺寸: ${originalImageWidth}x${originalImageHeight}`);
    }
    
    // 核心逻辑对位：图像放大 (Upscale)
    // 注意：baseRefs[0].includes(",") 用于检测是否为有效的 base64 data URL
    if (isUpscale && baseRefs.length > 0 && (baseRefs[0].includes(",") || baseRefs[0].startsWith("data:"))) {
      hasBaseImage = true;

      // 获取原始图像尺寸
      try {
        const img = new Image();
        const imagePromise = new Promise<{width: number, height: number}>((resolve) => {
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 1024, height: 1024 });
          img.src = baseRefs[0];
        });
        const { width, height } = await imagePromise;
        originalImageWidth = width;
        originalImageHeight = height;
        console.log(`[放大模式] 原始图像尺寸: ${width}x${height}`);
      } catch (e) {
        console.warn("[放大模式] 获取尺寸失败", e);
      }

      // 放大专用提示词 - 强调必须基于底图进行超分辨率重建
      const upscalePrompt = `[IMAGE UPSCALE TASK - CRITICAL INSTRUCTION]
You are performing a super-resolution upscaling operation on the reference image provided.
TARGET RESOLUTION: ${size} (${targetSizeLabel || 'high resolution'})
ORIGINAL IMAGE SIZE: ${originalImageWidth || 'unknown'}x${originalImageHeight || 'unknown'}

MANDATORY REQUIREMENTS:
1. This is an UPSACLE operation - you MUST use the provided reference image as the SOURCE
2. Reconstruct/enhance the EXACT same image at higher resolution
3. Preserve ALL original content: composition, objects, colors, lighting, style
4. Do NOT generate a new image - enhance the existing one
5. Improve sharpness, detail, and clarity while maintaining 100% fidelity to source
6. Output must be recognizable as an enhanced version of the input

The attached image IS the source material for this upscale operation.`;

      // 使用高质量压缩（放大需要保留更多细节）
      const upscaledImageData = await compress(baseRefs[0], true);

      parts.push({ text: upscalePrompt });
      parts.push({ inlineData: { mimeType: "image/jpeg", data: upscaledImageData } });

      console.log("[放大模式] 已准备放大请求，目标尺寸:", size, ", 底图已附加到 parts");
    }
    // 核心逻辑对位：局部重绘 (Normal Mode Inpainting) - 语义遮盖方式
    else if (maskB && baseRefs.length > 0 && (baseRefs[0].includes(",") || baseRefs[0].startsWith("data:"))) {
      hasBaseImage = true;
      
      // 在压缩之前获取原始图像的尺寸
      try {
        const img = new Image();
        const imagePromise = new Promise<{width: number, height: number}>((resolve) => {
          img.onload = () => {
            console.log(`图像加载成功，尺寸: ${img.width}x${img.height}`);
            resolve({ width: img.width, height: img.height });
          };
          img.onerror = (e) => {
            console.error("图像加载失败", e);
            resolve({ width: 1024, height: 1024 });
          };
          img.src = baseRefs[0];
          console.log(`开始加载图像，src长度: ${baseRefs[0].length}`);
        });
        
        const { width, height } = await imagePromise;
        originalImageWidth = width;
        originalImageHeight = height;
        console.log(`原始底图尺寸: ${width}x${height}`);
      } catch (e) {
        console.warn("获取原始底图尺寸失败，使用默认尺寸", e);
      }
      
      // 检测遮罩中存在的颜色
      const detectedColors = await detectMaskColors(maskB);
      console.log(`[语义遮盖] 检测到 ${detectedColors.length} 种颜色: ${detectedColors.map(c => c.name).join(', ')}`);
      
      // 语义遮盖方式：把遮罩叠加到底图上，生成一张合成图
      const overlayedImage = await overlayMaskOnBaseImage(baseRefs[0], maskB, 0.35);
      const compressedOverlay = await compress(overlayedImage, true);
      
      const inpaintInstruction = inpaintPrompt || prompt;
      
      // 构建颜色描述
      let colorDescription = '';
      if (detectedColors.length === 1) {
        const colorName = detectedColors[0].name;
        const colorNameCN = colorName === 'white' ? '白色' : 
                           colorName === 'red' ? '红色' :
                           colorName === 'green' ? '绿色' :
                           colorName === 'blue' ? '蓝色' :
                           colorName === 'yellow' ? '黄色' :
                           colorName === 'cyan' ? '青色' : colorName;
        colorDescription = `${colorNameCN}标记区域`;
      } else {
        colorDescription = '彩色标记区域';
      }
      
      // 语义遮盖提示词：通过自然语言描述修改位置
      const semanticInpaintPrompt = `请修改这张图片中【${colorDescription}】的内容：${inpaintInstruction}

【重要要求】
1. 只修改图片中${colorDescription}标记区域的内容，修改内容必须位于原标记位置
2. 图片中其他所有区域必须保持完全不变
3. 不要在最终结果中显示任何标记或遮罩
4. 严格保持原图的色彩和明暗关系，不要改变整体色调、亮度和对比度
5. 新生成的内容应与周围区域的亮度和色调保持一致
6. 输出一张完整的、自然的图片`;
      
      parts.push({ text: semanticInpaintPrompt + STATIC_QUALITY_SUFFIX });
      parts.push({ inlineData: { mimeType: "image/jpeg", data: compressedOverlay } });
      
      console.log("[语义遮盖] 已将遮罩叠加到底图，发送合成图+语义提示词");
      console.log("[语义遮盖] 提示词:", semanticInpaintPrompt.substring(0, 100) + "...");
    } 
    // 核心逻辑对位：基因重组 (A->B Synthesis)
    else if (isComposite) {
      parts.push({ text: `Merge features from A into B following this directive: ${prompt}${STATIC_QUALITY_SUFFIX}` });
      if (slotARefs.length > 0 && slotARefs[0].includes(",")) {
        parts.push({ text: "Reference A (Morphology):" });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: await compress(slotARefs[0]) } });
      }
      if (maskA && maskA.includes(",")) {
        parts.push({ text: "Mask A (Source region):" });
        parts.push({ inlineData: { mimeType: "image/png", data: maskA.split(",")[1] } });
      }
      if (slotBRefs.length > 0 && slotBRefs[0].includes(",")) {
        parts.push({ text: "Reference B (Context):" });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: await compress(slotBRefs[0]) } });
      }
      if (maskB && maskB.includes(",")) {
        parts.push({ text: "Mask B (Target region):" });
        parts.push({ inlineData: { mimeType: "image/png", data: maskB.split(",")[1] } });
      }
      for (let i = 0; i < styleRefs.length; i++) {
        const s = styleRefs[i];
        if (s.includes(",")) {
          parts.push({ text: `Style ${i+1}:` });
          parts.push({ inlineData: { mimeType: "image/jpeg", data: await compress(s) } });
        }
      }
    } 
    // 常规模式：全域渲染与风格参考
    else {
      console.log(`[常规模式] baseRefs 数量: ${baseRefs.length}, baseRefsOriginalSizes:`, baseRefsOriginalSizes);
      
      // 检测是否是建筑渲染工作流（2张底图：线稿 + 语义分割图）
      const isArchitecturalRendering = baseRefs.length >= 2 && 
                                        baseRefs[0].includes(",") && 
                                        baseRefs[1].includes(",");
      
      if (isArchitecturalRendering) {
        // 建筑渲染工作流：鸟瞰图检测 + 线稿增强 + 材质边界提取 + Agent分析 + 构图约束 + 颜色边界
        console.log("[建筑渲染工作流] 检测到线稿 + 语义分割图模式");
        
        // 获取图像尺寸
        let sketchWidth = 1024, sketchHeight = 1024;
        try {
          const img = new Image();
          const imagePromise = new Promise<{width: number, height: number}>((resolve) => {
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = () => resolve({ width: 1024, height: 1024 });
            img.src = baseRefs[0];
          });
          const dims = await imagePromise;
          sketchWidth = dims.width;
          sketchHeight = dims.height;
          originalImageWidth = sketchWidth;
          originalImageHeight = sketchHeight;
          hasBaseImage = true;
          console.log(`[建筑渲染] 原始尺寸: ${sketchWidth}x${sketchHeight}`);
        } catch (e) {
          console.warn("[建筑渲染] 获取尺寸失败", e);
        }
        
        // 简化的建筑渲染工作流：直接传递线稿和语义分割图
        // 第三方网关会使用 image 字段传递底图，更容易保持一致
        
        // 构建建筑渲染提示词
        const architecturalPrompt = `${prompt}

【建筑渲染工作流 - 必须严格遵循底图】

【重要说明】
- 第一张图片是线稿/草图，必须严格遵循其轮廓、位置、形状
- 第二张图片是语义分割图，按颜色区域分配材质：
  • 红色/粉色区域 = 砖墙、混凝土墙面
  • 绿色区域 = 草地、植被、景观绿化
  • 蓝色区域 = 天空、水面、玻璃幕墙
  • 黄色/橙色区域 = 木材、地面铺装
  • 紫色区域 = 金属材质、屋顶
  • 白色/灰色区域 = 混凝土、石材
  • 黑色区域 = 阴影、暗部区域

【绝对约束】
- 输出必须与底图完全一致
- 所有元素的位置、形状、比例必须保持
- 颜色边界必须清晰，无模糊或偏移
- 透视关系必须全局一致`;
        
        parts.push({ text: architecturalPrompt + STATIC_QUALITY_SUFFIX });
        
        // 添加线稿图片
        const lineArtData = await compress(baseRefs[0]);
        parts.push({ text: "【线稿/草图 - 必须严格遵循轮廓、位置、形状】" });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: lineArtData } });
        
        // 添加语义分割图
        const segmentationData = await compress(baseRefs[1]);
        parts.push({ text: "【语义分割图 - 颜色边界必须清晰保留】" });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: segmentationData } });
        
        console.log("[建筑渲染工作流] 完成");
      } else {
        // 普通模式：单张底图或无底图
        // 如果有底图，添加构图约束
        if (baseRefs.length > 0 && baseRefs[0].includes(",")) {
          // 获取底图尺寸
          let baseWidth = 1024, baseHeight = 1024;
          try {
            const img = new Image();
            const imagePromise = new Promise<{width: number, height: number}>((resolve) => {
              img.onload = () => resolve({ width: img.width, height: img.height });
              img.onerror = () => resolve({ width: 1024, height: 1024 });
              img.src = baseRefs[0];
            });
            const dims = await imagePromise;
            baseWidth = dims.width;
            baseHeight = dims.height;
            originalImageWidth = baseWidth;
            originalImageHeight = baseHeight;
            hasBaseImage = true;
            console.log(`[普通模式] 底图尺寸: ${baseWidth}x${baseHeight}`);
          } catch (e) {
            console.warn("[普通模式] 获取尺寸失败", e);
          }
          
          // 简化的提示词
          const simplePrompt = `${prompt}

【构图约束】
- 输出尺寸应与底图比例一致
- 保持底图的构图和布局
- 不要裁剪或改变画幅`;
          
          console.log("[普通模式] 宽高比:", baseWidth, "x", baseHeight);
          
          parts.push({ text: simplePrompt + STATIC_QUALITY_SUFFIX });
          
          // 添加底图
          for (const r of baseRefs.slice(0, 2)) {
            if (r.includes(",")) {
              const baseImageData = await compress(r);
              parts.push({ inlineData: { mimeType: "image/jpeg", data: baseImageData } });
            }
          }
        } else {
          // 无底图，使用原始提示词
          parts.push({ text: prompt + STATIC_QUALITY_SUFFIX });
        }
      }
      
      // 风格参考图
      for (const r of styleRefs.slice(0, 1)) {
        if (r.includes(",")) {
          parts.push({ inlineData: { mimeType: "image/jpeg", data: await compress(r) } });
        }
      }
    }

    const supportedRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    const safeRatio = supportedRatios.includes(config.aspectRatio) ? config.aspectRatio : "1:1";

    // 动态构建 imageConfig，确保模型兼容性
    const imageConfig: any = {};
    const isImageModel = model.includes("image") || model.includes("imagen");
    
    if (isImageModel) {
      imageConfig.aspectRatio = safeRatio;
      // 只有 Pro 级别的图像模型支持 imageSize 参数
      if (model.includes("pro")) {
        imageConfig.imageSize = config.imageSize;
      }
    }

    let response;
    
    // 计算图像尺寸（在 try 块外部定义，以便 fallback 可以访问）
    // 根据用户选择的 aspectRatio 和 imageSize 动态计算输出尺寸
    let maxSize = 1024;
    if (size === "2K") maxSize = 2048;
    else if (size === "4K") maxSize = 4096;
    
    // 根据 aspectRatio 解析比例并计算实际像素尺寸
    const ratioMap: Record<string, [number, number]> = {
      '1:1': [1, 1],
      '3:4': [3, 4], '4:3': [4, 3],
      '9:16': [9, 16], '16:9': [16, 9]
    };
    const [rw, rh] = ratioMap[safeRatio] || [1, 1];
    
    let imageSize: string;
    if (hasBaseImage) {
      const width = originalImageWidth;
      const height = originalImageHeight;
      
      let finalWidth = width;
      let finalHeight = height;
      
      // 放大模式：强制放大到目标尺寸，保持底图原始比例
      if (isUpscale) {
        const ratio = height / width;
        if (width >= height) {
          finalWidth = maxSize;
          finalHeight = Math.round(maxSize * ratio);
        } else {
          finalHeight = maxSize;
          finalWidth = Math.round(maxSize / ratio);
        }
        console.log(`[放大模式] 强制放大到目标尺寸: ${finalWidth}x${finalHeight}`);
      }
      // 普通模式：如果超过maxSize才缩小
      else if (width > maxSize || height > maxSize) {
        const ratio = height / width;
        if (width > height) {
          finalWidth = maxSize;
          finalHeight = Math.round(maxSize * ratio);
        } else {
          finalHeight = maxSize;
          finalWidth = Math.round(maxSize / ratio);
        }
      }
      
      imageSize = `${finalWidth}x${finalHeight}`;
      console.log(`底图尺寸: ${width}x${height}, 生成尺寸: ${imageSize}, 用户选择: ${size}, 最大边: ${maxSize}`);
    } else {
      // 纯文生图：根据用户选择的aspectRatio计算尺寸
      if (rw >= rh) {
        // 横图或正方图：宽度为maxSize
        imageSize = `${maxSize}x${Math.round(maxSize * rh / rw)}`;
      } else {
        // 竖图：高度为maxSize
        imageSize = `${Math.round(maxSize * rw / rh)}x${maxSize}`;
      }
      console.log(`[纯文生图] 比例:${safeRatio}, 生成尺寸: ${imageSize}`);
    }

    // 【关键修复】seedList 必须在 try 块之前声明，确保所有分支（PH8/Google/fallback/catch后return）都能访问到
    let seedList: number[] = [];

    try {
      // seedList 已在外层声明，此处仅清空以确保干净状态
      seedList = [];
      
      // 判断是否使用第三方网关格式
      // 条件：有第三方网关URL 且 (第三方网关模式 或 官网模式但provider不是Google Cloud)
      const shouldUseThirdPartyFormat = node && node.url && (
        useThirdPartyGateway || 
        (node.provider && node.provider !== "Google Cloud")
      );
      
      if (shouldUseThirdPartyFormat) {
        // 使用 Gemini 原生 API 格式（ph8 兼容）
        // 端点格式：模型id:generateContent
        const enhancedPrompt = parts.find(p => p.text)?.text || "";
        
        // 提取所有图像数据（底图和风格参考图）
        const imageParts = parts.filter(p => p.inlineData);
        
        // 获取代理后的 URL（开发环境解决 CORS）
        // 使用 useOpenaiPath: true 确保正确的路径映射
        const proxiedUrl = getProxiedUrl(node.url, true);
        
        // 详细日志输出
        console.log(`%c[图像生成请求 - Gemini原生格式]`, 'color: #4f46e5; font-weight: bold;');
        console.log(`Model: ${modelId}`);
        console.log(`Prompt: ${enhancedPrompt.substring(0, 100)}...`);
        console.log(`底图数量: ${imageParts.length}`);
        console.log(`生成尺寸: ${imageSize}`);
        
        // 打印每个 part 的类型
        parts.forEach((p, i) => {
          if (p.inlineData) {
            console.log(`part[${i}]: inlineData (图片, ${p.inlineData.mimeType}, ${p.inlineData.data.length} 字符)`);
          } else if (p.text) {
            console.log(`part[${i}]: text (${p.text.substring(0, 50)}...)`);
          }
        });

        // ph8 使用 Gemini 原生 API 格式
        const imageCount = config.imageCount || 1;
        const imageDataList: string[] = [];
        // 注意：seedList 已在外层 try 块声明为 let，此处直接使用
        
        // 检测是否是 inpainting 模式（有底图且有遮罩）
        const isInpaintingMode = imageParts.length >= 2 && maskB && !isUpscale && !isComposite;
        
        // 为每张图片发送单独请求，确保不同 seed
        for (let imgIdx = 0; imgIdx < imageCount; imgIdx++) {
          let fetchResponse: Response;
          
          // ph8 使用 /v1/images/generations 端点
          // 请求体格式：OpenAI 风格，参数平铺在顶层（无 extra_body 包装）
          // 所有底图统一使用 reference_images 字段传递（顶层，与旧版兼容）
          const dynamicTemperature = config.temperature ?? 1.0;
          const dynamicTopP = config.top_p ?? 0.95;
          
          // PH8 OpenAI 兼容格式：所有参数平铺在顶层（无 extra_body 包装）
          // 注意：只用 OpenAI 标准参数，不要混入 Gemini 原生参数（如 output_mime_type）
          // 【Seed逻辑】如果调用方传了 config.seed（锁定模式），使用固定值；否则随机
          const requestSeed = (typeof config.seed === 'number' && !isNaN(config.seed))
            ? Math.floor(config.seed) % 2147483647
            : Math.floor(Math.random() * 2147483647);
          const requestBody: any = {
            model: modelId,
            prompt: enhancedPrompt,
            size: imageSize === "1024x1024" ? "1024x1024" : imageSize,
            response_format: "b64_json",
            n: 1,
            seed: requestSeed
          };
          
          // reference_images 放在顶层，PH8 才能正确识别
          if (imageParts.length > 0) {
            requestBody.reference_images = imageParts.map((img: any) => ({
              data: img.inlineData.data,
              mime_type: img.inlineData.mimeType
            }));
            console.log(`[ph8格式] 已传递 ${imageParts.length} 张底图到 reference_images`);
          } else {
            console.warn(`[ph8格式] 警告：未检测到底图，将仅根据提示词生成图像`);
          }
          
          const endpoint = `${proxiedUrl}/images/generations`;
          
          console.log(`[ph8格式] 端点: ${endpoint}`);
          console.log(`[ph8格式] model: ${modelId}`);
          console.log(`[ph8格式] 底图数量: ${imageParts.length}`);
          console.log(`[ph8格式] requestBody:`, JSON.stringify(requestBody, null, 2).substring(0, 500));
          
          // 使用带重试机制的 fetch（fetchWithRetry 自动注入 x-user-id 头）
          fetchResponse = await fetchWithRetry(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Authorization 头由后端代理自动添加
            },
            body: JSON.stringify(requestBody),
            signal
          }, 3);  // 最多重试3次

          if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text().catch(() => '');
            console.error("[网关错误响应] HTTP Status:", fetchResponse.status, fetchResponse.statusText);
            console.error("[网关错误响应] 响应内容:", errorText);
            let errorData = {};
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              console.error("[网关错误响应] 无法解析JSON");
            }
            const errorMsg = (errorData as any)?.error?.message || (errorData as any)?.msg || fetchResponse.statusText;
            throw new Error(`Gateway Error: ${errorMsg} (Status: ${fetchResponse.status})`);
          }
          
          const data = await fetchResponse.json();
          console.log("[网关响应]", JSON.stringify(data).substring(0, 1000));
          
          // 解析响应：支持多种格式
          let imgData: string | null = null;
          
          // Gemini 原生 API 格式: { candidates: [{ content: { parts: [{ inlineData: { data } }] } }] }
          if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate?.content?.parts) {
              const imagePart = candidate.content.parts.find((p: any) => p.inlineData);
              if (imagePart?.inlineData?.data) {
                imgData = imagePart.inlineData.data;
                console.log("[Gemini 原生格式] 解析成功");
              }
            }
          }
          // OpenAI 格式: { data: [{ b64_json: "..." }] }
          else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            imgData = data.data[0]?.b64_json || data.data[0]?.url;
            if (imgData) {
              console.log("[OpenAI 格式] 解析成功");
            }
          }
          // PH8 特殊格式: { image: "base64..." } 或 { result: { image: "..." } }
          else if (data.image) {
            imgData = data.image;
            console.log("[PH8 特殊格式] 解析成功");
          }
          // 检查异步任务格式
          else if (data.job_id && !data.data) {
            console.warn("[异步任务格式] 需要轮询获取结果:", data.job_id);
            throw new Error("Async job not supported yet");
          }
          // 检查是否返回了其他格式
          else {
            console.error("[网关响应格式未知]", JSON.stringify(data));
          }
          
          if (imgData) {
            // 验证 base64 数据
            if (imgData.startsWith('data:image')) {
              imgData = imgData.split(',')[1];
            }
            imageDataList.push(imgData);
            seedList.push(requestSeed);  // 记录这张图对应的seed
          } else {
            console.error("[网关响应无法解析图像数据]", data);
          }
        }
        
        if (imageDataList.length === 0) {
          console.error("[网关响应无图像数据]");
          throw new Error("Gateway returned no image data");
        }
        
        console.log(`[多图生成] 请求 ${imageCount} 张，返回 ${imageDataList.length} 张`);

        // 使用估算的 usage 数据
        const promptTokens = Math.ceil(prompt.length / 4);
        const imageTokens = Math.ceil(imageDataList[0].length * 0.75 / 100);
        const usageMetadata = {
          promptTokenCount: promptTokens,
          candidatesTokenCount: imageTokens * imageDataList.length,
          totalTokenCount: promptTokens + imageTokens * imageDataList.length
        };
        console.log(`[Token 估算] 输入: ${promptTokens}, 输出: ${imageTokens * imageDataList.length}, 总计: ${usageMetadata.totalTokenCount}`);

        // 转换响应格式 - 支持多图
        const candidates = imageDataList.map(imgData => ({
          content: {
            parts: [{ inlineData: { mimeType: "image/png", data: imgData } }]
          }
        }));
        response = {
          candidates,
          usageMetadata
        };
      } else {
        // 构建图像生成配置，必须包含 responseModalities
        const genConfig: any = {
          responseModalities: [Modality.IMAGE],
          seed: Math.floor(Math.random() * 2147483647)
        };
        if (Object.keys(imageConfig).length > 0) {
          genConfig.imageConfig = imageConfig;
        }
        
        response = await ai.models.generateContent({
          model: modelId!,
          contents: { parts },
          config: genConfig,
        });
      }
      this.reportTokens(response.usageMetadata);
    } catch (err: any) {
      // 如果是频率限制错误，直接返回错误信息，不标记 API Key 为不可用
      if (this.isRateLimitError(err)) {
        throw new Error(this.formatError(err));
      }
      
      // 如果是配额错误，标记API Key为不可用并尝试使用下一个
      if (this.isQuotaError(err)) {
        markApiKeyAsInactive(apiKey);
        console.warn(`API Key 配额耗尽，尝试使用下一个API Key...`);
        
        // 获取下一个可用的 API key
        const nextKey = getNextApiKey();
        if (nextKey && nextKey !== apiKey) {
          console.log(`切换到新的 API Key...`);
          const { ai: newAi, modelId: newModelId, node: newNode, apiKey: newApiKey } = getAI(modelConfig, model);
          
          try {
            if (newNode && newNode.provider !== "Google Cloud") {
              const fallbackPrompt = parts.find(p => p.text)?.text || "";
              const fallbackImageParts = parts.filter(p => p.inlineData);
            
              // 构建请求 - 使用 reference_images 字段传递底图
              const hasFallbackBaseImage = fallbackImageParts.length > 0;
              const fallbackApiEndpoint = `${newNode.url}/images/generations`;
              
              const fallbackTemperature = config.temperature ?? 1.0;
              const fallbackTopP = config.top_p ?? 0.95;
            
              const requestBody: any = {
                model: newModelId,
                prompt: fallbackPrompt,
                size: imageSize,
                response_format: "b64_json",
                n: 1,
                seed: Math.floor(Math.random() * 2147483647)
              };
              
              if (hasFallbackBaseImage) {
                requestBody.reference_images = fallbackImageParts.map((img: any) => ({
                  data: img.inlineData.data,
                  mime_type: img.inlineData.mimeType
                }));
                console.log(`[Fallback] 已传递 ${fallbackImageParts.length} 张底图到 reference_images`);
              } else {
                console.warn(`[Fallback] 警告：未检测到底图，将仅根据提示词生成图像`);
              }
              
              // 使用带重试机制的 fetch
              const fetchResponse = await fetchWithRetry(fallbackApiEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${newApiKey}`
                },
                body: JSON.stringify(requestBody),
                signal
              }, 3);  // 最多重试3次
              if (!fetchResponse.ok) throw new Error(`Fallback Gateway Error: ${fetchResponse.statusText}`);
              const data = await fetchResponse.json();
              
              const imageData = data.data?.[0]?.b64_json || data.data?.[0]?.url;
              
              const usageMetadata = data.usage ? {
                promptTokenCount: data.usage.prompt_tokens || 0,
                candidatesTokenCount: data.usage.completion_tokens || 0,
                totalTokenCount: data.usage.total_tokens || 0
              } : { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
              
              response = {
                candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: imageData } }] } }],
                usageMetadata
              };
            } else {
              response = await newAi.models.generateContent({
                model: newModelId!,
                contents: { parts },
                config: Object.keys(imageConfig).length > 0 ? { imageConfig, seed: Math.floor(Math.random() * 2147483647) } : { seed: Math.floor(Math.random() * 2147483647) },
              });
            }
            this.reportTokens(response.usageMetadata);
          } catch (fallbackErr: any) {
            throw new Error(this.formatError(fallbackErr));
          }
        }
      } else if (this.isPermissionError(err) && modelId?.includes("pro")) {
        console.warn("Pro image model failed, falling back to Flash engine...");
        const fallbackModel = "gemini-3-pro-image-preview";
        const { ai: fallbackAi, modelId: finalFallbackId, node: fallbackNode, apiKey: fallbackKey } = getAI(modelConfig, fallbackModel);
        
        if (fallbackNode && fallbackNode.provider !== "Google Cloud") {
          const finalFallbackPrompt = parts.find(p => p.text)?.text || "";
          const fallbackImageParts = parts.filter(p => p.inlineData);
          
          // 构建请求 - 使用 reference_images 字段传递底图
          const hasFinalFallbackBaseImage = fallbackImageParts.length > 0;
          const finalFallbackApiEndpoint = `${fallbackNode.url}/images/generations`;
          
          const finalFallbackTemperature = config.temperature ?? 1.0;
          const finalFallbackTopP = config.top_p ?? 0.95;
          
          const requestBody: any = {
            model: finalFallbackId,
            prompt: finalFallbackPrompt,
            size: imageSize,
            response_format: "b64_json",
            n: 1,
            seed: Math.floor(Math.random() * 2147483647)
          };
          
          if (hasFinalFallbackBaseImage) {
            requestBody.reference_images = fallbackImageParts.map((img: any) => ({
              data: img.inlineData.data,
              mime_type: img.inlineData.mimeType
            }));
            console.log(`[Flash Fallback] 已传递 ${fallbackImageParts.length} 张底图到 reference_images`);
          } else {
            console.warn(`[Flash Fallback] 警告：未检测到底图，将仅根据提示词生成图像`);
          }
          
          // 使用带重试机制的 fetch
          const fetchResponse = await fetchWithRetry(finalFallbackApiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${fallbackKey}`
            },
            body: JSON.stringify(requestBody),
            signal
          }, 3);  // 最多重试3次
          if (!fetchResponse.ok) throw new Error(`Fallback Gateway Error: ${fetchResponse.statusText}`);
          const data = await fetchResponse.json();
          
          const imageData = data.data?.[0]?.b64_json || data.data?.[0]?.url;
          
          // 使用网关返回的 usage 数据
          let fallbackUsage;
          if (data.usage) {
            const promptTokens = data.usage.prompt_tokens || 0;
            const completionTokens = data.usage.completion_tokens || 0;
            const totalTokens = data.usage.total_tokens || (promptTokens + completionTokens);
            fallbackUsage = {
              promptTokenCount: promptTokens,
              candidatesTokenCount: completionTokens,
              totalTokenCount: totalTokens
            };
            console.log(`[Token] 输入: ${promptTokens}, 输出: ${completionTokens}, 总计: ${totalTokens}`);
          } else {
            const promptTokens = Math.ceil(prompt.length / 4);
            const imageTokens = Math.ceil(imageData.length * 0.75 / 100);
            fallbackUsage = {
              promptTokenCount: promptTokens,
              candidatesTokenCount: imageTokens,
              totalTokenCount: promptTokens + imageTokens
            };
          }
          
          response = {
            candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: imageData } }] } }],
            usageMetadata: fallbackUsage
          };
        } else {
          response = await fallbackAi.models.generateContent({
            model: finalFallbackId!,
            contents: { parts },
            config: { imageConfig: { aspectRatio: safeRatio }, seed: Math.floor(Math.random() * 2147483647) },
          });
        }
        this.reportTokens(response.usageMetadata);
      } else {
        throw new Error(this.formatError(err));
      }
    }

    const images: string[] = [];
    for (const candidate of response.candidates || []) {
      for (const part of candidate?.content?.parts || []) {
        if (part.inlineData) {
          images.push(`data:image/png;base64,${part.inlineData.data}`);
        }
      }
    }
    if (images.length === 0) {
      throw new Error("No image data found in response");
    }
    // 返回图片列表 + 对应的seed列表
    return { images, seeds: seedList };
  },

  async analyzeImage(image: string, prompt: string, instructions: any, modelConfig: any, signal?: AbortSignal) {
    const defaultModel = useThirdPartyGateway ? "gemini-3.1-flash-lite-preview" : "gemini-3-flash-preview";
    const requestedModel = getModelName(modelConfig, defaultModel);
    const { ai, modelId, node, apiKey } = getAI(modelConfig, requestedModel);
    
    // Suggestion 5: Visual Downsampling to 512px for analysis tasks
    const compressedImage = await this.compressImage(image, 512);
    const base64Data = compressedImage.split(",")[1];
    
    const genConfig: any = { 
      systemInstruction: instructions.VISUAL_ANALYST,
      maxOutputTokens: 2048
    };
    if (modelId?.includes("gemini-3")) {
      genConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    if (node && node.provider !== "Google Cloud") {
      try {
        const proxiedUrl = getProxiedUrl(node.url, true);
        // 直接使用 base64 数据传递图片
        const imageUrl = `data:image/jpeg;base64,${base64Data}`;
        const fetchResponse = await fetch(`${proxiedUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: "system", content: instructions.VISUAL_ANALYST },
              { role: "user", content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageUrl } }
              ]}
            ],
            max_tokens: 2048
          }),
          signal
        });

        if (!fetchResponse.ok) {
          const errorData = await fetchResponse.json().catch(() => ({}));
          throw new Error(`Gateway Error: ${errorData.error?.message || fetchResponse.statusText}`);
        }
        const data = await fetchResponse.json();
        return data.choices[0].message.content;
      } catch (err: any) {
        console.error("Gateway Analysis Error:", err);
        throw new Error(`[商业模式故障] 视觉分析异常: ${err.message}`);
      }
    }

    const response = await ai.models.generateContent({
      model: modelId!,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: prompt },
        ],
      },
      config: genConfig,
    });
    this.reportTokens(response.usageMetadata);
    return response.text;
  },

  async generateReversePrompt(image: string, instructions: any, modelConfig: any, signal?: AbortSignal): Promise<EnhancedPrompt> {
    const defaultModel = useThirdPartyGateway ? "gemini-3-flash-preview" : "gemini-3-pro-preview";
    const requestedModel = getModelName(modelConfig, defaultModel);
    const { ai, modelId, node, apiKey } = getAI(modelConfig, requestedModel);
    
    // 【反推提示词】网关路径用 512px 图片（后端已跳过 sanitize，base64 不再被破坏）
    // 原生 API 路径同样 512px（inlineData 方式）
    const compressedImageForGateway = await this.compressImage(image, 512);
    const base64ForGateway = compressedImageForGateway.split(",")[1];
    const compressedImage = await this.compressImage(image, 512);
    const base64Data = compressedImage.split(",")[1];
    
    // 【反推提示词】优先使用 Google 原生 API（inlineData 方式传递图片）
    // 第三方网关 /chat/completions 端点可能因 base64 过长触发"非法字符"拦截
    const useNativePath = !node || node.provider === "Google Cloud";

    if (!useNativePath) {
      try {
        const proxiedUrl = getProxiedUrl(node.url, true);
        const imageUrl = `data:image/jpeg;base64,${base64ForGateway}`;
        console.log(`[反推] 网关请求 base64 长度: ${base64ForGateway.length} (${(base64ForGateway.length/1024).toFixed(1)}KB)`);
        const fetchResponse = await fetch(`${proxiedUrl}/chat/completions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: "user", content: [
                { type: "text", text: "Please analyze the image I provided and deconstruct its visual elements. Output a JSON with fields: zh (Chinese description), en (English prompt), analysis (style analysis)." },
                { type: "image_url", image_url: { url: imageUrl } }
              ]}
            ],
            max_tokens: 1024
          }),
          signal,
          cache: 'no-store'
        });

        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text().catch(() => '');
          console.error("[反推] 网关错误:", fetchResponse.status, errorText.substring(0, 200));
          throw new Error(`Gateway ${fetchResponse.status}: ${errorText.substring(0, 100)}`);
        }
        const data = await fetchResponse.json();
        return this.parseJsonSafely(data.choices[0].message.content || '{}');
      } catch (err: any) {
        console.warn("[反推] 网关路径失败，降级到 Google 原生 API:", err.message);
        // 不抛出异常，继续走下方的 Google 原生路径
      }
    }

    const request: any = {
      model: modelId!,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: "Deconstruct the visual elements and provide a prompt to replicate this style." },
        ],
      },
      config: { 
        systemInstruction: instructions.PROMPT_SPECIALIST,
        maxOutputTokens: 1024,
      },
    };

    if (modelId?.includes("gemini-3")) {
      request.config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    try {
      const response = await ai.models.generateContent(request);
      this.reportTokens(response.usageMetadata);
      return this.parseJsonSafely(response.text || '{}');
    } catch (err: any) {
      if (this.isPermissionError(err) && modelId?.includes("pro")) {
        console.warn("Pro model failed, falling back to Flash for reverse prompt...");
        const fallbackResponse = await ai.models.generateContent({
          ...request,
          model: "gemini-3-flash-preview"
        });
        this.reportTokens(fallbackResponse.usageMetadata);
        return this.parseJsonSafely(fallbackResponse.text || '{}');
      }
      throw new Error(this.formatError(err));
    }
  },

  async chat(prompt: string, history: any[], mode: string, files: any[], instructions: any, modelConfig: any, signal?: AbortSignal) {
    // 模型选择逻辑
    let defaultModel: string;
    
    if (useThirdPartyGateway) {
      // 商业模式模型选择
      if (files.length === 0) {
        // 纯文字对话
        if (mode === 'DEEP') {
          defaultModel = 'gemini-3.1-flash-lite-preview';  // 深度模式
        } else {
          defaultModel = 'deepseek-v3.2';  // 极速/逻辑模式（性价比高）
        }
      } else {
        // 有图片的多模态对话
        defaultModel = 'gemini-3.1-flash-lite-preview';
      }
    } else {
      // 开发模式：使用 Gemini 官方模型
      if (mode === 'DEEP') {
        defaultModel = 'gemini-3-pro-preview';
      } else if (mode === 'ADVANCED') {
        defaultModel = 'gemini-3-flash-preview';
      } else {
        defaultModel = 'gemini-1.5-flash';
      }
    }
    
    const requestedModel = getModelName(modelConfig, defaultModel);
    const { ai, modelId, node, apiKey } = getAI(modelConfig, requestedModel);
    
    const systemInstruction = instructions.CREATIVE_CONSULTANT;

    // 如果是非官方节点且不是 Google Cloud，尝试使用 OpenAI 协议
    if (node && node.provider !== "Google Cloud") {
      try {
        // 构建用户消息内容（支持文本+图片）
        const userContent: any[] = [{ type: "text", text: prompt }];
        for (const f of files) {
          let mimeType = f.mimeType || f.type;
          if (f.data && mimeType) {
            // 修复不完整的 MIME 类型
            if (mimeType === 'image/' || mimeType === 'image' || mimeType.length <= 6) {
              mimeType = 'image/png';
            } else if (!mimeType.startsWith('image/')) {
              mimeType = 'image/' + mimeType;
            }
            
            if (mimeType.startsWith('image/')) {
              const dataUrl = f.data.startsWith('data:') ? f.data : `data:${mimeType};base64,${f.data}`;
              userContent.push({ type: "image_url", image_url: { url: dataUrl } });
            }
          }
        }

        // 构建历史消息（包含图片）
        const historyMessages = history.map(h => {
          const role = h.role === 'model' ? 'assistant' : h.role;
          const hasImages = h.parts.some(p => p.inlineData && p.inlineData.mimeType);
          if (hasImages) {
            const content: any[] = [];
            for (const part of h.parts) {
              if (part.text) {
                content.push({ type: "text", text: part.text });
              } else if (part.inlineData && part.inlineData.mimeType) {
                let mimeType = part.inlineData.mimeType;
                if (mimeType === 'image/' || mimeType === 'image') {
                  mimeType = 'image/png';
                } else if (!mimeType.startsWith('image/')) {
                  mimeType = 'image/' + mimeType;
                }
                
                if (mimeType.startsWith('image/')) {
                  const dataUrl = part.inlineData.data.startsWith('data:') 
                    ? part.inlineData.data 
                    : `data:${mimeType};base64,${part.inlineData.data}`;
                  content.push({ type: "image_url", image_url: { url: dataUrl } });
                }
              }
            }
            return { role, content };
          }
          return { role, content: h.parts[0].text };
        });

        const messages = [
          ...historyMessages,
          { role: "user", content: userContent }
        ];

        // 详细日志输出
        const proxiedUrl = getProxiedUrl(node.url, true);
        console.log(`%c[Chat Gateway] 正在连接 ${node.provider}...`, 'color: #4f46e5; font-weight: bold;');
        console.log(`[Chat Gateway] URL: ${proxiedUrl}/chat/completions`);
        console.log(`[Chat Gateway] Model: ${modelId}`);
        console.log(`[Chat Gateway] 图片数量: ${files.length}`);

        const response = await fetch(`${proxiedUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // Authorization 头由后端代理自动添加
          },
          body: JSON.stringify({
            model: modelId,
            messages: messages,
            max_tokens: 1024
          }),
          signal
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error?.message || response.statusText;
          throw new Error(`Gateway Error: ${errorMsg} (Status: ${response.status})`);
        }
        const data = await response.json();
        const text = data.choices[0].message.content;
        
        // 构建包含图片的 partsSent，用于在聊天气泡中显示图片
        const partsSent: any[] = [{ text: prompt }];
        for (const f of files) {
          if (f.data && f.mimeType) {
            partsSent.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
          }
        }
        
        return {
          text: text,
          partsSent: partsSent,
          sources: []
        };
      } catch (err: any) {
        console.error("Gateway Chat Error:", err);
        // 商业版友好错误提示
        let errorMessage = "聊天失败";
        if (err.message.includes("TypeError") || err.message.includes("failed to fetch")) {
          errorMessage = "聊天失败：网络连接异常，请检查您的网络连接后重试";
        } else if (err.message.includes("401") || err.message.includes("Unauthorized")) {
          errorMessage = "聊天失败：API Key 无效或已过期，请检查 API Key 配置";
        } else if (err.message.includes("403") || err.message.includes("Forbidden")) {
          errorMessage = "聊天失败：权限不足，可能是 API Key 权限配置问题";
        } else if (err.message.includes("429") || err.message.includes("rate limit")) {
          errorMessage = "聊天失败：请求频率过高，请稍后重试";
        } else if (err.message.includes("500") || err.message.includes("Internal Server Error")) {
          errorMessage = "聊天失败：第三方服务内部错误，请稍后重试";
        } else {
          errorMessage = `聊天失败：${err.message || '未知错误'}`;
        }
        throw new Error(errorMessage);
      }
    }

    const chatConfig: any = { 
      systemInstruction: systemInstruction,
      maxOutputTokens: 1024,
    };

    if (modelId?.includes("gemini-3")) {
      chatConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const chat = ai.chats.create({
      model: modelId!,
      config: chatConfig,
      history: history.length > 0 ? history : undefined
    });

    const parts: any[] = [{ text: prompt }];
    for (const f of files) {
      const mimeType = f.mimeType || f.type;
      if (f.data && mimeType) {
        const dataUrl = f.data.startsWith('data:') ? f.data : `data:${mimeType};base64,${f.data}`;
        // 通过 canvas 重绘剥离 C2PA 等元数据，避免 Gemini base64 解码失败
        const stripped = await new Promise<string>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
        });
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: stripped.split(',')[1] } });
      }
    }

    const response = await chat.sendMessage({ message: parts });
    this.reportTokens(response.usageMetadata);
    return {
      text: response.text,
      partsSent: parts,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || 'External Source',
        uri: c.web?.uri || ''
      })) || []
    };
  },

  getVideoModelCapabilities(assetCount: number, gatewayEnabled: boolean) {
    // 在商业开发模式下，只显示 Kbit 开头的视频模型
    let engines: any[] = [];

    // 如果开启了第三方网关，则从配置文件中动态发现视频模型
    if (gatewayEnabled) {
      const dynamicEngines: any[] = [];
      Object.entries(gatewayConfig.models).forEach(([modelId, nodes]: [string, any]) => {
        // 识别视频模型的逻辑：只包含 Kbit 开头的模型
        if (modelId.startsWith('Kbit')) {
          // 对于 KbitVeo-master，即使未激活也要显示
          const isMasterModel = modelId === 'KbitVeo-master';
          const node = isMasterModel 
            ? nodes[0] // 即使未激活也使用第一个节点
            : nodes.find((n: any) => n.provider !== "Google Cloud" && n.active);
          
          // 只有非 master 模型需要检查是否有激活的节点
          if (!isMasterModel && !node) {
            return;
          }
          
          // 为不同的 Kbit 模型设置特定的支持比例和时长
          let supportedRatios: string[] = ['16:9'];
          let duration: string = '5-15s';
          
          if (modelId === 'KbitVeo-speed') {
            supportedRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
            duration = '5s / 10s';
          } else if (modelId === 'KbitVeo-normal') {
            supportedRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
            duration = '4s / 6s / 8s / 12s';
          } else if (modelId === 'KbitVeo-standard') {
            supportedRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
            duration = '4s / 8s / 12s / 15s';
          } else if (modelId === 'KbitVeo-pro') {
            supportedRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
            duration = '4s / 8s / 12s / 15s';
          } else if (modelId === 'KbitVeo-master') {
            supportedRatios = ['16:9', '9:16', '21:9', '4:3', '1:1'];
            duration = '5-60s';
          } else if (modelId === 'Kbit-fast') {
            supportedRatios = ['16:9'];
            duration = '5-15s';
          }
          
          // 格式化标签
          let formattedLabel = modelId;
          // 对于 KbitVeo 系列模型，设置显示标签
          if (modelId.startsWith('KbitVeo-')) {
            // 提取模型类型（speed、normal、pro、master、standard）
            const modelType = modelId.split('-').find(part => 
              ['speed', 'normal', 'pro', 'master', 'standard'].includes(part.toLowerCase())
            ) || 'speed';
            // 特殊处理模型标签
            if (modelType === 'speed') {
              formattedLabel = 'SeeDance-1.0F';
            } else if (modelType === 'normal') {
              formattedLabel = 'SeeDance-1.5';
            } else if (modelType === 'standard') {
              formattedLabel = 'SeeDance-2.0';
            } else if (modelType === 'pro') {
              formattedLabel = 'SeeDance-2F';
            } else {
              // 其他模型保持原有格式
              formattedLabel = 'KbitVeo-' + modelType.toLowerCase();
            }
          }
          
          const descMap: Record<string, string> = {
            'KbitVeo-speed': '单图·最长10s',
            'KbitVeo-normal': '双图·最长12s',
            'KbitVeo-standard': '9图+视频·最长15s',
            'KbitVeo-pro': '9图+视频·最长15s·快速',
          };
          dynamicEngines.push({
            id: modelId,
            label: formattedLabel,
            desc: descMap[modelId] || node?.description || `Gateway: ${node?.provider || 'ph8.co'}`,
            supportedRatios: assetCount >= 2 ? ['16:9'] : supportedRatios,
            duration: duration,
            supportsVideoUpload: modelId === 'KbitVeo-standard' || modelId === 'KbitVeo-pro',
            isFrozen: modelId === 'KbitVeo-master'
          });
        }
      });
      
      if (dynamicEngines.length > 0) {
        engines = dynamicEngines;
      }
    }

    // 如果没有找到 Kbit 模型，提供默认的 KbitVeo 模型列表
    if (engines.length === 0) {
      engines = [
        {
          id: 'KbitVeo-speed',
          label: 'SeeDance-1.0F',
          desc: '单图·最长10s',
          supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
          duration: '5s / 10s'
        },
        {
          id: 'KbitVeo-normal',
          label: 'SeeDance-1.5',
          desc: '双图·最长12s',
          supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
          duration: '4s / 6s / 8s / 12s'
        },
        {
          id: 'KbitVeo-standard',
          label: 'SeeDance-2.0',
          desc: '9图+视频·最长15s',
          supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
          duration: '4s / 8s / 12s / 15s',
          supportsVideoUpload: true
        },
        {
          id: 'KbitVeo-pro',
          label: 'SeeDance-2F',
          desc: '9图+视频·最长15s·快速',
          supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
          duration: '4s / 8s / 12s / 15s',
          supportsVideoUpload: true
        },
      ];
    }

    // 获取当前默认引擎的支持比例
    const defaultEngine = engines[0];
    const supportedRatios = assetCount >= 2 ? ['16:9'] : (defaultEngine?.supportedRatios || ['16:9']);

    return {
      engines,
      supportedRatios,
      engineDetails: engines.reduce((acc: any, engine) => {
        acc[engine.id] = {
          supportedRatios: assetCount >= 2 ? ['16:9'] : (engine.supportedRatios || ['16:9']),
          duration: engine.duration || '5-15s'
        };
        return acc;
      }, {})
    };
  },

  async generateVideo(prompt: string, assets: string[], aspectRatio: string, instructions: any, signal?: AbortSignal, lastVideo?: any, engineId?: string, onProgress?: (progress: number) => void) {
    const requestedModel = engineId || 'KbitVeo-speed';
    const { ai, modelId, node, apiKey } = getAI(undefined, requestedModel); 
    
    // 如果是第三方非 Google 节点，使用 ph8 视频 API
    if (node && node.provider !== "Google Cloud") {
      console.log(`[Video Gateway] Using ph8 Video API for ${node.provider}`);
      try {
        const proxiedUrl = getProxiedUrl(node.url);
        const remoteModelId = node.remoteModelId || engineId || requestedModel;
        
        console.log(`[Video Gateway] Model: ${remoteModelId}, Endpoint: ${proxiedUrl}/videos`);
        
        // 构建请求体
        const requestBody: any = {
          model: remoteModelId,
          prompt: prompt,
          duration: 5,
          resolution: "1080p",
          ratio: aspectRatio === '9:16' ? '9:16' : aspectRatio === '21:9' ? '21:9' : '16:9',
          watermark: false
        };
        
        // 如果有图片（i2v 模式）
        if (assets.length > 0 && assets[0]) {
          requestBody.image = assets[0];
        }
        
        console.log(`[Video Gateway] Request body:`, JSON.stringify({
          model: requestBody.model,
          prompt: requestBody.prompt?.substring(0, 50),
          duration: requestBody.duration,
          resolution: requestBody.resolution,
          ratio: requestBody.ratio,
          hasImage: !!requestBody.image
        }));
        
        // 创建视频任务
        const createResponse = await fetch(`${proxiedUrl}/videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // Authorization 头由后端代理自动添加
          },
          body: JSON.stringify(requestBody),
          signal
        });

        const responseText = await createResponse.text().catch(() => '');
        let task: any = null;
        
        try {
          task = JSON.parse(responseText);
        } catch (e) {
          // 解析失败
        }
        
        // 检查是否成功创建了任务（即使状态码不是 200）
        if (task && task.id && (task.status === 'queued' || task.status === 'in_progress' || task.status === 'completed')) {
          console.log(`[Video Gateway] Task created successfully (status ${createResponse.status}):`, task.id);
        } else if (!createResponse.ok) {
          // 真正的错误
          console.error(`[Video Gateway] Error response:`, {
            status: createResponse.status,
            statusText: createResponse.statusText,
            body: responseText
          });
          throw new Error(`Gateway Error (${createResponse.status}): ${responseText || createResponse.statusText}`);
        }
        
        if (!task || !task.id) {
          throw new Error(`Gateway returned invalid response: ${responseText}`);
        }
        const videoId = task.id;
        
        console.log(`[Video Gateway] Task created: ${videoId}, Status: ${task.status}`);
        
        // 轮询任务状态
        let status = task.status;
        let progress = task.progress || 0;
        let retryCount = 0;
        const maxRetries = 60; // 最多重试 60 次（约 3 分钟）
        
        // 检查任务创建响应中是否已经包含视频 URL
        if (task.url || task.video_url || task.content_url || task.data?.url) {
          const videoUrl = task.url || task.video_url || task.content_url || task.data?.url;
          console.log(`[Video Gateway] Video ready from initial response: ${videoUrl}`);
          return { url: videoUrl, videoRef: videoId };
        }
        
        while ((status === "in_progress" || status === "queued") && retryCount < maxRetries) {
          if (signal?.aborted) throw new Error("AbortError");
          
          await new Promise(resolve => setTimeout(resolve, 5000)); // 每 5 秒检查一次
          retryCount++;
          
          try {
            // 尝试多种状态查询端点格式
            let statusData: any = null;
            
            // ph8 视频 API 使用 openai/v1 路径进行状态查询
            const openaiProxiedUrl = getProxiedUrl('https://ph8.co', true);
            
            // 格式1: GET /videos/{id} (使用 openai 路径)
            let statusResponse = await fetch(`${openaiProxiedUrl}/videos/${videoId}`, {
              // headers: Authorization 头由后端代理自动添加
            });
            
            if (statusResponse.ok) {
              statusData = await statusResponse.json();
            } else {
              // 格式2: GET /videos/{id} (使用 v1 路径)
              statusResponse = await fetch(`${proxiedUrl}/videos/${videoId}`, {
                // headers: Authorization 头由后端代理自动添加
              });
              
              if (statusResponse.ok) {
                statusData = await statusResponse.json();
              }
            }
            
            if (statusData && statusData.id) {
              status = statusData.status;
              progress = statusData.progress || progress;
              onProgress?.(Math.min(progress, 95));
              console.log(`[Video Gateway] Status: ${status}, Progress: ${progress}%`);
              console.log(`[Video Gateway] Response data:`, JSON.stringify(statusData).substring(0, 500));
              
              if (status === "failed") {
                const errorMsg = statusData.error?.message || "Video generation failed";
                throw new Error(errorMsg);
              }
              
              // 检查是否有视频 URL（尝试多种字段名）
              if (status === "completed") {
                console.log(`[Video Gateway] Full completed response:`, JSON.stringify(statusData, null, 2));
                
                // 尝试从响应中获取视频 URL
                let videoUrl = statusData.url || 
                                 statusData.video_url || 
                                 statusData.content_url ||
                                 statusData.output?.url ||
                                 statusData.data?.url ||
                                 statusData.result?.url ||
                                 statusData.download_url ||
                                 statusData.file_url ||
                                 statusData.extra?.url ||
                                 statusData.extra?.video_url ||
                                 statusData.extra?.content_url;
                
                // 如果响应中有 content 数组，尝试从中获取
                if (!videoUrl && statusData.content && Array.isArray(statusData.content)) {
                  const contentItem = statusData.content.find((c: any) => c.type === 'video' || c.url);
                  if (contentItem) {
                    videoUrl = contentItem.url || contentItem.video_url;
                  }
                }
                
                // 如果响应中有 videos 数组
                if (!videoUrl && statusData.videos && Array.isArray(statusData.videos) && statusData.videos.length > 0) {
                  videoUrl = statusData.videos[0].url || statusData.videos[0];
                }
                
                // 如果响应中有 generated_videos 数组
                if (!videoUrl && statusData.generated_videos && Array.isArray(statusData.generated_videos) && statusData.generated_videos.length > 0) {
                  videoUrl = statusData.generated_videos[0].url || statusData.generated_videos[0].video?.url;
                }
                
                if (videoUrl) {
                  console.log(`[Video Gateway] Video ready: ${videoUrl}`);
                  return { url: videoUrl, videoRef: videoId };
                } else {
                  console.log(`[Video Gateway] Completed but no URL found, trying to download content...`);
                  
                  // 尝试调用 download_content API
                  // 根据 PH8 文档，使用 client.videos.download_content(video.id)
                  // 在浏览器中，我们需要直接调用 API 获取视频内容
                  try {
                    // 等待 10 秒让视频内容准备好（根据 PH8 文档建议）
                    console.log(`[Video Gateway] Waiting 10s for video content to be ready...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    
                    // 尝试多种路径格式
                    const contentUrls = [
                      `${proxiedUrl}/videos/${videoId}/content`,
                      `${proxiedUrl}/openai/v1/videos/${videoId}/content`,
                      `${proxiedUrl}/videos/${videoId}/download_content`,
                      `${openaiProxiedUrl}/videos/${videoId}/content`
                    ];
                    
                    for (const contentUrl of contentUrls) {
                      console.log(`[Video Gateway] Trying content URL: ${contentUrl}`);
                      
                      const downloadResponse = await fetch(contentUrl, {
                        // headers: Authorization 头由后端代理自动添加
                      });
                      
                      if (downloadResponse.ok) {
                        const arrayBuffer = await downloadResponse.arrayBuffer();
                        // 从响应头获取 MIME 类型，默认为 video/mp4
                        const contentType = downloadResponse.headers.get('content-type') || 'video/mp4';
                        console.log(`[Video Gateway] Content-Type: ${contentType}, Size: ${arrayBuffer.byteLength} bytes`);
                        
                        // 检查返回数据的类型（通过查看前几个字节）
                        const firstBytes = new Uint8Array(arrayBuffer.slice(0, 20));
                        const hexString = Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        console.log(`[Video Gateway] First 20 bytes (hex): ${hexString}`);
                        
                        // 检测文件签名
                        const textDecoder = new TextDecoder('utf-8');
                        const firstChars = textDecoder.decode(arrayBuffer.slice(0, 100));
                        console.log(`[Video Gateway] First 100 chars: ${firstChars.substring(0, 100)}`);
                        
                        // 创建指定类型的 Blob
                        const blob = new Blob([arrayBuffer], { type: contentType });
                        const objectUrl = URL.createObjectURL(blob);
                        console.log(`[Video Gateway] Video downloaded as blob: ${objectUrl}, type: ${blob.type}`);
                        return { url: objectUrl, videoRef: videoId };
                      } else {
                        console.log(`[Video Gateway] Content API returned ${downloadResponse.status} for ${contentUrl}`);
                      }
                    }
                  } catch (downloadErr) {
                    console.log(`[Video Gateway] Download content failed:`, downloadErr);
                  }
                  
                  // 继续等待，URL 可能需要时间生成
                }
              }
            } else {
              console.log(`[Video Gateway] Waiting for task... (${retryCount}/${maxRetries})`);
            }
          } catch (e) {
            console.log(`[Video Gateway] Status check error, retrying... (${retryCount}/${maxRetries})`);
          }
        }
        
        // 超时后尝试获取最终结果
        const finalResponse = await fetch(`${proxiedUrl}/videos/${videoId}`, {
          // headers: Authorization 头由后端代理自动添加
        }).catch(() => null);
        
        if (finalResponse && finalResponse.ok) {
          const finalData = await finalResponse.json();
          const videoUrl = finalData.url || finalData.video_url || finalData.content_url;
          if (videoUrl) {
            return { url: videoUrl, videoRef: videoId };
          }
        }
        
        throw new Error(`Video generation timeout after ${maxRetries} retries`);
        
      } catch (err: any) {
        let errorMessage = "视频生成失败";
        if (err.message.includes("Gateway returned no video URL")) {
          errorMessage = "视频生成失败：网关未返回视频链接";
        } else if (err.message.includes("Gateway Error")) {
          errorMessage = `视频生成失败：${err.message}`;
        } else if (err.message.includes("Status check failed")) {
          errorMessage = "视频生成失败：状态检查失败";
        } else if (err.message === "AbortError") {
          errorMessage = "视频生成已取消";
        } else {
          errorMessage = `视频生成失败：${err.message}`;
        }
        console.error("[Video Gateway Error]", err);
        throw new Error(errorMessage);
      }
    }

    const config: any = {
      numberOfVideos: 1,
      aspectRatio: (aspectRatio === '16:9' || aspectRatio === '9:16') ? aspectRatio : '16:9',
      resolution: '720p'
    };

    let operation;
    if (assets.length > 0) {
      operation = await ai.models.generateVideos({
        model: modelId!,
        prompt,
        image: {
          imageBytes: assets[0].split(',')[1],
          mimeType: 'image/jpeg'
        },
        config
      });
    } else {
      operation = await ai.models.generateVideos({
        model: modelId!,
        prompt,
        config
      });
    }

    while (!operation.done) {
      if (signal?.aborted) throw new Error("AbortError");
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const finalUrl = downloadLink || '';
    
    return {
      url: finalUrl,
      videoRef: operation.response?.generatedVideos?.[0]?.video
    };
  }
};
