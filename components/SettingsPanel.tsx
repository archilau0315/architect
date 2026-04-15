
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserPreferences, CustomModel, VersionRecord, UserTier, AppTheme, Language } from '../types.ts';
import SystemSpec from './SystemSpec.tsx';
import { TERMS_OF_SERVICE } from '../legal/termsOfService.ts';
import { AVATAR_KEY } from '../constants.ts';
import { PRIVACY_POLICY } from '../legal/privacyPolicy.ts';
import { Ph8UsageService } from '../services/ph8UsageService.ts';
import { getTranslation } from '../i18n/locales.ts';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onPreferencesChange: (prefs: UserPreferences) => void;
  models: CustomModel[];
  onModelsChange: (models: CustomModel[]) => void;
  activeModelId: string;
  onActiveModelChange: (id: string) => void;
  versionHistory: VersionRecord[];
  currentPresets: any;
  onRollback: (version: VersionRecord) => void;
  onUpdateInstructions: (newPresets: any, note: string) => void;
  userTier: UserTier;
  isDeveloperMode?: boolean;
  onToggleDeveloper: (pass?: string) => boolean;
  isSystemVisible: boolean;
  points: { daily: number; purchased: number };
  onBuyPoints: (amount: number) => void;
  useThirdPartyGateway: boolean;
  onToggleGateway: (enabled: boolean) => void;
  showTokenMonitor: boolean;
  onToggleTokenMonitor: (enabled: boolean) => void;
  onLogout?: () => void;
  userInfo?: {
    email?: string;
    name?: string;
    avatar?: string;
  };
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  isOpen, onClose, preferences, onPreferencesChange, models, onModelsChange, 
  activeModelId, onActiveModelChange,
  versionHistory, currentPresets, onRollback, onUpdateInstructions,
  userTier, isDeveloperMode = false, onToggleDeveloper, isSystemVisible,
  points, onBuyPoints,
  useThirdPartyGateway, onToggleGateway,
  showTokenMonitor, onToggleTokenMonitor,
  onLogout
}) => {
  const isDeveloper = isDeveloperMode;
  const [activeTab, setActiveTab] = useState<'prefs' | 'account' | 'sub' | 'agreement' | 'about' | 'system'>('prefs');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authType, setAuthType] = useState<'email' | 'mobile'>('email');

  const [userType, setUserType] = useState<'individual' | 'enterprise'>('individual');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedTopup, setSelectedTopup] = useState<{amount: number, price: string} | null>(null);
  const [isCheckout, setIsCheckout] = useState(false);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [customTopup, setCustomTopup] = useState<string>('');
  const [showAuthInput, setShowAuthInput] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [isPassVisible, setIsPassVisible] = useState(false);

  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // AVATAR_KEY imported from constants.ts

  useEffect(() => {
    const loadAvatar = () => {
      try {
        const savedAvatar = localStorage.getItem(AVATAR_KEY);
        if (savedAvatar) {
          setUserAvatar(savedAvatar);
        }
      } catch (e) {
        console.error('Failed to load avatar:', e);
      }
    };
    
    loadAvatar();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY && e.newValue) {
        setUserAvatar(e.newValue);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setUserAvatar(result);
        localStorage.setItem(AVATAR_KEY, result);
        window.dispatchEvent(new CustomEvent('avatarChanged', { detail: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getLoggedInUser = () => {
    try {
      const session = localStorage.getItem('architect-invite-session');
      if (session) {
        return JSON.parse(session);
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const loggedInUser = useMemo(() => getLoggedInUser(), []);
  const isLoggedIn = !!loggedInUser;

  // 获取当前语言的翻译
  const t = getTranslation(preferences.language || 'zh-CN');

  if (!isOpen) return null;

  const handleLogout = () => {
    localStorage.removeItem('architect-invite-session');
    localStorage.removeItem('architect-user-tier-v150');
    localStorage.removeItem('architect-user-points-v160');
    localStorage.removeItem('architect-beta-application-submitted');
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      'beta': '内测用户',
      'pro': '专业版',
      'plus': '高级版',
      'dev': '开发者',
      'free': '免费版'
    };
    return labels[tier] || '免费版';
  };

  const getTierBenefits = (tier: string) => {
    const benefits: Record<string, string[]> = {
      'beta': ['注册赠送1000积分体验金', '每日可用200积分', '图像生成、图像分析、对话等功能全开放', '视频生成可体验（不支持下载）', '优先体验新功能'],
      'pro': ['每日 300K 积分额度', '每月 9M 积分额度', '视频无水印下载（5次/日）', '优先体验新功能'],
      'plus': ['每日 1M 积分额度', '每月 30M 积分额度', '视频无水印下载（无限）', '专属客服支持'],
      'dev': ['无限积分额度', '开发者API访问', '优先技术支持', '内测功能抢先体验']
    };
    return benefits[tier] || ['每日 10K 积分额度', '每月 300K 积分额度', '基础图像生成'];
  };

  const getTierLimits = (tier: string) => {
    const limits: Record<string, { daily: number; monthly: number }> = {
      'free': { daily: 10000, monthly: 300000 },
      'beta': { daily: 50000, monthly: 1500000 },
      'basic': { daily: 100000, monthly: 3000000 },
      'pro': { daily: 300000, monthly: 9000000 },
      'plus': { daily: 1000000, monthly: 30000000 },
      'dev': { daily: 999999999, monthly: 999999999 }
    };
    return limits[tier] || limits['free'];
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
  };

  const renderAccount = () => {
    if (isLoggedIn && loggedInUser) {
      const tierLimits = getTierLimits(loggedInUser.tier || userTier);
      
      return (
        <div className="max-w-md mx-auto space-y-6 py-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-4 mb-6">
            <div 
              onClick={() => avatarInputRef.current?.click()}
              className="inline-flex items-center justify-center w-24 h-24 bg-white/[0.06] rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-all relative group border border-white/10"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="用户头像" className="w-full h-full object-cover" />
              ) : (
                <img src="/architect/archi01.png" alt="默认头像" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-[10px] font-medium uppercase tracking-wider">更换头像</span>
              </div>
            </div>
            <input 
              type="file" 
              ref={avatarInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />
            <div>
              <h3 className="text-lg font-semibold text-white/90">{loggedInUser.nickname || loggedInUser.email?.split('@')[0] || '内测用户'}</h3>
              <p className="text-xs text-white/30 font-mono">{loggedInUser.email}</p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
              <span className="text-[10px] font-medium text-blue-400 uppercase tracking-widest">
                {getTierLabel(loggedInUser.tier || userTier)}
              </span>
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            </div>
          </div>

          {(loggedInUser.tier || userTier) === 'beta' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider mb-2">总积分</p>
                <p className="text-xl font-semibold text-blue-400">{(points.purchased + points.daily).toLocaleString()}</p>
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
                  <p className="text-[8px] text-white/20">注册赠送</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider mb-2">总余额</p>
                <p className="text-xl font-semibold text-green-400">{points.purchased.toLocaleString()}</p>
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
                  <p className="text-[8px] text-white/20">可用总额</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider mb-2">日积分</p>
                <p className="text-xl font-semibold text-amber-400">200</p>
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
                  <p className="text-[8px] text-white/20">每日可用</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider mb-2">日余额</p>
                <p className="text-xl font-semibold text-amber-400">{points.daily.toLocaleString()}</p>
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
                  <p className="text-[8px] text-white/20">今日可用</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider mb-2">积分余额</p>
                <p className="text-xl font-semibold text-blue-400">{(points.purchased + points.daily).toLocaleString()}</p>
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
                  <p className="text-[8px] text-white/20">购买: {points.purchased.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider mb-2">日积分</p>
                <p className="text-xl font-semibold text-amber-400">{points.daily.toLocaleString()}</p>
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
                  <p className="text-[8px] text-white/20">每日: {formatNumber(tierLimits.daily)}</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider mb-2">月限额</p>
                <p className="text-xl font-semibold text-white/70">{formatNumber(tierLimits.monthly)}</p>
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
                  <p className="text-[8px] text-white/20">每月重置</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">内测专属权益</h4>
            {getTierBenefits(loggedInUser.tier || userTier).map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-sm text-white/60">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-white/[0.06]">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-white/[0.04] border border-white/[0.06] text-white/40 rounded-xl font-medium text-sm hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all active:scale-[0.99]"
            >
              退出登录
            </button>
          </div>

          <p className="text-center text-[10px] text-white/20">
            本应用仅限邀请注册、内部试用，不向公众提供服务
          </p>
        </div>
      );
    }

    return (
    <div className="max-w-md mx-auto space-y-6 py-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2 mb-6">
        <h3 className="text-xl font-semibold text-white/90">{isLoginView ? '欢迎回归架构师' : '创建您的数字工坊'}</h3>
        <p className="text-xs text-white/60 uppercase tracking-widest">{isLoginView ? 'Member Login' : 'Join the Collective'}</p>
      </div>

      <div className="flex bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
        <button
          onClick={() => setAuthType('email')}
          className={`flex-1 py-2 text-[11px] font-medium rounded-lg transition-all ${authType === 'email' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-white/50 hover:text-white/80'}`}
        >
          邮箱验证
        </button>
        <button
          onClick={() => setAuthType('mobile')}
          className={`flex-1 py-2 text-[11px] font-medium rounded-lg transition-all ${authType === 'mobile' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-white/50 hover:text-white/80'}`}
        >
          手机快捷
        </button>
      </div>

      <div className="space-y-4">
        {authType === 'email' ? (
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-white/60 uppercase tracking-widest ml-1">Email Address</label>
              <input type="email" placeholder="name@kbit-ai.com" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-white/40 text-sm outline-none focus:border-white/30 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-white/60 uppercase tracking-widest ml-1">Security Key</label>
              <input type="password" placeholder="••••••••" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-white/40 text-sm outline-none focus:border-white/30 transition-all" />
            </div>
            {!isLoginView && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-white/60 uppercase tracking-widest ml-1">邀请码 <span className="text-red-400">*</span></label>
                <input type="text" placeholder="KBXXXXXXXX" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-white/40 text-sm outline-none focus:border-white/30 transition-all font-mono uppercase tracking-wider" />
                <p className="text-[9px] text-white/50 ml-1">内测期间需邀请码注册，可获得 1000 积分体验金</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-white/60 uppercase tracking-widest ml-1">Mobile Number</label>
              <input type="tel" placeholder="+86 1XX XXXX XXXX" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-white/40 text-sm outline-none focus:border-white/30 transition-all font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-white/60 uppercase tracking-widest ml-1">Verification Code</label>
              <div className="flex gap-2">
                <input type="text" placeholder="6-digit code" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-white/40 text-sm outline-none focus:border-white/30 transition-all font-mono text-center tracking-[0.5em]" />
                <button className="px-4 bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-white/60 rounded-xl hover:bg-white/8 hover:text-white/80 transition-all whitespace-nowrap">获取验证码</button>
              </div>
            </div>
          </>
        )}

        {!isLoginView && (
          <div className="flex items-center gap-3 px-1">
            <input type="checkbox" id="agree" className="w-4 h-4 rounded accent-blue-500" />
            <label htmlFor="agree" className="text-[11px] text-white/60">我已阅读并同意《隐私政策》与《用户服务协议》</label>
          </div>
        )}
      </div>

      <button className="w-full py-3 bg-blue-500/80 text-white rounded-xl font-medium text-sm hover:bg-blue-500 transition-all active:scale-[0.99]">
        {isLoginView ? '立即登录工坊' : '开启架构权限'}
      </button>

      <div className="pt-6 border-t border-white/[0.06] space-y-4">
        <div className="flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[9px] font-medium text-white/50 uppercase tracking-[0.3em]">第三方快捷登录</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <div className="flex justify-center gap-6">
          <button className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/30 hover:text-green-400 hover:border-green-500/30 hover:bg-green-500/10 transition-all active:scale-90" title="微信登录">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.383 14.502c-.22 0-.442-.018-.66-.056-1.14-.19-2.046-.893-2.618-1.74-.555-.83-.827-1.802-.827-2.887 0-1.285.45-2.422 1.34-3.37.89-.95 2.112-1.47 3.633-1.47 1.522 0 2.744.52 3.634 1.47.89.948 1.34 2.085 1.34 3.37 0 1.284-.45 2.42-1.34 3.37-.89.947-2.112 1.467-3.634 1.467h-.868zm6.545-2.583c-.22.01-.44-.003-.655-.04-1.127-.19-2.023-.883-2.588-1.72-.547-.82-.816-1.782-.816-2.854 0-1.27.444-2.395 1.326-3.332.88-.937 2.087-1.453 3.593-1.453 1.503 0 2.712.516 3.593 1.453.88.937 1.326 2.062 1.326 3.332 0 1.272-.445 2.397-1.326 3.333-.88.936-2.09 1.454-3.593 1.454h-.86zm-1.896 1.103a8.95 8.95 0 011.896-.202c1.787 0 3.25.594 4.385 1.765 1.135 1.17 1.71 2.593 1.71 4.234 0 1.64-.575 3.064-1.71 4.234-1.135 1.17-2.6 1.765-4.385 1.765a8.773 8.773 0 01-1.896-.205l-2.637 1.343.64-2.59c-1.637-.812-2.842-2.03-3.614-3.655-.772-1.624-1.157-3.256-1.157-4.896 0-1.64.385-3.27 1.157-4.895.428-.895 1.028-1.7 1.802-2.41z" /></svg>
          </button>
          <button className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/30 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10 transition-all active:scale-90" title="支付宝登录">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.001 2.002c-5.522 0-9.999 4.477-9.999 9.999 0 5.522 4.477 10 9.999 10s10-4.478 10-10c0-5.522-4.478-9.999-10-9.999zm4.615 14.536c-.16.035-.325.045-.485.045h-8.258c-.16 0-.325-.01-.485-.045a1.2 1.2 0 01-.84-.738c-.125-.33-.035-.7.225-.94l.435-.4a.5.5 0 00-.01-.715 1.2 1.2 0 01-.225-.94c.125-.33.45-.55.8-.55h8.258c.35 0 .675.22.8.55.125.33.05.695-.225.94a.5.5 0 00-.01.715l.435.4c.26.24.35.61.225.94a1.2 1.2 0 01-.84.738zm1.385-4.536h-12c-.552 0-1-.448-1-1s.448-1 1-1h12c.552 0 1 .448 1 1s-.448 1-1 1zm0-3h-12c-.552 0-1-.448-1-1s.448-1 1-1h12c.552 0 1 .448 1 1s-.448 1-1 1z" /></svg>
          </button>
        </div>
      </div>

      <div className="text-center">
        <button onClick={() => setIsLoginView(!isLoginView)} className="text-[11px] font-medium text-white/50 hover:text-white/80 transition-all">
          {isLoginView ? '没有账号？立即加入' : '已有账号？返回登录'}
        </button>
      </div>
    </div>
  );
  };

  const renderCheckout = () => {
    const isTopup = !!selectedTopup;
    const itemName = isTopup ? `积分加油包 (+${selectedTopup.amount} Points)` : selectedPlan?.name;
    const itemPrice = isTopup ? selectedTopup.price : selectedPlan?.prices[billingCycle];

    const handleConfirmPayment = () => {
      if (isTopup) {
        onBuyPoints(selectedTopup.amount);
        window.alert(`支付成功：已充值 ${selectedTopup.amount} 永久积分`);
      } else {
        // 模拟订阅逻辑 - 实际应用中应调用后端
        const passMap: any = { basic: 'KBIT-BASIC-2025', pro: 'KBIT-PRO-2025', plus: 'KBIT-PLUS-2025' };
        if (selectedPlan.id !== 'free') {
          onToggleDeveloper(passMap[selectedPlan.id]);
        }
        window.alert(`支付成功：您已成功订阅 ${selectedPlan.name}`);
      }
      setIsCheckout(false);
      setSelectedPlan(null);
      setSelectedTopup(null);
    };

    return (
      <div className="max-w-4xl mx-auto space-y-10 py-4 animate-in zoom-in-95 duration-500">
        <div className="flex items-center gap-4 border-b border-white/[0.06] pb-6">
          <button onClick={() => { setIsCheckout(false); setSelectedPlan(null); setSelectedTopup(null); }} className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h3 className="text-lg font-semibold text-white/90">资产结算中心</h3>
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.2em]">Checkout & Asset Verification</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="bg-white/[0.03] border border-white/[0.06] p-6 rounded-xl space-y-4">
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-widest">订单明细 / Order Details</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/40">用户身份:</span>
                  <span className="text-[10px] font-medium text-blue-400 border border-blue-500/30 bg-blue-500/10 px-3 py-1 rounded-lg uppercase">
                    {userType === 'individual' ? '个人用户 / Individual' : '企业用户 / Enterprise'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/40">项目名称:</span>
                  <span className="text-sm font-medium text-white/80">{itemName}</span>
                </div>
                {!isTopup && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/40">计费周期:</span>
                    <span className="text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg uppercase">
                      {billingCycle === 'monthly' ? '月付' : billingCycle === 'quarterly' ? '季付' : '年付'}
                    </span>
                  </div>
                )}
                <div className="pt-3 border-t border-white/[0.06] flex justify-between items-end">
                  <span className="text-sm text-white/40">应付总额:</span>
                  <span className="text-2xl font-semibold text-blue-400">{itemPrice}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center space-y-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
            <div className="w-48 h-48 bg-white/[0.04] p-3 rounded-2xl border border-white/[0.08]">
               <div className="w-full h-full bg-white/[0.06] rounded-xl flex items-center justify-center overflow-hidden">
                 <svg className="w-full h-full text-white/10" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 3h2v2h-2v-2zm3-3h3v2h-3v-2zm-3 3h2v2h-2v-2zm3 0h3v2h-3v-2z" />
                 </svg>
               </div>
            </div>
            <div className="text-center space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">使用 微信/支付宝 扫描支付</p>
              <button
                onClick={handleConfirmPayment}
                className="w-full px-8 py-3 bg-blue-500/80 text-white rounded-xl font-medium text-sm hover:bg-blue-500 transition-all active:scale-[0.99]"
              >
                确认支付并完成
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSubscription = () => {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold text-white/80">功能灰度测试中</h3>
          <p className="text-sm text-white/40 max-w-md">
            订阅计费功能即将上线。敬请期待！
          </p>
          <div className="pt-3">
            <span className="px-5 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs font-medium text-white/30 uppercase tracking-widest">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    );

    // 以下原有代码保留（灰度测试结束后可删除上方 return 语句恢复）
    if (isCheckout) return renderCheckout();

    const tierInfo = {
      free: { name: '免费用户', color: 'text-slate-500', icon: '🌱' },
      basic: { name: '基础级', color: 'text-sky-600', icon: '⭐' },
      pro: { name: 'PRO 级', color: 'text-theme', icon: '💎' },
      plus: { name: 'PLUS 级', color: 'text-emerald-600', icon: '👑' }
    };

    const currentTier = tierInfo[userTier];

    const individualPlans = [
      { id: 'free', name: '免费用户 (Free)', prices: { monthly: '¥0', quarterly: '¥0', yearly: '¥0' }, features: ['100 赠送积分/日', '视频生成：禁止', '仅限带水印下载', '历史保留 1 天'], badge: 'Trial' },
      { id: 'basic', name: '基础级 (Basic)', prices: { monthly: '¥39', quarterly: '¥99', yearly: '¥399' }, features: ['350 赠送积分/日', '视频：5 次/日 (快速)', '图像 10 次/日无水印', '保留 7 天'], badge: 'Stable' },
      { id: 'pro', name: 'PRO 级 (PRO)', prices: { monthly: '¥89', quarterly: '¥229', yearly: '¥899' }, features: ['800 赠送积分/日', '视频：16 次/日 (全引擎)', '图像无限/视频 5 次无水印', '保留 30 天'], badge: 'Pro' },
      { id: 'plus', name: 'PLUS 级 (PLUS)', prices: { monthly: '¥199', quarterly: '¥499', yearly: '¥1999' }, features: ['1800 赠送积分/日', '视频：50 次/日 (全引擎)', '全功能无限无水印', '永久云端存储'], badge: 'Elite' }
    ];

    const topupOptions = [
      { amount: 100, price: '¥1' },
      { amount: 200, price: '¥2' },
      { amount: 500, price: '¥5' },
      { amount: 1000, price: '¥10' },
      { amount: 2000, price: '¥20' },
      { amount: 5000, price: '¥50' },
    ];

    const handleTopupClick = (amount: number, price: string) => {
      setSelectedTopup({ amount, price });
      setSelectedPlan(null);
      setIsCheckout(true);
    };

    return (
      <div className="space-y-12 animate-in fade-in duration-500">
        {/* Current Status Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 dark:bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center gap-6 md:col-span-1">
            <div className="w-16 h-16 rounded-3xl bg-white dark:bg-slate-900 shadow-xl flex items-center justify-center text-3xl">
              {currentTier.icon}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">当前账户等级</p>
              <h4 className={`text-xl font-black italic ${currentTier.color}`}>{currentTier.name}</h4>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex flex-col justify-center md:col-span-2">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">可用积分余额 / Points Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-theme">{points.daily + points.purchased}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Points</span>
                </div>
              </div>
              <div className="flex gap-4 text-right">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase">每日赠送</p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{points.daily}</p>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase">永久点数</p>
                  <p className="text-xs font-bold text-theme">{points.purchased}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">订阅方案选择 / Subscription Plans</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {individualPlans.map(plan => (
              <div 
                key={plan.id}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={`p-8 rounded-[2.5rem] border-2 flex flex-col transition-all hover:shadow-xl ${
                  userTier === plan.id 
                    ? 'bg-theme text-white border-theme-light shadow-2xl scale-105 z-10'
                    : hoveredPlan === plan.id || (hoveredPlan === null && plan.id === 'basic')
                      ? 'bg-theme text-white border-theme shadow-2xl scale-105 z-10'
                      : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-white/5'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-white text-theme">{plan.badge}</span>
                </div>
                <h4 className="text-lg font-black italic mb-2">{plan.name}</h4>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-3xl font-black">{plan.prices[billingCycle]}</span>
                  <span className="text-xs opacity-60 uppercase">/ {billingCycle === 'monthly' ? '月' : billingCycle === 'quarterly' ? '季' : '年'}</span>
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-3 text-[11px] font-medium leading-tight">
                      <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => { setSelectedPlan(plan); setIsCheckout(true); }}
                  className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 bg-white text-theme hover:bg-slate-50"
                >
                  立即订阅
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">积分加油包 / Top-up Points</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topupOptions.map(opt => (
              <button 
                key={opt.amount}
                onClick={() => handleTopupClick(opt.amount, opt.price)}
                className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex items-center justify-between hover:border-theme hover:shadow-xl transition-all group"
              >
                <div className="text-left">
                  <h5 className="text-xl font-black text-slate-900 dark:text-white italic">+{opt.amount} <span className="text-xs font-bold text-slate-400 uppercase not-italic">Points</span></h5>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">永久有效 / Never Expires</p>
                </div>
                <div className="px-6 py-2 bg-slate-100 dark:bg-slate-800 group-hover:bg-theme group-hover:text-white rounded-xl text-sm font-black transition-all">
                  {opt.price}
                </div>
              </button>
            ))}
            
            {/* Custom Top-up */}
            <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex items-center justify-between hover:border-theme transition-all">
              <div className="text-left flex-1 mr-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">自定义金额 / Custom Amount</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-900 dark:text-white">¥</span>
                  <input 
                    type="number" 
                    value={customTopup}
                    onChange={(e) => setCustomTopup(e.target.value)}
                    placeholder="输入金额"
                    className="w-full bg-transparent text-xl font-black outline-none border-b border-slate-200 dark:border-slate-800 focus:border-theme transition-colors"
                  />
                </div>
                {customTopup && (
                  <p className="text-[10px] font-bold text-theme-light uppercase mt-2">预计获得: {parseInt(customTopup) * 100 || 0} Points</p>
                )}
              </div>
              <button 
                disabled={!customTopup || parseInt(customTopup) <= 0}
                onClick={() => { 
                  const price = `¥${customTopup}`;
                  const amount = parseInt(customTopup) * 100;
                  handleTopupClick(amount, price);
                  setCustomTopup('');
                }}
                className="px-6 py-4 bg-theme text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-theme-light transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-theme"
              >
                充值
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAbout = () => (
    <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="w-24 h-24 rounded-full shrink-0 overflow-hidden border border-white/[0.08]">
          <img src="/architect/archi01.png" alt="KBITAI" className="w-full h-full object-cover" />
        </div>
        <div className="space-y-5 flex-1">
          <h3 className="text-xl font-semibold text-white/90">关于我们 <span className="text-white/30 font-normal text-base">About Us</span></h3>
          <div className="space-y-4 text-sm text-white/50 leading-relaxed">
            <p>由 <span className="text-white/80 font-medium">匡形无界智能科技开发团队（KBITAI）</span> 研发。</p>
            <p>作为新一代专业级 AI 图像架构中枢，我们通过底层逻辑内核，为建筑空间、工业设计、视觉艺术及角色概念提供高保真全域渲染与动态演化支持。</p>
            <p className="text-blue-400/80 border-l-2 border-blue-500/30 pl-4">核心价值观：设计有形，科技无界。</p>
          </div>
          <div className="pt-4 border-t border-white/[0.06]">
            <p className="text-sm text-white/40">官方联系邮箱：<span className="text-white/70 font-mono">kbit_ai@126.com</span></p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-6xl h-full max-h-[90vh] bg-[#0e0e0e] rounded-2xl shadow-2xl border border-white/[0.08] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" strokeWidth={2} />
                </svg>
             </div>
             <h2 className="text-xl font-semibold text-white/90 tracking-tight">{t.settings.title} <span className="text-white/30 font-normal text-base">{t.settings.subtitle}</span></h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60 transition-all">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="w-56 border-r border-white/[0.06] p-4 flex flex-col gap-1 shrink-0">
            {[
              { id: 'prefs',     label: t.settings.tabs.preferences, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" /></svg> },
              { id: 'account',   label: t.settings.tabs.account, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
              { id: 'sub',       label: t.settings.tabs.subscription, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg> },
              { id: 'agreement', label: t.settings.tabs.agreement, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> },
              { id: 'about',     label: t.settings.tabs.about, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg> },
              { id: 'system',    label: t.settings.tabs.system, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>, hidden: !isSystemVisible }
            ].filter(tabItem => !tabItem.hidden).map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setIsCheckout(false); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeTab === tab.id ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30' : 'text-white/40 hover:bg-white/5 hover:text-white/70'}`}>
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === 'prefs' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-base font-semibold text-white/80 mb-1">{t.settings.preferences.title}</h3>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">{t.settings.preferences.subtitle}</p>
                </div>

                {/* 主题效果演示区 */}
                <div className="p-6 rounded-xl border-2 border-white/10 bg-white/[0.02] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white/90">{t.settings.preferences.themePreview}</h4>
                      <p className="text-[10px] text-white/40 mt-1">{t.settings.preferences.themePreviewDesc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-theme shadow-lg shadow-theme"></div>
                      <div className="w-12 h-12 rounded-lg bg-theme-light shadow-lg shadow-theme"></div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-theme text-white rounded-lg hover:bg-theme-light transition-all">
                      {t.buttons.themeButton}
                    </button>
                    <button className="px-4 py-2 border-2 border-theme text-theme rounded-lg hover:bg-theme hover:text-white transition-all">
                      {t.buttons.borderButton}
                    </button>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-2/3 bg-theme shadow-lg shadow-theme"></div>
                  </div>
                </div>

                {/* 主题风格 */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">{t.settings.preferences.theme}</label>
                    <p className="text-[9px] text-white/20 mt-1">{t.settings.preferences.themeDesc}</p>
                  </div>
                  <div className="grid grid-cols-6 gap-3">
                    {[
                      { id: 'dark', name: t.settings.themes.dark, color: '#6366F1', lightColor: '#818CF8', icon: '✦' },
                      { id: 'indigo', name: t.settings.themes.indigo, color: '#8B5CF6', lightColor: '#A78BFA', icon: '💜' },
                      { id: 'ocean', name: t.settings.themes.ocean, color: '#06B6D4', lightColor: '#22D3EE', icon: '🌊' },
                      { id: 'forest', name: t.settings.themes.forest, color: '#10B981', lightColor: '#34D399', icon: '🌲' },
                      { id: 'sunset', name: t.settings.themes.sunset, color: '#F59E0B', lightColor: '#FBBF24', icon: '🌅' },
                      { id: 'minimal', name: t.settings.themes.minimal, color: '#6B7280', lightColor: '#9CA3AF', icon: '⚪' }
                    ].map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => onPreferencesChange({...preferences, theme: theme.id as AppTheme, lightMode: false})}
                        className={`relative p-3 rounded-xl border-2 transition-all duration-300 hover:scale-110 hover:shadow-xl group ${
                          preferences.theme === theme.id
                            ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/30 scale-105'
                            : 'border-white/[0.08] bg-white/[0.03] hover:border-white/30'
                        }`}
                        style={preferences.theme === theme.id ? {
                          borderColor: theme.color,
                          backgroundColor: `${theme.color}20`,
                          boxShadow: `0 0 20px ${theme.color}40`
                        } : {}}
                      >
                        <div className="relative">
                          <div
                            className="w-10 h-10 rounded-lg mx-auto mb-2 shadow-lg transition-transform group-hover:scale-110"
                            style={{
                              background: `linear-gradient(135deg, ${theme.color}, ${theme.lightColor})`,
                              boxShadow: `0 4px 12px ${theme.color}60`
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-xl opacity-0 group-hover:opacity-100 transition-opacity">
                            {theme.icon}
                          </div>
                        </div>
                        <p className="text-[9px] font-medium text-center text-white/60 group-hover:text-white/90 transition-colors">{theme.name}</p>
                        {preferences.theme === theme.id && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center animate-pulse"
                            style={{ backgroundColor: theme.color }}>
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 亮/暗模式切换 */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                  <div>
                    <p className="text-[10px] font-medium text-white/60">{preferences.lightMode ? '☀️ 亮色模式' : '🌙 暗色模式'}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">当前主题的背景亮度</p>
                  </div>
                  <button
                    onClick={() => onPreferencesChange({...preferences, lightMode: !preferences.lightMode})}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${preferences.lightMode ? 'bg-blue-500' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${preferences.lightMode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* 字号调整 */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">{t.settings.preferences.fontSize}</label>
                    <p className="text-[9px] text-white/20 mt-1">{t.settings.preferences.fontSizeDesc}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'small', name: t.settings.fontSizes.small, size: '12px', demo: '小号文字 Aa' },
                      { id: 'medium', name: t.settings.fontSizes.medium, size: '14px', demo: '标准文字 Aa' },
                      { id: 'large', name: t.settings.fontSizes.large, size: '16px', demo: '大号文字 Aa' }
                    ].map(size => (
                      <button
                        key={size.id}
                        onClick={() => onPreferencesChange({...preferences, fontSize: size.id as any})}
                        className={`p-4 border-2 rounded-xl transition-all duration-300 hover:scale-105 ${
                          preferences.fontSize === size.id
                            ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/30'
                            : 'border-white/[0.08] bg-white/[0.03] hover:border-white/30'
                        }`}
                      >
                        <p className="text-sm font-medium text-white/80 mb-2">{size.name}</p>
                        <p className="text-white/40 mb-1" style={{ fontSize: size.size }}>{size.demo}</p>
                        <p className="text-[9px] text-white/30">{size.size}</p>
                      </button>
                    ))}
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-xs text-amber-400">{t.settings.preferences.fontSizeTip}</p>
                  </div>
                </div>

                {/* 语言选择 */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">{t.settings.preferences.language}</label>
                    <p className="text-[9px] text-white/20 mt-1">{t.settings.preferences.languageDesc}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { id: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
                      { id: 'en-US', name: 'English', flag: '🇺🇸' },
                      { id: 'ja-JP', name: '日本語', flag: '🇯🇵' },
                      { id: 'ko-KR', name: '한국어', flag: '🇰🇷' },
                      { id: 'es-ES', name: 'Español', flag: '🇪🇸' },
                      { id: 'fr-FR', name: 'Français', flag: '🇫🇷' },
                      { id: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
                      { id: 'ru-RU', name: 'Русский', flag: '🇷🇺' }
                    ].map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => onPreferencesChange({...preferences, language: lang.id as Language})}
                        className={`p-3 border-2 rounded-xl transition-all duration-300 hover:scale-105 ${
                          preferences.language === lang.id
                            ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/30'
                            : 'border-white/[0.08] bg-white/[0.03] hover:border-white/30'
                        }`}
                      >
                        <div className="text-2xl mb-1">{lang.flag}</div>
                        <p className="text-[10px] font-medium text-white/70">{lang.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 重置按钮 */}
                <div className="pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => {
                      if (window.confirm(t.settings.preferences.resetConfirm)) {
                        onPreferencesChange({
                          promptFontSize: 16,
                          chatFontSize: 14,
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
                      }
                    }}
                    className="w-full py-3 bg-white/[0.04] border border-white/[0.06] text-white/40 rounded-xl font-medium text-sm hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all"
                  >
                    {t.settings.preferences.resetToDefault}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'account' && renderAccount()}
            {activeTab === 'sub' && renderSubscription()}
            {activeTab === 'about' && renderAbout()}
            {activeTab === 'agreement' && (
              <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                <div>
                  <h3 className="text-base font-semibold text-white/80 mb-3">用户服务协议</h3>
                  <pre className="text-sm text-white/40 whitespace-pre-wrap bg-white/[0.02] border border-white/[0.06] p-5 rounded-xl max-h-[60vh] overflow-y-auto custom-scrollbar">{TERMS_OF_SERVICE}</pre>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white/80 mb-3">隐私保护政策</h3>
                  <pre className="text-sm text-white/40 whitespace-pre-wrap bg-white/[0.02] border border-white/[0.06] p-5 rounded-xl max-h-[60vh] overflow-y-auto custom-scrollbar">{PRIVACY_POLICY}</pre>
                </div>
              </div>
            )}
            {activeTab === 'system' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: '内核版本', value: 'KBIT-CORE-V4.2.5-PRO' },
                    { label: '语义解析', value: 'Precision: 0.998' },
                    { label: '材质协议', value: 'PBR-Standard-v2.1' },
                    { label: '张量加速', value: 'ACTIVE / MULTI-THREAD' },
                    { label: '安全审计', value: 'REAL-TIME / COMPLIANT' },
                    { label: '缓存策略', value: 'LRU-OPTIMIZED' }
                  ].map(stat => (
                    <div key={stat.label} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1">
                      <p className="text-[9px] font-medium text-white/30 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-xs font-medium text-white/70">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-sm font-medium text-white/80">开发者模式</h4>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest">
                        {isDeveloperMode ? '已开启开发者权限（无限）' : '当前为普通模式'}
                      </p>
                    </div>
                    <button onClick={() => isDeveloperMode ? onToggleDeveloper() : setShowAuthInput(!showAuthInput)}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative active:scale-95 shrink-0 ${isDeveloperMode ? 'bg-blue-500' : 'bg-slate-300 dark:bg-white/25'}`}>
                      <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 pointer-events-none"
                        style={{ transform: isDeveloperMode ? 'translateX(24px)' : 'translateX(0)' }} />
                    </button>
                  </div>

                  {showAuthInput && !isDeveloperMode && (
                    <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">请输入授权口令</span>
                        <button onClick={() => setShowAuthInput(false)} className="text-white/30 hover:text-white/60 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type={isPassVisible ? "text" : "password"} value={inputPassword}
                            onChange={(e) => setInputPassword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const success = onToggleDeveloper(inputPassword);
                                if (success) { setInputPassword(''); setShowAuthInput(false); }
                              }
                            }}
                            placeholder="••••••••••••"
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-sm outline-none focus:border-white/20 text-white/70 pr-10"
                            autoFocus />
                          <button onClick={() => setIsPassVisible(!isPassVisible)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                            {isPassVisible ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L1 1m11 11l11 11" /></svg>
                            )}
                          </button>
                        </div>
                        <button
                          onClick={() => { 
                            const success = onToggleDeveloper(inputPassword); 
                            if (success) {
                              setInputPassword(''); 
                              setShowAuthInput(false); 
                            }
                          }}
                          className="px-4 py-2 bg-blue-500/80 text-white rounded-xl text-[10px] font-medium hover:bg-blue-500 transition-all"
                        >
                          确认
                        </button>
                      </div>
                    </div>
                  )}

                  {isDeveloperMode && (
                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl animate-in fade-in">
                      <div className="flex items-center gap-2 text-[11px] text-blue-400 font-medium">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
                        开发者模式已开启：无限权限。
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-white/[0.06] space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="text-sm font-medium text-white/80">第三方网关分流 {isDeveloperMode ? '' : '(需开发者权限)'}</h4>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest">
                          {useThirdPartyGateway ? '已开启商业矩阵 + 第三方网关' : '已开启开发模式 + 官方通道'}
                        </p>
                      </div>
                      <button onClick={() => isDeveloperMode && onToggleGateway(!useThirdPartyGateway)} disabled={!isDeveloperMode}
                        className={`w-12 h-6 rounded-full transition-all duration-300 relative active:scale-95 shrink-0 ${!isDeveloperMode ? 'opacity-30 cursor-not-allowed' : ''} ${useThirdPartyGateway ? 'bg-blue-500' : 'bg-slate-300 dark:bg-white/25'}`}>
                        <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 pointer-events-none"
                          style={{ transform: useThirdPartyGateway ? 'translateX(24px)' : 'translateX(0)' }} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="text-sm font-medium text-white/80">显示开发监控窗口</h4>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest">
                          {showTokenMonitor ? '已开启实时 Token 流量监控' : '已关闭开发监控窗口'}
                        </p>
                      </div>
                      <button onClick={() => onToggleTokenMonitor(!showTokenMonitor)}
                        className={`w-12 h-6 rounded-full transition-all duration-300 relative active:scale-95 shrink-0 ${showTokenMonitor ? 'bg-blue-500' : 'bg-slate-300 dark:bg-white/25'}`}>
                        <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 pointer-events-none"
                          style={{ transform: showTokenMonitor ? 'translateX(24px)' : 'translateX(0)' }} />
                      </button>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="text-sm font-black italic">用量统计与限流</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            从后端获取实时用量数据，                          </p>
                        </div>
                        <button 
                          onClick={async () => {
                            const testUserId = 'test_user_' + Date.now();
                            const stats = await Ph8UsageService.fetchUsageFromBackend(testUserId);
                            if (stats && stats.quota) {
                              const q = stats.quota;
                              window.alert(`✅ 后端连接成功！\n\n等级: ${q.tier}\n今日已用: ${Ph8UsageService.formatUsageDisplay(q.daily_tokens_used)}\n今日限额: ${Ph8UsageService.formatUsageDisplay(q.daily_token_limit)}\n本月已用: ${Ph8UsageService.formatUsageDisplay(q.monthly_tokens_used)}\n本月限额: ${Ph8UsageService.formatUsageDisplay(q.monthly_token_limit)}\n累计用量: ${Ph8UsageService.formatUsageDisplay(q.total_tokens_used)}`);
                            } else {
                              window.alert('❌ 后端连接失败\n\n请确保：\n1. 后端服务已启动\n2. 数据库已配置\n3. 网络连接正常');
                            }
                          }}
                          className="px-4 py-2 bg-blue-500/80 text-white rounded-xl text-[10px] font-medium hover:bg-blue-500 transition-all"
                        >
                          测试后端
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <SystemSpec 
                  versionHistory={versionHistory}
                  currentPresets={currentPresets}
                  onRollback={onRollback}
                  onUpdate={onUpdateInstructions}
                  models={models}
                  onModelsChange={onModelsChange}
                  activeModelId={activeModelId}
                  onActiveModelChange={onActiveModelChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SettingsPanel;
