
export type AppTab = 'architect' | 'chat' | 'video';
export type ConversationMode = 'chat' | 'architect' | 'video';

export interface ConversationNode {
  id: string;
  type: 'session' | 'group';
  name: string;
  mode?: ConversationMode;
  messages?: ExtendedChatMessage[];
  children?: ConversationNode[];
  timestamp: number;
  isExpanded?: boolean;
}
export type CreativeDomain = 'architecture' | 'product' | 'art' | 'character';
export type UserTier = 'free' | 'beta' | 'basic' | 'pro' | 'plus';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  brushSize: number;
  color: string;
  tool: 'brush' | 'rect' | 'poly';
}

export interface HistoryItem {
  id: string;
  url: string;
  originalUrl?: string;
  prompt: string;
  config: any;
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface SearchResult {
  title: string;
  content: string;
  url: string;
}

export interface SearchContextData {
  searched: boolean;
  context: string;
  results: SearchResult[];
}

export interface ExtendedChatMessage extends ChatMessage {
  sources?: { title: string; uri: string }[];
  parts?: any[];
  contentId?: string;
  searchContext?: SearchContextData;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ExtendedChatMessage[];
  timestamp: number;
}

export type AppTheme = 'dark' | 'indigo' | 'ocean' | 'forest' | 'sunset' | 'minimal';
export type Language = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'es-ES' | 'fr-FR' | 'de-DE' | 'ru-RU';

export interface UserPreferences {
  promptFontSize: number;
  chatFontSize: number;
  theme: AppTheme;
  language: Language;            // 界面语言
  // 新增个性化选项
  accentColor: string;           // 主题色
  borderRadius: 'sharp' | 'normal' | 'rounded' | 'pill';  // 圆角风格
  density: 'compact' | 'normal' | 'comfortable';  // 界面密度
  animationSpeed: 'none' | 'fast' | 'normal' | 'slow';  // 动画速度
  showWelcomeMessage: boolean;   // 显示欢迎消息
  autoSaveHistory: boolean;      // 自动保存历史
  compactSidebar: boolean;       // 紧凑侧边栏
  fontSize: 'small' | 'medium' | 'large';  // 全局字体大小
  lightMode: boolean;  // 亮色模式（与主题色彩解耦）
}

export interface CustomModel {
  id: string;
  name: string;
  modelId: string;
  isOfficial: boolean;
  baseUrl?: string;
  // apiKey 已移除，API Key 由后端管理，前端不再直接接触
}

export interface VersionRecord {
  version: string;
  timestamp: number;
  description: string;
  changes: string[];
  presets?: any;
}

export interface RouteChannel {
  id: string;
  provider: string;
  url: string;
  inputPrice: number;
  outputPrice: number;
  remoteModelId?: string;
  priority: number;
  active: boolean;
}

export interface GatewayConfig {
  version: string;
  global_settings: any;
  models: Record<string, RouteChannel[]>;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
