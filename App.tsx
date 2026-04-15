
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout.tsx';
import ConversationView from './components/ConversationView.tsx';
import SettingsPanel from './components/SettingsPanel.tsx';
import InviteVerify from './components/InviteVerify.tsx';
import { VersionRecord, UserPreferences, CustomModel, CreativeDomain, UserTier, ConversationMode, AppTab } from './types.ts';
import { GeminiService, DEFAULT_SYSTEM_PRESETS } from './services/geminiService.ts';
import { getProxiedUrl } from './services/apiService';

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

const DEVELOPER_PASSWORD = (import.meta as any).env?.VITE_DEV_PASSWORD ?? null;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('architect');
  const [architectKey, setArchitectKey] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [currentDomain, setCurrentDomain] = useState<CreativeDomain>('architecture');
  const [userTier, setUserTier] = useState<UserTier>('pro');
  const [needsInviteVerify, setNeedsInviteVerify] = useState(false);
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

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
  
  const [preferences, setPreferences] = useState<UserPreferences>({
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
  });
  const [models, setModels] = useState<CustomModel[]>([
    { id: 'KbitAi-Pro', name: 'KbitAi-Pro-Core', modelId: 'KbitAi-Pro', isOfficial: true },
    { id: 'KbitAi-Flash', name: 'KbitAi-Flash-Speed', modelId: 'KbitAi-Flash', isOfficial: true },
    { id: 'KbitAi-Image', name: 'KbitAi-Image-Engine', modelId: 'KbitAi-Image', isOfficial: true }
  ]);
  
  const [activeModelId, setActiveModelId] = useState<string>('KbitAi-Flash');
  const [modelStatus, setModelStatus] = useState<'connected' | 'assigning' | 'error'>('connected');
  const [dynamicModelName, setDynamicModelName] = useState<string>('');
  
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [analyzeKey, setAnalyzeKey] = useState(0); // kept for compatibility
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
    let balanceInterval: NodeJS.Timeout | null = null;

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

        // 强制使用商业网关模式（默认且推荐）
        setUseThirdPartyGateway(true);
        GeminiService.setGatewayMode(true);
        localStorage.setItem(GATEWAY_MODE_KEY, 'true');
        console.log('[初始化] 已设置网关模式: 商业/网关（默认）');

        const savedDomain = localStorage.getItem(DOMAIN_KEY) as CreativeDomain;
        if (savedDomain) setCurrentDomain(savedDomain);

        // 获取用户等级（优先从后端获取）
        let savedTier: UserTier = localStorage.getItem(USER_TIER_KEY) as UserTier || 'free';
        try {
          const userInfoUrl = getProxiedUrl('https://api.kbitai.com.cn/api/ph8/user-info');
          const response = await fetch(userInfoUrl);
          const data = await response.json();
          if (data.success && data.data?.tier) {
            savedTier = data.data.tier as UserTier;
            localStorage.setItem(USER_TIER_KEY, savedTier);
            // 同步后端积分数据
            if (data.data.daily_points !== undefined) {
              setDailyPoints(data.data.daily_points);
              setPurchasedPoints(data.data.purchased_points || 0);
              setTotalConsumedPoints(data.data.total_consumed_points || 0);
            }
            console.log('[初始化] 从后端获取用户等级:', savedTier);
          } else {
            console.log('[初始化] 从本地存储获取用户等级:', savedTier);
          }
        } catch (error) {
          console.error('[初始化] 获取用户等级失败:', error);
        }
        setUserTier(savedTier);

        // 从后端获取实时余额和消耗数据
        const fetchBalance = async () => {
          try {
            const session = localStorage.getItem('architect-invite-session');
            if (!session) return;

            const sessionData = JSON.parse(session);
            if (!sessionData.token) return;
            const userId = sessionData.user_id || sessionData.email;

            const balanceUrl = getProxiedUrl('https://api.kbitai.com.cn/api/user/quota');
            const response = await fetch(balanceUrl, {
              headers: {
                'Authorization': `Bearer ${sessionData.token}`,
                'Content-Type': 'application/json'
              }
            });
            const result = await response.json();
            if (result.success && result.data) {
              const { points } = result.data;
              // 正确同步每日积分和购买积分
              setDailyPoints(points.daily || 0);
              setPurchasedPoints(points.purchased || 0);
              setTotalConsumedPoints(points.total_consumed || 0);
              console.log('[余额同步] 每日积分:', points.daily, '购买积分:', points.purchased, '总消耗:', points.total_consumed);
            }
          } catch (error) {
            console.error('[余额同步] 获取余额失败:', error);
          }
        };

        // 初始化时获取一次
        await fetchBalance();

        // 每30秒自动刷新余额
        balanceInterval = setInterval(fetchBalance, 30000);

        // 检查是否需要邀请码验证
        const savedInviteSession = localStorage.getItem('architect-invite-session');
        if (!savedInviteSession) {
          setNeedsInviteVerify(true);
        }
        
        // Beta Banner initialization
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
            // Merge with defaults to ensure all properties exist
            const mergedPrefs = {
              promptFontSize: 18,
              chatFontSize: 15,
              theme: 'dark',
              accentColor: '#3B82F6',
              borderRadius: 'normal',
              density: 'normal',
              animationSpeed: 'normal',
              showWelcomeMessage: true,
              autoSaveHistory: true,
              compactSidebar: false,
              fontSize: 'medium',
              ...prefs
            };
            setPreferences(mergedPrefs);

            // Clean up old theme classes
            document.documentElement.classList.remove('light', 'dark');

            // Apply saved theme
            if (mergedPrefs.theme && mergedPrefs.theme !== 'dark') {
              document.documentElement.setAttribute('data-theme', mergedPrefs.theme);
            } else {
              document.documentElement.removeAttribute('data-theme');
            }

            // light-mode class controlled solely by lightMode flag
            if (mergedPrefs.lightMode) {
              document.documentElement.classList.add('light-mode');
            } else {
              document.documentElement.classList.remove('light-mode');
            }

            // Apply all CSS variables
            document.documentElement.style.setProperty('--accent-color', mergedPrefs.accentColor);

            const radiusMap = { sharp: '0px', normal: '0.5rem', rounded: '0.75rem', pill: '9999px' };
            document.documentElement.style.setProperty('--border-radius', radiusMap[mergedPrefs.borderRadius]);

            const densityMap = { compact: '0.75', normal: '1', comfortable: '1.25' };
            document.documentElement.style.setProperty('--density-scale', densityMap[mergedPrefs.density]);

            const speedMap = { none: '0s', fast: '0.15s', normal: '0.3s', slow: '0.5s' };
            document.documentElement.style.setProperty('--animation-duration', speedMap[mergedPrefs.animationSpeed]);

            const fontSizeMap = { small: '12px', medium: '14px', large: '16px' };
            document.documentElement.style.setProperty('--base-font-size', fontSizeMap[mergedPrefs.fontSize]);
            document.documentElement.setAttribute('data-font-size', mergedPrefs.fontSize || 'medium');

            // 设置默认语言
            if (!mergedPrefs.language) {
              mergedPrefs.language = 'zh-CN';
            }
            document.documentElement.lang = mergedPrefs.language;
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

    // 清理定时器
    return () => {
      if (balanceInterval) {
        clearInterval(balanceInterval);
      }
    };
  }, []);

  useEffect(() => {
    const active = models.find(m => m.id === activeModelId);
    if (active) setDynamicModelName(active.name || active.modelId);
  }, [activeModelId, models]);

  // Handler for updating user preferences
  const handlePreferencesChange = (newPrefs: UserPreferences) => {
    console.log('[handlePreferencesChange] New theme:', newPrefs.theme);
    setPreferences(newPrefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));

    // Clean up old theme classes
    document.documentElement.classList.remove('light', 'dark');

    // Apply theme to document
    if (newPrefs.theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newPrefs.theme);
    }

    // Add light-mode class controlled solely by lightMode flag
    if (newPrefs.lightMode) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }

    // Apply accent color as CSS variable
    document.documentElement.style.setProperty('--accent-color', newPrefs.accentColor);

    // Apply border radius
    const radiusMap = {
      sharp: '0px',
      normal: '0.5rem',
      rounded: '0.75rem',
      pill: '9999px'
    };
    document.documentElement.style.setProperty('--border-radius', radiusMap[newPrefs.borderRadius]);

    // Apply density
    const densityMap = {
      compact: '0.75',
      normal: '1',
      comfortable: '1.25'
    };
    document.documentElement.style.setProperty('--density-scale', densityMap[newPrefs.density]);

    // Apply animation speed
    const speedMap = {
      none: '0s',
      fast: '0.15s',
      normal: '0.3s',
      slow: '0.5s'
    };
    document.documentElement.style.setProperty('--animation-duration', speedMap[newPrefs.animationSpeed]);

    // Apply font size
    const fontSizeMap = {
      small: '12px',
      medium: '14px',
      large: '16px'
    };
    document.documentElement.style.setProperty('--base-font-size', fontSizeMap[newPrefs.fontSize]);
    // data-font-size 驱动 CSS --font-scale，覆盖 text-[Npx] 固定写法
    document.documentElement.setAttribute('data-font-size', newPrefs.fontSize);
    // lang 属性驱动多语言字体族
    document.documentElement.lang = newPrefs.language || 'zh-CN';
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
  };

  const handleImportFromAnalyzer = (_p: any) => {
    setActiveTab('architect');
  };

  const savePoints = (daily: number, purchased: number, date: string) => {
    localStorage.setItem(POINTS_KEY, JSON.stringify({ daily, purchased, lastReset: date }));
  };

  const handleConsumePoints = useCallback(async (amount: number): Promise<boolean> => {
    // 开发者模式或开发模式（使用官方API）不消耗点数
    if (isDeveloperMode || !useThirdPartyGateway) {
      return true;
    }

    // 先做本地余额预检（快速失败，避免无效请求）
    const total = dailyPoints + purchasedPoints;
    if (total < amount) {
      showToast(`积分余额不足，当前剩余 ${total} 积分。`);
      return false;
    }

    // 调用后端扣减（服务端做最终校验）
    try {
      const session = localStorage.getItem('architect-invite-session');
      const userId = session ? (JSON.parse(session).user_id || JSON.parse(session).email) : null;
      if (!userId) return false;

      const res = await fetch('/api/user/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ amount, description: 'AI generation' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || '积分扣减失败');
        return false;
      }

      // 乐观更新本地 UI
      const dailyUsed = Math.min(dailyPoints, amount);
      const purchasedUsed = amount - dailyUsed;
      const newDaily = dailyPoints - dailyUsed;
      const newPurchased = purchasedPoints - purchasedUsed;
      setDailyPoints(newDaily);
      setPurchasedPoints(newPurchased);
      savePoints(newDaily, newPurchased, lastResetDate);
      const newTotalConsumed = totalConsumedPoints + amount;
      setTotalConsumedPoints(newTotalConsumed);
      localStorage.setItem(TOTAL_CONSUMED_POINTS_KEY, newTotalConsumed.toString());
      return true;
    } catch (err) {
      console.error('[consumePoints]', err);
      showToast('网络错误，积分扣减失败');
      return false;
    }
  }, [isDeveloperMode, useThirdPartyGateway, dailyPoints, purchasedPoints, totalConsumedPoints, lastResetDate, savePoints]);

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

    // 必须提供密码，且后端必须配置了密码
    if (!providedPassword || !DEVELOPER_PASSWORD) return false;

    const password = providedPassword.trim();

    // 开发者模式口令
    if (password === DEVELOPER_PASSWORD) {
      setIsDeveloperMode(true);
      // 开发者模式仍走商业网关
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
    <>
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      currentDomain={currentDomain}
      onDomainChange={(d) => { setCurrentDomain(d); localStorage.setItem(DOMAIN_KEY, d); }}
      onDomainDoubleClick={() => setShowPresetPanel(p => !p)}
      isDeveloper={isDeveloper}
      isDeveloperMode={isDeveloperMode}
      userTier={userTier}
      onToggleDeveloper={handleToggleDeveloper}
      onToggleSystemVisible={() => setIsSystemVisible(!isSystemVisible)}
      onOpenSettings={() => setIsSettingsOpen(true)}
      currentModelName={dynamicModelName}
      modelStatus={modelStatus}
      dailyUsage={totalConsumedPoints}
      balance={dailyPoints + purchasedPoints}
      activeSessionId={activeSessionId}
      onSessionChange={(id, mode) => {
        setActiveSessionId(id);
        if (mode) {
          const modeToTab: Record<ConversationMode, AppTab> = { chat: 'chat', architect: 'architect', video: 'video' };
          setActiveTab(modeToTab[mode]);
        }
      }}
      preferences={preferences}
      onPreferencesChange={handlePreferencesChange}
    >
      {/* ── Gemini-style conversation ── */}
      <ConversationView
        key={architectKey}
        modelConfig={activeModel}
        domain={currentDomain}
        instructions={currentInstructions}
        points={{ daily: dailyPoints, purchased: purchasedPoints }}
        onConsumePoints={handleConsumePoints}
        useThirdPartyGateway={useThirdPartyGateway}
        isDeveloperMode={isDeveloperMode}
        showPresetPanel={showPresetPanel}
        onTogglePresetPanel={() => setShowPresetPanel(p => !p)}
        language={preferences.language}
        theme={preferences.theme}
      />

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
    {toast && (
      <div style={{position:'fixed',bottom:'2rem',left:'50%',transform:'translateX(-50%)',background:'rgba(30,30,40,0.95)',color:'#fff',padding:'0.75rem 1.5rem',borderRadius:'0.75rem',zIndex:9999,boxShadow:'0 4px 24px rgba(0,0,0,0.4)',fontSize:'14px',maxWidth:'90vw',textAlign:'center'}}>
        {toast}
      </div>
    )}
    </>
  );
};

export default App;
