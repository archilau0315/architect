
import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout.tsx';
import PromptEnhancer from './components/PromptEnhancer.tsx';
import ImageGenerator from './components/ImageGenerator.tsx';
import ChatBot from './components/ChatBot.tsx'; 
import ImageAnalyzer from './components/ImageAnalyzer.tsx';
import VideoGenerator from './components/VideoGenerator.tsx';
import SettingsPanel from './components/SettingsPanel.tsx';
import BetaPolicyBanner from './components/BetaPolicyBanner.tsx';
import InviteVerify from './components/InviteVerify.tsx';
import { AppTab, VersionRecord, UserPreferences, CustomModel, HistoryItem, CreativeDomain, UserTier } from './types.ts';
import { GeminiService, DEFAULT_SYSTEM_PRESETS, EnhancedPrompt } from './services/geminiService.ts';
import { Ph8UsageService, Ph8UsageData } from './services/ph8UsageService.ts';

const DEV_MODE_KEY = 'architect-dev-mode-enabled-v121';
const VERSION_LOG_KEY = 'architect-system-version-log-v121';
const CURRENT_INSTRUCTIONS_KEY = 'architect-current-instructions-v121';
const PREFS_KEY = 'architect-user-prefs-v130';
const MODELS_KEY = 'architect-custom-models-v130';
const ACTIVE_MODEL_ID_KEY = 'architect-active-model-id-v130';
const DOMAIN_KEY = 'architect-creative-domain-v150';
const USER_TIER_KEY = 'architect-user-tier-v150';
const POINTS_KEY = 'architect-user-points-v160';
const GATEWAY_MODE_KEY = 'architect-gateway-mode-v100';
const TOKEN_MONITOR_VISIBLE_KEY = 'architect-token-monitor-visible-v100';
const TOTAL_CONSUMED_POINTS_KEY = 'architect-total-consumed-points-v100';
const LIFETIME_TOKENS_KEY = 'architect-lifetime-tokens-v100';
const PROMPT_ENHANCE_KEY = 'architect-prompt-enhance-v100';

const TIER_CONFIG = {
  free: { daily: 100, label: '免费用户' },
  beta: { daily: 200, label: '内测用户', total: 1000 },
  basic: { daily: 350, label: '基础级' },
  pro: { daily: 800, label: 'PRO 级' },
  plus: { daily: 1800, label: 'PLUS 级' }
};

