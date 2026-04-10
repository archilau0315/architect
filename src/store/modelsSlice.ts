import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CustomModel } from '../../types';

interface ModelsState {
  models: CustomModel[];
  activeModelId: string;
  modelStatus: 'connected' | 'assigning' | 'error';
  dynamicModelName: string;
}

const initialState: ModelsState = {
  models: [
    { id: 'KbitAi-Pro', name: 'KbitAi-Pro-Core', modelId: 'KbitAi-Pro', isOfficial: true },
    { id: 'KbitAi-Flash', name: 'KbitAi-Flash-Speed', modelId: 'KbitAi-Flash', isOfficial: true },
    { id: 'KbitAi-Image', name: 'KbitAi-Image-Engine', modelId: 'KbitAi-Image', isOfficial: true }
  ],
  activeModelId: 'KbitAi-Flash',
  modelStatus: 'connected',
  dynamicModelName: '',
};

export const modelsSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    setModels: (state, action: PayloadAction<CustomModel[]>) => {
      state.models = action.payload;
    },
    setActiveModelId: (state, action: PayloadAction<string>) => {
      state.activeModelId = action.payload;
    },
    setModelStatus: (state, action: PayloadAction<'connected' | 'assigning' | 'error'>) => {
      state.modelStatus = action.payload;
    },
    setDynamicModelName: (state, action: PayloadAction<string>) => {
      state.dynamicModelName = action.payload;
    },
  },
});

export const { 
  setModels, 
  setActiveModelId, 
  setModelStatus, 
  setDynamicModelName 
} = modelsSlice.actions;

export default modelsSlice.reducer;
