
export type AppTab = 'architect' | 'chat' | 'analyze' | 'video';
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

export interface ExtendedChatMessage extends ChatMessage {
  sources?: { title: string; uri: string }[];
  parts?: any[];
  contentId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ExtendedChatMessage[];
  timestamp: number;
}

export type AppTheme = 'indigo' | 'ocean' | 'forest' | 'sunset' | 'minimal';

export interface UserPreferences {
  promptFontSize: number;
  chatFontSize: number;
  theme: AppTheme;
}

export interface CustomModel {
  id: string;
  name: string;
  modelId: string;
  isOfficial: boolean;
  baseUrl?: string;
  apiKey?: string;
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
