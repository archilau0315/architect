import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
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
  resetSessionTokens,
} from '../store/appSlice';
import { AppTab, CreativeDomain } from '../../types';

export const useAppState = () => {
  const dispatch = useDispatch<AppDispatch>();
  const appState = useSelector((state: RootState) => state.app);

  return {
    ...appState,
    setActiveTab: (tab: AppTab) => dispatch(setActiveTab(tab)),
    setActiveSessionId: (id: string) => dispatch(setActiveSessionId(id)),
    setCurrentDomain: (domain: CreativeDomain) => dispatch(setCurrentDomain(domain)),
    setShowPresetPanel: (show: boolean) => dispatch(setShowPresetPanel(show)),
    incrementChatKey: () => dispatch(incrementChatKey()),
    incrementAnalyzeKey: () => dispatch(incrementAnalyzeKey()),
    incrementVideoKey: () => dispatch(incrementVideoKey()),
    setUseThirdPartyGateway: (enabled: boolean) => dispatch(setUseThirdPartyGateway(enabled)),
    setUsePromptEnhance: (enabled: boolean) => dispatch(setUsePromptEnhance(enabled)),
    setShowTokenMonitor: (show: boolean) => dispatch(setShowTokenMonitor(show)),
    setLastOpTokens: (tokens: { prompt: number; completion: number; total: number }) =>
      dispatch(setLastOpTokens(tokens)),
    setSessionTotalTokens: (tokens: number) => dispatch(setSessionTotalTokens(tokens)),
    resetSessionTokens: () => dispatch(resetSessionTokens()),
  };
};
