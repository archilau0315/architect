import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import appReducer from './appSlice';
import preferencesReducer from './preferencesSlice';
import modelsReducer from './modelsSlice';
import systemReducer from './systemSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    app: appReducer,
    preferences: preferencesReducer,
    models: modelsReducer,
    system: systemReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