const DEVELOPER_PASSWORD = (import.meta as any).env?.VITE_DEV_PASSWORD || '';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('architect');
  const [currentDomain, setCurrentDomain] = useState<CreativeDomain>('architecture');
  const [rawIdea, setRawIdea] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState<EnhancedPrompt>({ zh: '', en: '', analysis: '' });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [userTier, setUserTier] = useState<UserTier>('pro');
  const [needsInviteVerify, setNeedsInviteVerify] = useState(false);
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  
  // Points State
  const [dailyPoints, setDailyPoints] = useState(150);
  const [purchasedPoints, setPurchasedPoints] = useState(0);
  const [lastResetDate, setLastResetDate] = useState('');
  
  // Beta User State
  const [betaTotalPoints, setBetaTotalPoints] = useState(1000);
  const [betaDailyUsed, setBetaDailyUsed] = useState(0);
  const [showBetaBanner, setShowBetaBanner] = useState(false);

  const [versionHistory, setVersionHistory] = useState<VersionRecord[]>([]);
  const [currentInstructions, setCurrentInstructions] = useState(DEFAULT_SYSTEM_PRESETS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [preferences, setPreferences] = useState<UserPreferences>({ promptFontSize: 18, chatFontSize: 15, theme: 'indigo' });
  const [models, setModels] = useState<CustomModel[]>([
    { id: 'KbitAi-Pro', name: 'KbitAi-Pro-Core', modelId: 'KbitAi-Pro', isOfficial: true },
    { id: 'KbitAi-Flash', name: 'KbitAi-Flash-Speed', modelId: 'KbitAi-Flash', isOfficial: true },
    { id: 'KbitAi-Image', name: 'KbitAi-Image-Engine', modelId: 'KbitAi-Image', isOfficial: true }
  ]);
  
  const [activeModelId, setActiveModelId] = useState<string>('KbitAi-Flash');
  const [modelStatus, setModelStatus] = useState<'connected' | 'assigning' | 'error'>('connected');
  const [dynamicModelName, setDynamicModelName] = useState<string>('');
  
  const [architectKey, setArchitectKey] = useState(0);
  const [chatKey, setChatKey] = useState(0);
  const [analyzeKey, setAnalyzeKey] = useState(0);
  const [videoKey, setVideoKey] = useState(0);
  const [isSystemVisible, setIsSystemVisible] = useState(false);
  const [useThirdPartyGateway, setUseThirdPartyGateway] = useState(true);
  const [usePromptEnhance, setUsePromptEnhance] = useState(true);
  const [showTokenMonitor, setShowTokenMonitor] = useState(false);
  const [lastOpTokens, setLastOpTokens] = useState({ prompt: 0, completion: 0, total: 0 });
  const [sessionTotalTokens, setSessionTotalTokens] = useState(0);
  const [totalConsumedPoints, setTotalConsumedPoints] = useState(0);
  const [lifetimeTokens, setLifetimeTokens] = useState(0);

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedTokenMonitor = localStorage.getItem(TOKEN_MONITOR_VISIBLE_KEY);
        if (savedTokenMonitor) setShowTokenMonitor(savedTokenMonitor === 'true');

        const savedConsumed = localStorage.getItem(TOTAL_CONSUMED_POINTS_KEY);
        if (savedConsumed) setTotalConsumedPoints(parseFloat(savedConsumed));

        const savedLifetime = localStorage.getItem(LIFETIME_TOKENS_KEY);
        if (savedLifetime) setLifetimeTokens(parseInt(savedLifetime));

        const savedPromptEnhance = localStorage.getItem(PROMPT_ENHANCE_KEY);
        if (savedPromptEnhance) setUsePromptEnhance(savedPromptEnhance === 'true');

        GeminiService.setTokenReportHandler((usage) => {
          setLastOpTokens({
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens
          });
          setSessionTotalTokens(prev => prev + usage.totalTokens);
          setLifetimeTokens(prev => {
            const next = prev + usage.totalTokens;
            localStorage.setItem(LIFETIME_TOKENS_KEY, next.toString());
            return next;
          });
        });

        const savedGatewayMode = localStorage.getItem(GATEWAY_MODE_KEY);
        console.log('[初始化] localStorage 中的网关模式值:', savedGatewayMode, '类型:', typeof savedGatewayMode);
        const isEnabled = savedGatewayMode === null ? true : savedGatewayMode === 'true';
        console.log('[初始化] 解析后的布尔值:', isEnabled);
        setUseThirdPartyGateway(true);
        GeminiService.setGatewayMode(true);
        localStorage.setItem(GATEWAY_MODE_KEY, 'true');
        console.log('[初始化] 已设置网关模式: 商业/网关');
        const savedDomain = localStorage.getItem(DOMAIN_KEY) as CreativeDomain;
        if (savedDomain) setCurrentDomain(savedDomain);

        const savedTier = localStorage.getItem(USER_TIER_KEY) as UserTier || 'free';
        
        // 检查是否需要邀请码验证
        const savedInviteSession = localStorage.getItem('architect-invite-session');
        if (!savedInviteSession) {
          setNeedsInviteVerify(true);
        } else {
          setUserTier(savedTier);
        }
        
        // Beta Banner initialization - 对所有用户显示，先清除之前的关闭状态
        localStorage.removeItem('architect-beta-banner-closed');
        const betaBannerClosed = localStorage.getItem('architect-beta-banner-closed');
        if (savedTier !== 'free' && betaBannerClosed !== 'true') {
          setShowBetaBanner(true);
        }

        // Points Initialization
        const today = new Date().toDateString();
        const savedPointsData = localStorage.getItem(POINTS_KEY);
        if (savedPointsData) {
          const { daily, purchased, lastReset } = JSON.parse(savedPointsData);
          
          // Beta 用户特殊处理：确保注册赠送积分
          if (savedTier === 'beta' && (!purchased || purchased < 1000)) {
            setPurchasedPoints(1000);
            setDailyPoints(200);
            setLastResetDate(today);
            savePoints(200, 1000, today);
          } else {
            setPurchasedPoints(purchased || 0);
            if (lastReset === today) {
              setDailyPoints(daily);
              setLastResetDate(lastReset);
            } else {
              const newDaily = TIER_CONFIG[savedTier as keyof typeof TIER_CONFIG]?.daily || 200;
              setDailyPoints(newDaily);
              setLastResetDate(today);
              savePoints(newDaily, purchased || 0, today);
            }
          }
        } else {
          // 新用户初始化
          if (savedTier === 'beta') {
            setDailyPoints(200);
            setPurchasedPoints(1000);
            setLastResetDate(today);
            savePoints(200, 1000, today);
          } else {
            const initialDaily = TIER_CONFIG[savedTier as keyof typeof TIER_CONFIG]?.daily || 200;
            setDailyPoints(initialDaily);
            setLastResetDate(today);
            savePoints(initialDaily, 0, today);
          }
        }
        
        const savedInstructions = localStorage.getItem(CURRENT_INSTRUCTIONS_KEY);
        if (savedInstructions) {
          try { setCurrentInstructions(JSON.parse(savedInstructions)); } catch(e) { console.error("Bad instructions data"); }
        }
        
        const savedPrefs = localStorage.getItem(PREFS_KEY);
        if (savedPrefs) {
          try { 
            const prefs = JSON.parse(savedPrefs);
            setPreferences(prefs);
            // Apply saved theme
            if (prefs.theme && prefs.theme !== 'indigo') {
              document.documentElement.setAttribute('data-theme', prefs.theme);
            }
          } catch(e) { console.error("Bad prefs data"); }
        }
        
        const savedModels = localStorage.getItem(MODELS_KEY);
        if (savedModels) {
          try { setModels(JSON.parse(savedModels)); } catch(e) { console.error("Bad models data"); }
        }

        const savedActiveModelId = localStorage.getItem(ACTIVE_MODEL_ID_KEY);
        if (savedActiveModelId) setActiveModelId(savedActiveModelId);

        // Load version history from localStorage
        const savedVersionLog = localStorage.getItem(VERSION_LOG_KEY);
        if (savedVersionLog) {
          try { setVersionHistory(JSON.parse(savedVersionLog)); } catch(e) { console.error("Bad version log data"); }
        }
      } catch (err) { console.error("Initialization error", err); }
    };
    initApp();
  }, []);

  useEffect(() => {
    const active = models.find(m => m.id === activeModelId);
    if (active) setDynamicModelName(active.name || active.modelId);
  }, [activeModelId, models]);

  // Handler for updating user preferences
  const handlePreferencesChange = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
    
    // Apply theme to document
    if (newPrefs.theme === 'indigo') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newPrefs.theme);
    }
  };

  // Handler for updating custom models list
  const handleModelsChange = (newModels: CustomModel[]) => {
    setModels(newModels);
    localStorage.setItem(MODELS_KEY, JSON.stringify(newModels));
  };

  // Handler for changing the active model
  const handleActiveModelChange = (id: string) => {
    setActiveModelId(id);
    localStorage.setItem(ACTIVE_MODEL_ID_KEY, id);
  };

  const handleToggleGateway = (enabled: boolean) => {
    // 只有开发者模式才能切换网关，非开发者模式强制使用商业网关
    if (!isDeveloperMode) {
      console.log('[切换网关] 非开发者模式，禁止切换，强制使用商业网关');
      setUseThirdPartyGateway(true);
      GeminiService.setGatewayMode(true);
      localStorage.setItem(GATEWAY_MODE_KEY, 'true');
      return;
    }
    console.log('[切换网关] 用户点击切换，新值:', enabled);
    setUseThirdPartyGateway(enabled);
    GeminiService.setGatewayMode(enabled);
    localStorage.setItem(GATEWAY_MODE_KEY, enabled.toString());
    console.log('[切换网关] 已保存到 localStorage:', localStorage.getItem(GATEWAY_MODE_KEY));
  };

  const handleToggleTokenMonitor = (enabled: boolean) => {
    setShowTokenMonitor(enabled);
    localStorage.setItem(TOKEN_MONITOR_VISIBLE_KEY, enabled.toString());
  };

  const handleTogglePromptEnhance = (enabled: boolean) => {
    setUsePromptEnhance(enabled);
    localStorage.setItem(PROMPT_ENHANCE_KEY, enabled.toString());
  };

  const handleResetSessionTokens = () => {
    setSessionTotalTokens(0);
    setLastOpTokens({ prompt: 0, completion: 0, total: 0 });
  };

  // Handler for rolling back to a previous version of system instructions
  const handleRollback = (version: VersionRecord) => {
    if (version.presets) {
      setCurrentInstructions(version.presets);
      localStorage.setItem(CURRENT_INSTRUCTIONS_KEY, JSON.stringify(version.presets));
    }
  };

  // Handler for updating system instructions and creating a new version record
  const handleUpdateInstructions = (newPresets: any, note: string) => {
    setCurrentInstructions(newPresets);
    localStorage.setItem(CURRENT_INSTRUCTIONS_KEY, JSON.stringify(newPresets));
    
    const newVersion: VersionRecord = {
      version: `v1.${versionHistory.length + 1}`,
      timestamp: Date.now(),
      description: note,
      changes: [note],
      presets: newPresets
    };
    
    const newHistory = [newVersion, ...versionHistory];
    setVersionHistory(newHistory);
    localStorage.setItem(VERSION_LOG_KEY, JSON.stringify(newHistory));
  };

  const handleResetArchitect = () => {
    setArchitectKey(prev => prev + 1);
    setRawIdea('');
    setEnhancedPrompt({ zh: '', en: '', analysis: '' });
    setHistory([]);
  };

  const handleImportFromAnalyzer = (p: EnhancedPrompt) => {
    setActiveTab('architect');
    setRawIdea(p.zh);
    setEnhancedPrompt(p);
  };

  const savePoints = (daily: number, purchased: number, date: string) => {
    localStorage.setItem(POINTS_KEY, JSON.stringify({ daily, purchased, lastReset: date }));
  };

  const handleConsumePoints = (amount: number): boolean => {
    // 开发者模式或开发模式（使用官方API）不消耗点数
    if (isDeveloperMode || !useThirdPartyGateway) {
      return true;
    }

    // Beta 用户特殊逻辑：每日最多消耗 200 积分，从总余额中扣除
    if (userTier === 'beta') {
      const dailyLimit = 200;
      const todayConsumed = 200 - dailyPoints; // 今日已消耗
      
      if (todayConsumed + amount > dailyLimit) {
        window.alert(`内测用户每日限额 200 积分，今日已使用 ${todayConsumed} 积分，剩余 ${dailyPoints} 积分可用。`);
        return false;
      }
      
      if (purchasedPoints < amount) {
        return false;
      }
      
      const newPurchased = purchasedPoints - amount;
      const newDaily = dailyPoints - amount; // 用于追踪今日剩余额度
      
      setPurchasedPoints(newPurchased);
      setDailyPoints(Math.max(0, newDaily));
      savePoints(Math.max(0, newDaily), newPurchased, lastResetDate);
      
      const newTotalConsumed = totalConsumedPoints + amount;
      setTotalConsumedPoints(newTotalConsumed);
      localStorage.setItem(TOTAL_CONSUMED_POINTS_KEY, newTotalConsumed.toString());
      
      return true;
    }

    const total = dailyPoints + purchasedPoints;
    if (total < amount) return false;

    let remainingToConsume = amount;
    let newDaily = dailyPoints;
    let newPurchased = purchasedPoints;

    if (newDaily >= remainingToConsume) {
      newDaily -= remainingToConsume;
    } else {
      remainingToConsume -= newDaily;
      newDaily = 0;
      newPurchased -= remainingToConsume;
    }

    setDailyPoints(newDaily);
    setPurchasedPoints(newPurchased);
    savePoints(newDaily, newPurchased, lastResetDate);

    const newTotalConsumed = totalConsumedPoints + amount;
    setTotalConsumedPoints(newTotalConsumed);
    localStorage.setItem(TOTAL_CONSUMED_POINTS_KEY, newTotalConsumed.toString());
    
    return true;
  };

  const handleBuyPoints = (amount: number) => {
    const newPurchased = purchasedPoints + amount;
    setPurchasedPoints(newPurchased);
    savePoints(dailyPoints, newPurchased, lastResetDate);
  };

  // Handler for toggling developer mode with password protection
  const handleToggleDeveloper = useCallback((providedPassword?: string): boolean => {
    // 如果已经是开发者模式，退出开发者模式
    if (isDeveloperMode) {
      setIsDeveloperMode(false);
      // 退出开发者模式时，强制切换到商业模式
      setUseThirdPartyGateway(true);
      GeminiService.setGatewayMode(true);
      localStorage.setItem(GATEWAY_MODE_KEY, 'true');
      return false;
    }

    // 必须提供密码
    if (!providedPassword) return false;

    const password = providedPassword.trim();
    
    // 开发者模式口令
    if (password === DEVELOPER_PASSWORD) {
      setIsDeveloperMode(true);
      // 进入开发者模式时，切换到开发模式（官方通道）
      setUseThirdPartyGateway(false);
      GeminiService.setGatewayMode(false);
      localStorage.setItem(GATEWAY_MODE_KEY, 'false');
      return true;
    }

    return false;
  }, [isDeveloperMode]);

  const isDeveloper = isDeveloperMode;

  const activeModel = models.find(m => m.id === activeModelId) || models[0];

  const handleInviteVerified = (userData: { email: string; tier: string; points: number }) => {
    setUserTier(userData.tier as UserTier);
    setNeedsInviteVerify(false);
    setDailyPoints(200);
    setPurchasedPoints(userData.points || 1000);
    savePoints(200, userData.points || 1000, new Date().toDateString());
  };

  if (needsInviteVerify) {
    return <InviteVerify onVerified={handleInviteVerified} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      currentDomain={currentDomain}
      onDomainChange={(d) => { setCurrentDomain(d); localStorage.setItem(DOMAIN_KEY, d); }}
      isDeveloper={isDeveloper}
      isDeveloperMode={isDeveloperMode}
      userTier={userTier}
      onToggleDeveloper={handleToggleDeveloper}
      onToggleSystemVisible={() => setIsSystemVisible(!isSystemVisible)}
      onOpenSettings={() => setIsSettingsOpen(true)}
      currentModelName={dynamicModelName}
      modelStatus={modelStatus}
      dailyUsage={TIER_CONFIG[userTier].daily - dailyPoints}
      balance={userTier === 'beta' ? purchasedPoints : dailyPoints + purchasedPoints}
    >
      <div className="w-full h-full p-8 md:p-12 overflow-y-auto custom-scrollbar relative">
        {/* Token Monitor Window */}
        {showTokenMonitor && (
          <div className="fixed top-24 right-8 z-[100] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-right-4 duration-500 w-64 glass-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-theme-light rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Token Monitor</span>
              </div>
              <button 
                onClick={handleResetSessionTokens}
                className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 hover:text-theme transition-all"
                title="Reset Session"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Last Operation</p>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-500">P: {lastOpTokens.prompt}</span>
                  <span className="text-theme-light">C: {lastOpTokens.completion}</span>
                  <span className="font-black text-slate-900 dark:text-white">T: {lastOpTokens.total}</span>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Session Total</p>
                <p className="text-lg font-black italic text-theme font-mono">{sessionTotalTokens.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: activeTab === 'architect' ? 'block' : 'none' }}>
          <div className="max-w-7xl mx-auto space-y-12 pb-24">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-8">
               <div className="space-y-1">
                 <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight italic">全域渲染工坊 <span className="text-theme font-normal tracking-normal">Spatial Engine</span></h3>
                 <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] leading-none">High-Fidelity Architectural Synthesis & CMF Rendering</p>
               </div>
            </div>
            <PromptEnhancer 
              idea={rawIdea} 
              onIdeaChange={setRawIdea}
              result={enhancedPrompt}
              onResultChange={setEnhancedPrompt}
              instructions={currentInstructions}
              fontSize={preferences.promptFontSize}
              modelConfig={activeModel}
              domain={currentDomain}
              usePromptEnhance={usePromptEnhance}
              onTogglePromptEnhance={handleTogglePromptEnhance}
            />
            <ImageGenerator 
              currentPrompt={enhancedPrompt.en || rawIdea}
              history={history}
              onImageGenerated={(item) => setHistory([item, ...history])}
              onReset={handleResetArchitect}
              instructions={currentInstructions}
              fontSize={preferences.promptFontSize}
              modelConfig={activeModel}
              domain={currentDomain}
              userTier={userTier}
              points={{ daily: dailyPoints, purchased: purchasedPoints }}
              onConsumePoints={handleConsumePoints}
              useThirdPartyGateway={useThirdPartyGateway}
            />
          </div>
        </div>

        <div style={{ display: activeTab === 'chat' ? 'block' : 'none' }}>
          <ChatBot 
            instructions={currentInstructions} 
            fontSize={preferences.promptFontSize}
            modelConfig={activeModel}
          />
        </div>

        <div style={{ display: activeTab === 'analyze' ? 'block' : 'none' }}>
          <ImageAnalyzer 
            onImportToArchitect={handleImportFromAnalyzer}
            instructions={currentInstructions}
            modelConfig={activeModel}
          />
        </div>

        <div style={{ display: activeTab === 'video' ? 'block' : 'none' }}>
          <VideoGenerator 
            instructions={currentInstructions}
            fontSize={preferences.promptFontSize}
            userTier={userTier}
            points={{ daily: dailyPoints, purchased: purchasedPoints }}
            onConsumePoints={handleConsumePoints}
            useThirdPartyGateway={useThirdPartyGateway}
          />
        </div>
      </div>

      <SettingsPanel 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onPreferencesChange={handlePreferencesChange}
        models={models}
        onModelsChange={handleModelsChange}
        activeModelId={activeModelId}
        onActiveModelChange={handleActiveModelChange}
        versionHistory={versionHistory}
        currentPresets={currentInstructions}
        onRollback={handleRollback}
        onUpdateInstructions={handleUpdateInstructions}
        userTier={userTier}
        isDeveloperMode={isDeveloperMode}
        onToggleDeveloper={handleToggleDeveloper}
        isSystemVisible={isSystemVisible}
        points={{ daily: dailyPoints, purchased: purchasedPoints }}
        onBuyPoints={handleBuyPoints}
        useThirdPartyGateway={useThirdPartyGateway}
        onToggleGateway={handleToggleGateway}
        showTokenMonitor={showTokenMonitor}
        onToggleTokenMonitor={handleToggleTokenMonitor}
        usePromptEnhance={usePromptEnhance}
        onTogglePromptEnhance={handleTogglePromptEnhance}
      />
    </Layout>
  );
};

export default App;
