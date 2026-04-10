import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppTab, CreativeDomain } from '../../types';

interface AppState {
  activeTab: AppTab;
  activeSessionId: string;
  currentDomain: CreativeDomain;
  showPresetPanel: boolean;
  chatKey: number;
  analyzeKey: number;
  videoKey: number;
  useThirdPartyGateway: boolean;
  usePromptEnhance: boolean;
  showTokenMonitor: boolean;
  lastOpTokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  sessionTotalTokens: number;
}

const initialState: AppState = {
  activeTab: 'architect',
  activeSessionId: '',
  currentDomain: 'architecture',
  showPresetPanel: false,
  chatKey: 0,
  analyzeKey: 0,
  videoKey: 0,
  useThirdPartyGateway: true,
  usePromptEnhance: true,
  showTokenMonitor: false,
  lastOpTokens: {
    prompt: 0,
    completion: 0,
    total: 0,
  },
  sessionTotalTokens: 0,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<AppTab>) => {
      state.activeTab = action.payload;
    },
    setActiveSessionId: (state, action: PayloadAction<string>) => {
      state.activeSessionId = action.payload;
    },
    setCurrentDomain: (state, action: PayloadAction<CreativeDomain>) => {
      state.currentDomain = action.payload;
    },
    setShowPresetPanel: (state, action: PayloadAction<boolean>) => {
      state.showPresetPanel = action.payload;
    },
    incrementChatKey: (state) => {
      state.chatKey += 1;
    },
    incrementAnalyzeKey: (state) => {
      state.analyzeKey += 1;
    },
    incrementVideoKey: (state) => {
      state.videoKey += 1;
    },
    setUseThirdPartyGateway: (state, action: PayloadAction<boolean>) => {
      state.useThirdPartyGateway = action.payload;
    },
    setUsePromptEnhance: (state, action: PayloadAction<boolean>) => {
      state.usePromptEnhance = action.payload;
    },
    setShowTokenMonitor: (state, action: PayloadAction<boolean>) => {
      state.showTokenMonitor = action.payload;
    },
    setLastOpTokens: (state, action: PayloadAction<{ prompt: number; completion: number; total: number }>) => {
      state.lastOpTokens = action.payload;
    },
    setSessionTotalTokens: (state, action: PayloadAction<number>) => {
      state.sessionTotalTokens = action.payload;
    },
    resetSessionTokens: (state) => {
      state.sessionTotalTokens = 0;
      state.lastOpTokens = {
        prompt: 0,
        completion: 0,
        total: 0,
      };
    },
  },
});

export const { 
  setActiveTab, 
  setActiveSessionId, 
  setCurrentDomain, 
  setShowPresetPanel, 
  incrementChatKey, 
  incrementAnalyzeKey, 
  incrementVideoKey, 
  setUseThirdPartyGateway, 
  setUsePromptEnhance, 
  setShowTokenMonitor, 
  setLastOpTokens, 
  setSessionTotalTokens, 
  resetSessionTokens 
} = appSlice.actions;

export default appSlice.reducer;
