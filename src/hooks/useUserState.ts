import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
  setUserTier,
  setDailyPoints,
  setPurchasedPoints,
  setLastResetDate,
  setShowBetaBanner,
  setTotalConsumedPoints,
  setLifetimeTokens,
  setNeedsInviteVerify,
  consumePoints,
  buyPoints,
} from '../store/userSlice';
import { UserTier } from '../../types';

export const useUserState = () => {
  const dispatch = useDispatch<AppDispatch>();
  const userState = useSelector((state: RootState) => state.user);

  return {
    ...userState,
    setUserTier: (tier: UserTier) => dispatch(setUserTier(tier)),
    setDailyPoints: (points: number) => dispatch(setDailyPoints(points)),
    setPurchasedPoints: (points: number) => dispatch(setPurchasedPoints(points)),
    setLastResetDate: (date: string) => dispatch(setLastResetDate(date)),
    setShowBetaBanner: (show: boolean) => dispatch(setShowBetaBanner(show)),
    setTotalConsumedPoints: (points: number) => dispatch(setTotalConsumedPoints(points)),
    setLifetimeTokens: (tokens: number) => dispatch(setLifetimeTokens(tokens)),
    setNeedsInviteVerify: (needs: boolean) => dispatch(setNeedsInviteVerify(needs)),
    consumePoints: (amount: number) => dispatch(consumePoints(amount)),
    buyPoints: (amount: number) => dispatch(buyPoints(amount)),
  };
};
