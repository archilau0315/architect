import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserPreferences, AppTheme, Language } from '../../types';

const initialState: UserPreferences = {
  promptFontSize: 18,
  chatFontSize: 15,
  theme: 'dark',
  language: 'zh-CN',
  accentColor: '#3B82F6',
  borderRadius: 'normal',
  density: 'normal',
  animationSpeed: 'normal',
  showWelcomeMessage: true,
  autoSaveHistory: true,
  compactSidebar: false,
  fontSize: 'medium',
  lightMode: false
};

export const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setPreferences: (_state, action: PayloadAction<UserPreferences>) => {
      return action.payload;
    },
    setPromptFontSize: (state, action: PayloadAction<number>) => {
      state.promptFontSize = action.payload;
    },
    setChatFontSize: (state, action: PayloadAction<number>) => {
      state.chatFontSize = action.payload;
    },
    setTheme: (state, action: PayloadAction<AppTheme>) => {
      state.theme = action.payload;
    },
    setAccentColor: (state, action: PayloadAction<string>) => {
      state.accentColor = action.payload;
    },
    setBorderRadius: (state, action: PayloadAction<UserPreferences['borderRadius']>) => {
      state.borderRadius = action.payload;
    },
    setDensity: (state, action: PayloadAction<UserPreferences['density']>) => {
      state.density = action.payload;
    },
    setAnimationSpeed: (state, action: PayloadAction<UserPreferences['animationSpeed']>) => {
      state.animationSpeed = action.payload;
    },
    setShowWelcomeMessage: (state, action: PayloadAction<boolean>) => {
      state.showWelcomeMessage = action.payload;
    },
    setAutoSaveHistory: (state, action: PayloadAction<boolean>) => {
      state.autoSaveHistory = action.payload;
    },
    setCompactSidebar: (state, action: PayloadAction<boolean>) => {
      state.compactSidebar = action.payload;
    },
    setFontSize: (state, action: PayloadAction<UserPreferences['fontSize']>) => {
      state.fontSize = action.payload;
    },
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    },
  },
});

export const {
  setPreferences,
  setPromptFontSize,
  setChatFontSize,
  setTheme,
  setAccentColor,
  setBorderRadius,
  setDensity,
  setAnimationSpeed,
  setShowWelcomeMessage,
  setAutoSaveHistory,
  setCompactSidebar,
  setFontSize,
  setLanguage
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
