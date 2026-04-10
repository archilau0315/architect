import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VersionRecord } from '../../types';
import { DEFAULT_SYSTEM_PRESETS } from '../../services/configService';

interface SystemState {
  versionHistory: VersionRecord[];
  currentInstructions: any;
  isDeveloperMode: boolean;
  isSettingsOpen: boolean;
  isSystemVisible: boolean;
  architectKey: number;
}

const initialState: SystemState = {
  versionHistory: [],
  currentInstructions: DEFAULT_SYSTEM_PRESETS,
  isDeveloperMode: false,
  isSettingsOpen: false,
  isSystemVisible: false,
  architectKey: 0,
};

export const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    setVersionHistory: (state, action: PayloadAction<VersionRecord[]>) => {
      state.versionHistory = action.payload;
    },
    setCurrentInstructions: (state, action: PayloadAction<any>) => {
      state.currentInstructions = action.payload;
    },
    setIsDeveloperMode: (state, action: PayloadAction<boolean>) => {
      state.isDeveloperMode = action.payload;
    },
    setIsSettingsOpen: (state, action: PayloadAction<boolean>) => {
      state.isSettingsOpen = action.payload;
    },
    setIsSystemVisible: (state, action: PayloadAction<boolean>) => {
      state.isSystemVisible = action.payload;
    },
    incrementArchitectKey: (state) => {
      state.architectKey += 1;
    },
    addVersion: (state, action: PayloadAction<VersionRecord>) => {
      state.versionHistory = [action.payload, ...state.versionHistory];
    },
  },
});

export const { 
  setVersionHistory, 
  setCurrentInstructions, 
  setIsDeveloperMode, 
  setIsSettingsOpen, 
  setIsSystemVisible, 
  incrementArchitectKey, 
  addVersion 
} = systemSlice.actions;

export default systemSlice.reducer;
