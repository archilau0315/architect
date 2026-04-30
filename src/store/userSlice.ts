import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserTier } from '../../types';

interface UserState {
  tier: UserTier;
  dailyPoints: number;
  purchasedPoints: number;
  bonusPoints: number;
  lastResetDate: string;
  showBetaBanner: boolean;
  totalConsumedPoints: number;
  lifetimeTokens: number;
  needsInviteVerify: boolean;
  avatar: string | null;
}

const initialState: UserState = {
  tier: 'free',
  dailyPoints: 200,
  purchasedPoints: 0,
  bonusPoints: 0,
  lastResetDate: '',
  showBetaBanner: false,
  totalConsumedPoints: 0,
  lifetimeTokens: 0,
  needsInviteVerify: false,
  avatar: null,
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
    setBonusPoints: (state, action: PayloadAction<number>) => {
      state.bonusPoints = action.payload;
    },
    setLastResetDate: (state, action: PayloadAction<string>) => {
      state.lastResetDate = action.payload;
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
    setAvatar: (state, action: PayloadAction<string | null>) => {
      state.avatar = action.payload;
    },
    consumePoints: (state, action: PayloadAction<number>) => {
      const amount = action.payload;
      const total = state.dailyPoints + state.purchasedPoints + state.bonusPoints;
      
      if (total >= amount) {
        let remainingToConsume = amount;
        let newDaily = state.dailyPoints;
        let newPurchased = state.purchasedPoints;
        let newBonus = state.bonusPoints;

        if (newDaily >= remainingToConsume) {
          newDaily -= remainingToConsume;
        } else {
          remainingToConsume -= newDaily;
          newDaily = 0;
          
          if (newBonus >= remainingToConsume) {
            newBonus -= remainingToConsume;
          } else {
            remainingToConsume -= newBonus;
            newBonus = 0;
            newPurchased -= remainingToConsume;
          }
        }

        state.dailyPoints = newDaily;
        state.purchasedPoints = newPurchased;
        state.bonusPoints = newBonus;
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
  setBonusPoints, 
  setLastResetDate, 
  setShowBetaBanner, 
  setTotalConsumedPoints, 
  setLifetimeTokens, 
  setNeedsInviteVerify,
  setAvatar, 
  consumePoints, 
  buyPoints 
} = userSlice.actions;

export default userSlice.reducer;
