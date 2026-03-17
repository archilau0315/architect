
import React, { useState } from 'react';
import { UserPreferences, CustomModel, VersionRecord, UserTier, AppTheme } from '../types.ts';
import SystemSpec from './SystemSpec.tsx';
import { TERMS_OF_SERVICE } from '../legal/termsOfService.ts';
import { PRIVACY_POLICY } from '../legal/privacyPolicy.ts';
import { Ph8UsageService } from '../services/ph8UsageService.ts';

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
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  isOpen, onClose, preferences, onPreferencesChange, models, onModelsChange, 
  activeModelId, onActiveModelChange,
  versionHistory, currentPresets, onRollback, onUpdateInstructions,
  userTier, isDeveloperMode = false, onToggleDeveloper, isSystemVisible,
  points, onBuyPoints,
  useThirdPartyGateway, onToggleGateway,
  showTokenMonitor, onToggleTokenMonitor
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

  if (!isOpen) return null;

  const renderAccount = () => (
    <div className="max-w-md mx-auto space-y-6 py-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2 mb-6">
        <h3 className="text-2xl font-black italic">{isLoginView ? '欢迎回归架构师' : '创建您的数字工坊'}</h3>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{isLoginView ? 'Member Login' : 'Join the Collective'}</p>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-950/60 p-1.5 rounded-2xl ring-1 ring-slate-200 dark:ring-white/5 shadow-inner">
        <button 
          onClick={() => setAuthType('email')} 
          className={`flex-1 py-2.5 text-[11px] font-black uppercase rounded-xl transition-all ${authType === 'email' ? 'bg-white dark:bg-slate-800 text-theme shadow-md' : 'text-slate-400 hover:text-slate-500'}`}
        >
          邮箱验证
        </button>
        <button 
          onClick={() => setAuthType('mobile')} 
          className={`flex-1 py-2.5 text-[11px] font-black uppercase rounded-xl transition-all ${authType === 'mobile' ? 'bg-white dark:bg-slate-800 text-theme shadow-md' : 'text-slate-400 hover:text-slate-500'}`}
        >
          手机快捷
        </button>
      </div>

      <div className="space-y-4">
        {authType === 'email' ? (
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email Address</label>
              <input type="email" placeholder="name@kbit-ai.com" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-theme/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Security Key</label>
              <input type="password" placeholder="••••••••" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-theme/20" />
            </div>
            {!isLoginView && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">邀请码 <span className="text-rose-500">*</span></label>
                <input type="text" placeholder="KBXXXXXXXX" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-theme/20 font-mono uppercase tracking-wider" />
                <p className="text-[9px] text-slate-400 ml-2">内测期间需邀请码注册，可获得 1000 积分体验金</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mobile Number</label>
              <input type="tel" placeholder="+86 1XX XXXX XXXX" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-theme/20 font-mono" />
            </div>
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Verification Code</label>
              <div className="flex gap-2">
                <input type="text" placeholder="6-digit code" className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-theme/20 font-mono text-center tracking-[0.5em]" />
                <button className="px-5 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-theme-light rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-theme hover:text-white transition-all">获取验证码</button>
              </div>
            </div>
          </>
        )}
        
        {!isLoginView && (
          <div className="flex items-center gap-3 px-2">
            <input type="checkbox" id="agree" className="w-4 h-4 rounded border-slate-300 text-theme focus:ring-theme" />
            <label htmlFor="agree" className="text-[11px] text-slate-500">我已阅读并同意《隐私政策》与《用户服务协议》</label>
          </div>
        )}
      </div>

      <button className="w-full py-5 bg-theme text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl hover:bg-theme-light transition-all active:scale-95">
        {isLoginView ? '立即登录工坊' : '开启架构权限'}
      </button>

      <div className="pt-8 border-t border-slate-100 dark:border-slate-800/60 space-y-4">
        <div className="flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">第三方快捷登录</span>
          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="flex justify-center gap-8">
          <button className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-90 group" title="微信登录">
             <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8.383 14.502c-.22 0-.442-.018-.66-.056-1.14-.19-2.046-.893-2.618-1.74-.555-.83-.827-1.802-.827-2.887 0-1.285.45-2.422 1.34-3.37.89-.95 2.112-1.47 3.633-1.47 1.522 0 2.744.52 3.634 1.47.89.948 1.34 2.085 1.34 3.37 0 1.284-.45 2.42-1.34 3.37-.89.947-2.112 1.467-3.634 1.467h-.868zm6.545-2.583c-.22.01-.44-.003-.655-.04-1.127-.19-2.023-.883-2.588-1.72-.547-.82-.816-1.782-.816-2.854 0-1.27.444-2.395 1.326-3.332.88-.937 2.087-1.453 3.593-1.453 1.503 0 2.712.516 3.593 1.453.88.937 1.326 2.062 1.326 3.332 0 1.272-.445 2.397-1.326 3.333-.88.936-2.09 1.454-3.593 1.454h-.86zm-1.896 1.103a8.95 8.95 0 011.896-.202c1.787 0 3.25.594 4.385 1.765 1.135 1.17 1.71 2.593 1.71 4.234 0 1.64-.575 3.064-1.71 4.234-1.135 1.17-2.6 1.765-4.385 1.765a8.773 8.773 0 01-1.896-.205l-2.637 1.343.64-2.59c-1.637-.812-2.842-2.03-3.614-3.655-.772-1.624-1.157-3.256-1.157-4.896 0-1.64.385-3.27 1.157-4.895.428-.895 1.028-1.7 1.802-2.41z" /></svg>
          </button>
          <button className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-sky-500 hover:bg-sky-500 hover:text-white transition-all shadow-sm active:scale-90 group" title="支付宝登录">
             <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.001 2.002c-5.522 0-9.999 4.477-9.999 9.999 0 5.522 4.477 10 9.999 10s10-4.478 10-10c0-5.522-4.478-9.999-10-9.999zm4.615 14.536c-.16.035-.325.045-.485.045h-8.258c-.16 0-.325-.01-.485-.045a1.2 1.2 0 01-.84-.738c-.125-.33-.035-.7.225-.94l.435-.4a.5.5 0 00-.01-.715 1.2 1.2 0 01-.225-.94c.125-.33.45-.55.8-.55h8.258c.35 0 .675.22.8.55.125.33.05.695-.225.94a.5.5 0 00-.01.715l.435.4c.26.24.35.61.225.94a1.2 1.2 0 01-.84.738zm1.385-4.536h-12c-.552 0-1-.448-1-1s.448-1 1-1h12c.552 0 1 .448 1 1s-.448 1-1 1zm0-3h-12c-.552 0-1-.448-1-1s.448-1 1-1h12c.552 0 1 .448 1 1s-.448 1-1 1z" /></svg>
          </button>
        </div>
      </div>

      <div className="text-center">
        <button onClick={() => setIsLoginView(!isLoginView)} className="text-[11px] font-black text-theme-light uppercase tracking-tighter hover:underline">
          {isLoginView ? '没有账号？立即加入' : '已有账号？返回登录'}
        </button>
      </div>
    </div>
  );

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
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-8">
          <button onClick={() => { setIsCheckout(false); setSelectedPlan(null); setSelectedTopup(null); }} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-theme transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h3 className="text-2xl font-black italic">资产结算中心</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Checkout & Asset Verification</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="bg-slate-50 dark:bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 space-y-6">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">订单明细 / Order Details</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500">用户身份:</span>
                  <span className="text-[10px] font-black text-theme border border-theme/20 px-3 py-1 rounded-full uppercase italic">
                    {userType === 'individual' ? '个人用户 / Individual' : '企业用户 / Enterprise'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500">项目名称:</span>
                  <span className="text-sm font-black italic">{itemName}</span>
                </div>
                {!isTopup && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">计费周期:</span>
                    <span className="text-[10px] font-black bg-theme text-white px-3 py-1 rounded-full uppercase">
                      {billingCycle === 'monthly' ? '月付' : billingCycle === 'quarterly' ? '季付' : '年付'}
                    </span>
                  </div>
                )}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-500">应付总额:</span>
                  <span className="text-3xl font-black text-theme">{itemPrice}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center space-y-8 bg-white dark:bg-slate-950/20 rounded-[3.5rem] p-10 border border-theme/10 shadow-2xl">
            <div className="w-56 h-56 bg-white p-4 rounded-3xl shadow-inner relative group">
               <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                 <svg className="w-full h-full text-slate-900 opacity-80" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 3h2v2h-2v-2zm3-3h3v2h-3v-2zm-3 3h2v2h-2v-2zm3 0h3v2h-3v-2z" />
                 </svg>
               </div>
            </div>
            <div className="text-center space-y-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">使用 微信/支付宝 扫描支付</p>
              <button 
                onClick={handleConfirmPayment}
                className="w-full px-12 py-4 bg-theme text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl hover:bg-theme-light transition-all active:scale-95"
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
      <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in duration-500">
        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-center space-y-4">
          <h3 className="text-2xl font-black italic text-slate-700 dark:text-slate-200">功能灰度测试中</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
            ICP备案办理中，订阅计费功能即将上线。敬请期待！
          </p>
          <div className="pt-4">
            <span className="px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-black text-slate-400 uppercase tracking-widest">
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
    <div className="space-y-12 animate-in slide-in-from-left-4 duration-500">
      <div className="flex flex-col md:flex-row gap-12 items-center">
        <div className="w-40 h-40 rounded-[3rem] shrink-0 flex items-center justify-center shadow-2xl overflow-hidden bg-white dark:bg-slate-800">
          <img src="./archi01.png" alt="KBITAI Logo" className="w-full h-full object-cover" />
        </div>
        <div className="space-y-6 flex-1">
          <h3 className="text-3xl font-black italic">关于我们 / About Us</h3>
          <div className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium space-y-6">
            <div className="space-y-4 text-sm">
              <p>由 <span className="weighted-block">匡形无界智能科技开发团队（KBITAI）</span> 研发。</p>
              <p>作为新一代专业级 AI 图像架构中枢，我们通过底层逻辑内核，为建筑空间、工业设计、视觉艺术及角色概念提供高保真全域渲染与动态演化支持。</p>
              <p className="italic text-theme dark:text-theme-light font-bold border-l-2 border-theme pl-4">核心价值观：设计有形，科技无界。</p>
            </div>
            
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60 space-y-4">
              <p className="text-sm">官方联系邮箱：<span className="weighted-block">kbit_ai@126.com</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative w-full max-w-6xl h-full max-h-[90vh] bg-white dark:bg-slate-900 rounded-[3rem] shadow-3xl border border-slate-200 dark:border-white/5 flex flex-col overflow-hidden glass-card">
        <div className="px-10 py-8 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-theme flex items-center justify-center text-white shadow-xl shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" strokeWidth={2} />
                </svg>
             </div>
             <h2 className="text-2xl font-black text-slate-900 dark:text-white italic tracking-tight">管控中心 <span className="text-theme font-normal">Command Center</span></h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-all border border-transparent">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-slate-200 dark:border-slate-800/60 p-8 flex flex-col gap-2 shrink-0">
            {[
              { id: 'prefs', label: '界面偏好', icon: '🎨' },
              { id: 'account', label: '账户体系', icon: '👤' },
              { id: 'sub', label: '订阅计费', icon: '💎' },
              { id: 'agreement', label: '用户协议', icon: '📋' },
              { id: 'about', label: '关于我们', icon: 'ℹ️' },
              { id: 'system', label: '核心指令', icon: '📜', hidden: !isSystemVisible }
            ].filter(t => !t.hidden).map(tab => (
              <button 
                key={tab.id} 
                onClick={() => { setActiveTab(tab.id as any); setIsCheckout(false); }} 
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[13px] font-black transition-all ${activeTab === tab.id ? 'bg-theme text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
            {activeTab === 'prefs' && (
              <div className="space-y-10">
                <h3 className="text-xl font-black italic">视觉界面首选项</h3>
                <div className="grid gap-8">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">主题风格 / Theme</label>
                      <div className="grid grid-cols-5 gap-4">
                        {[
                          { id: 'indigo', name: '紫蓝科技', color: '#4F46E5', lightColor: '#818CF8' },
                          { id: 'ocean', name: '深海冷静', color: '#0369A1', lightColor: '#38BDF8' },
                          { id: 'forest', name: '森林自然', color: '#059669', lightColor: '#34D399' },
                          { id: 'sunset', name: '日落温暖', color: '#EA580C', lightColor: '#FB923C' },
                          { id: 'minimal', name: '极简高效', color: '#525252', lightColor: '#A3A3A3' }
                        ].map(theme => (
                          <button
                            key={theme.id}
                            onClick={() => onPreferencesChange({...preferences, theme: theme.id as AppTheme})}
                            className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                              preferences.theme === theme.id 
                                ? 'border-slate-900 dark:border-white shadow-xl' 
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div 
                              className="w-10 h-10 rounded-xl mx-auto mb-3 shadow-lg"
                              style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.lightColor})` }}
                            />
                            <p className="text-[10px] font-black text-center text-slate-600 dark:text-slate-300">{theme.name}</p>
                            {preferences.theme === theme.id && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-slate-900 dark:bg-white rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white dark:text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">指令编辑器字号: {preferences.promptFontSize}px</label>
                      <input type="range" min="12" max="32" value={preferences.promptFontSize} onChange={(e) => onPreferencesChange({...preferences, promptFontSize: parseInt(e.target.value)})} className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none accent-theme" />
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'account' && renderAccount()}
            {activeTab === 'sub' && renderSubscription()}
            {activeTab === 'about' && renderAbout()}
            {activeTab === 'agreement' && (
              <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                <div>
                  <h3 className="text-xl font-black italic mb-4">用户服务协议</h3>
                  <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-slate-50 dark:bg-slate-950/40 p-6 rounded-2xl border border-slate-200 dark:border-white/5 max-h-[60vh] overflow-y-auto custom-scrollbar">{TERMS_OF_SERVICE}</pre>
                </div>
                <div>
                  <h3 className="text-xl font-black italic mb-4">隐私保护政策</h3>
                  <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-slate-50 dark:bg-slate-950/40 p-6 rounded-2xl border border-slate-200 dark:border-white/5 max-h-[60vh] overflow-y-auto custom-scrollbar">{PRIVACY_POLICY}</pre>
                </div>
              </div>
            )}
            {activeTab === 'system' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: '内核版本', value: 'KBIT-CORE-V4.2.5-PRO', icon: '💎' },
                    { label: '语义解析', value: 'Precision: 0.998', icon: '🧠' },
                    { label: '材质协议', value: 'PBR-Standard-v2.1', icon: '🧱' },
                    { label: '张量加速', value: 'ACTIVE / MULTI-THREAD', icon: '🚀' },
                    { label: '安全审计', value: 'REAL-TIME / COMPLIANT', icon: '🛡️' },
                    { label: '缓存策略', value: 'LRU-OPTIMIZED', icon: '💾' }
                  ].map(stat => (
                    <div key={stat.label} className="p-6 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 rounded-3xl space-y-2">
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span>{stat.icon}</span>
                        <span>{stat.label}</span>
                      </div>
                      <p className="text-xs font-black italic text-slate-900 dark:text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800/60 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black italic">开发者模式</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {isDeveloperMode ? '已开启开发者权限（无限）' : '当前为普通模式'}
                      </p>
                    </div>
                    <button 
                      onClick={() => isDeveloperMode ? onToggleDeveloper() : setShowAuthInput(!showAuthInput)}
                      className={`w-14 h-7 rounded-full transition-all duration-500 relative active:scale-95 ${isDeveloperMode ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'bg-slate-200 dark:bg-slate-800'}`}
                    >
                      <div 
                        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-500 ease-in-out pointer-events-none"
                        style={{ transform: isDeveloperMode ? 'translateX(32px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>

                  {showAuthInput && !isDeveloperMode && (
                    <div className="p-6 bg-slate-100 dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">请输入授权口令</span>
                        <button onClick={() => setShowAuthInput(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type={isPassVisible ? "text" : "password"} 
                            value={inputPassword}
                            onChange={(e) => setInputPassword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const success = onToggleDeveloper(inputPassword);
                                if (success) {
                                  setInputPassword('');
                                  setShowAuthInput(false);
                                }
                              }
                            }}
                            placeholder="••••••••••••"
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-theme/20 pr-10"
                            autoFocus
                          />
                          <button 
                            onClick={() => setIsPassVisible(!isPassVisible)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-theme transition-colors"
                          >
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
                          className="px-6 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-all"
                        >
                          确认
                        </button>
                      </div>
                    </div>
                  )}

                  {isDeveloperMode && (
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-bold leading-relaxed">
                        <span className="mr-2">🔧</span> 开发者模式已开启：无限权限。
                      </p>
                    </div>
                  )}

                  <div className="pt-8 border-t border-slate-100 dark:border-slate-800/60 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-black italic">第三方网关分流 {isDeveloperMode ? '' : '(需开发者权限)'}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {useThirdPartyGateway ? '已开启商业矩阵 (3.1 Flash / 3 Pro) + 第三方网关' : '已开启开发模式 (2.5 Flash) + 官方通道'}
                        </p>
                      </div>
                      <button 
                        onClick={() => isDeveloperMode && onToggleGateway(!useThirdPartyGateway)}
                        disabled={!isDeveloperMode}
                        className={`w-14 h-7 rounded-full transition-all duration-500 relative active:scale-95 ${!isDeveloperMode ? 'opacity-50 cursor-not-allowed' : ''} ${useThirdPartyGateway ? 'bg-theme shadow-theme' : 'bg-slate-200 dark:bg-slate-800'}`}
                      >
                        <div 
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-500 ease-in-out pointer-events-none"
                          style={{ transform: useThirdPartyGateway ? 'translateX(32px)' : 'translateX(0)' }}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-black italic">显示开发监控窗口 (Token Monitor)</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {showTokenMonitor ? '已开启实时 Token 流量监控' : '已关闭开发监控窗口'}
                        </p>
                      </div>
                      <button 
                        onClick={() => onToggleTokenMonitor(!showTokenMonitor)}
                        className={`w-14 h-7 rounded-full transition-all duration-500 relative active:scale-95 ${showTokenMonitor ? 'bg-theme shadow-theme' : 'bg-slate-200 dark:bg-slate-800'}`}
                      >
                        <div 
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-500 ease-in-out pointer-events-none"
                          style={{ transform: showTokenMonitor ? 'translateX(32px)' : 'translateX(0)' }}
                        />
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
                          className="px-4 py-2 bg-theme text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-theme-light transition-all shadow-lg"
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
