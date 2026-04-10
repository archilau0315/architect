import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserTier } from '../../types';

interface UserState {
  tier: UserTier;
  dailyPoints: number;
  purchasedPoints: number;
  lastResetDate: string;
  betaTotalPoints: number;
  betaDailyUsed: number;
  showBetaBanner: boolean;
  totalConsumedPoints: number;
  lifetimeTokens: number;
  needsInviteVerify: boolean;
}

const initialState: UserState = {
  tier: 'free',
  dailyPoints: 150,
  purchasedPoints: 0,
  lastResetDate: '',
  betaTotalPoints: 1000,
  betaDailyUsed: 0,
  showBetaBanner: false,
  totalConsumedPoints: 0,
  lifetimeTokens: 0,
  needsInviteVerify: false,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserTier: (state, action: PayloadAction<UserTier>) => {
      state.tier = action.payload;
    },
    setDailyPoints: (state, action: PayloadAction<number>) => {
      state.dailyPoints = action.payload;
    },
    setPurchasedPoints: (state, action: PayloadAction<number>) => {
      state.purchasedPoints = action.payload;
    },
    setLastResetDate: (state, action: PayloadAction<string>) => {
      state.lastResetDate = action.payload;
    },
    setBetaTotalPoints: (state, action: PayloadAction<number>) => {
      state.betaTotalPoints = action.payload;
    },
    setBetaDailyUsed: (state, action: PayloadAction<number>) => {
      state.betaDailyUsed = action.payload;
    },
    setShowBetaBanner: (state, action: PayloadAction<boolean>) => {
      state.showBetaBanner = action.payload;
    },
    setTotalConsumedPoints: (state, action: PayloadAction<number>) => {
      state.totalConsumedPoints = action.payload;
    },
    setLifetimeTokens: (state, action: PayloadAction<number>) => {
      state.lifetimeTokens = action.payload;
    },
    setNeedsInviteVerify: (state, action: PayloadAction<boolean>) => {
      state.needsInviteVerify = action.payload;
    },
    consumePoints: (state, action: PayloadAction<number>) => {
      const amount = action.payload;
      const total = state.dailyPoints + state.purchasedPoints;
      
      if (total >= amount) {
        let remainingToConsume = amount;
        let newDaily = state.dailyPoints;
        let newPurchased = state.purchasedPoints;

        if (newDaily >= remainingToConsume) {
          newDaily -= remainingToConsume;
        } else {
          remainingToConsume -= newDaily;
          newDaily = 0;
          newPurchased -= remainingToConsume;
        }

        state.dailyPoints = newDaily;
        state.purchasedPoints = newPurchased;
        state.totalConsumedPoints += amount;
      }
    },
    buyPoints: (state, action: PayloadAction<number>) => {
      state.purchasedPoints += action.payload;
    },
  },
});

export const { 
  setUserTier, 
  setDailyPoints, 
  setPurchasedPoints, 
  setLastResetDate, 
  setBetaTotalPoints, 
  setBetaDailyUsed, 
  setShowBetaBanner, 
  setTotalConsumedPoints, 
  setLifetimeTokens, 
  setNeedsInviteVerify, 
  consumePoints, 
  buyPoints 
} = userSlice.actions;

export default userSlice.reducer;
