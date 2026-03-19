import React, { useState, useRef, useEffect } from 'react';
import { AppTab, CreativeDomain, UserTier } from '../types.ts';
import { GeminiService } from '../services/geminiService.ts';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  currentDomain: CreativeDomain;
  onDomainChange: (domain: CreativeDomain) => void;
  isDeveloper: boolean;
  isDeveloperMode?: boolean;
  userTier?: UserTier;
  onToggleDeveloper: (pass?: string) => boolean;
  onToggleSystemVisible: () => void;
  onOpenSettings: () => void;
  currentModelName: string;
  modelStatus: 'connected' | 'assigning' | 'error';
  dailyUsage?: number;
  balance?: number;
}

const DOMAIN_CONFIG: Record<CreativeDomain, { label: string, icon: string, color: string, title: string, titleEn: string }> = {
  architecture: { label: '建筑空间', icon: '🏛️', color: 'indigo', title: '建筑空间设计师', titleEn: 'Architectural Space Designer' },
  product: { label: '产品设计', icon: '⌚', color: 'slate', title: '工业创意设计师', titleEn: 'Industrial Creative Designer' },
  art: { label: '视觉艺术', icon: '🖼️', color: 'amber', title: '视觉艺术总监', titleEn: 'Visual Art Director' },
  character: { label: '角色概念', icon: '🧙', color: 'rose', title: '角色概念原画师', titleEn: 'Character Concept Artist' }
};

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  currentDomain,
  onDomainChange,
  isDeveloper, 
  isDeveloperMode = false,
  userTier = 'free',
  onToggleDeveloper, 
  onToggleSystemVisible,
  onOpenSettings,
  currentModelName,
  modelStatus,
  dailyUsage = 0,
  balance = 0
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [versionClickCount, setVersionClickCount] = useState(0);
  const [lastVersionClickTime, setLastVersionClickTime] = useState(0);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  
  const AVATAR_KEY = 'user-architect-avatar-v120-locked';
  const COMPANY_LOGO_KEY = 'kbit-company-logo-v120-locked';
  const THEME_KEY = 'architect-theme-v120';

  useEffect(() => {
    try {
      const savedAvatar = localStorage.getItem(AVATAR_KEY);
      if (savedAvatar) setAvatarUrl(savedAvatar);
      const savedLogo = localStorage.getItem(COMPANY_LOGO_KEY);
      if (savedLogo) setCompanyLogoUrl(savedLogo);
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'light') {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    } catch (err) { console.warn(err); }
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY && e.newValue) {
        setAvatarUrl(e.newValue);
      }
      if (e.key === COMPANY_LOGO_KEY && e.newValue) {
        setCompanyLogoUrl(e.newValue);
      }
    };
    
    const handleAvatarEvent = (e: CustomEvent<string>) => {
      setAvatarUrl(e.detail);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('avatarChanged', handleAvatarEvent as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('avatarChanged', handleAvatarEvent as EventListener);
    };
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    document.documentElement.classList.toggle('light', !newMode);
    localStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
  };

  const handleVersionClick = () => {
    const now = Date.now();
    if (now - lastVersionClickTime > 3000) {
      setVersionClickCount(1);
    } else {
      const newCount = versionClickCount + 1;
      if (newCount >= 5) {
        onToggleSystemVisible();
        setVersionClickCount(0);
      } else {
        setVersionClickCount(newCount);
      }
    }
    setLastVersionClickTime(now);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void, key: string) => {
    const file = e.target.files?.[0];
    if (file && file.size < 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setter(base64);
        localStorage.setItem(key, base64);
      };
      reader.readAsDataURL(file as Blob);
    }
  };

  const navItems = [
    { id: 'architect', label: '全域渲染工坊', locked: false },
    { id: 'video', label: '动态漫游导演', locked: false },
    { id: 'chat', label: '创意顾问咨询', locked: false },
    { id: 'analyze', label: '视觉基因解构', locked: false }
  ];

  const getStatusColor = () => {
    switch (modelStatus) {
      case 'connected': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
      case 'assigning': return 'bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]';
      case 'error': return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]';
      default: return 'bg-slate-500';
    }
  };

  const domain = DOMAIN_CONFIG[currentDomain];
  const themeColor = domain.color;

  return (
    <div className={`flex flex-col md:flex-row min-h-screen w-full bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-500 font-sans theme-${themeColor}`}>
      <nav className="w-full md:w-80 h-auto md:h-screen sticky top-0 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-8 pb-4 flex flex-col z-50 shadow-2xl transition-all duration-500 overflow-hidden shrink-0">
        
        {/* Top Fixed Section: Brand, Domain & Identity */}
        <div className="flex flex-col shrink-0">
          {/* App Logo */}
          <div className="flex justify-center mb-4">
            <img src="./archi01.png" alt="App Logo" className="h-16 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          {/* Brand Identifier */}
          <div className="mb-6 border-b border-slate-100 dark:border-white/5 pb-4">
            <h2 className="text-[20px] font-black text-slate-900 dark:text-white uppercase tracking-[0.1em] mb-1 text-center">首席图像架构师</h2>
            <div className="flex items-center gap-2 justify-center">
              <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Chief Image Architect</p>
              <div className="w-px h-2 bg-slate-200 dark:bg-slate-800" />
              <p onClick={handleVersionClick} className="text-[8.5px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.1em] cursor-pointer">
                <span className={`font-mono ${isDeveloper ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-700'}`}>V1.50</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-10 mb-8">
            {/* Domain Switcher */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">领域切换 Domain</span>
                <span className="text-[10px] font-mono text-slate-300 dark:text-slate-700">MOD: 01</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(DOMAIN_CONFIG) as CreativeDomain[]).map(d => (
                  <button 
                    key={d} 
                    onClick={() => onDomainChange(d)}
                    className={`py-1 px-3 rounded-2xl flex flex-col items-center gap-0.5 transition-all border ${currentDomain === d ? `bg-${DOMAIN_CONFIG[d].color}-600 text-white border-transparent shadow-lg` : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    <span className="text-xl">{DOMAIN_CONFIG[d].icon}</span>
                    <span className="text-[9px] font-black uppercase">{DOMAIN_CONFIG[d].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6 select-none">
              <div className="flex items-center justify-between gap-3">
                <div onClick={() => avatarInputRef.current?.click()} className={`w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-2xl ring-2 ring-slate-100 dark:ring-white/5 border border-slate-200 dark:border-slate-700 cursor-pointer overflow-hidden shrink-0 transition-all hover:scale-105 active:scale-95 group relative`}>
                  {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <div className={`w-full h-full bg-gradient-to-br from-${themeColor}-600 to-${themeColor}-900 flex items-center justify-center`}><span className="text-white text-[12px] font-black tracking-tighter">ARCHI</span></div>}
                  <div className={`absolute inset-0 bg-${themeColor}-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}><span className="text-[8px] text-white font-black uppercase">Edit Logo</span></div>
                </div>
                <input type="file" ref={avatarInputRef} onChange={(e) => handleFileChange(e, setAvatarUrl, AVATAR_KEY)} accept="image/*" className="hidden" />
                <div className="flex-1 flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[16px] font-black tracking-tight text-slate-900 dark:text-white italic leading-none text-center whitespace-nowrap">{domain.title}</h1>
                    {/* 开发者标识 - 红色权力感 */}
                    {isDeveloperMode && (
                      <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-md shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-pulse flex-shrink-0 z-10">DEV</span>
                    )}
                    {/* PRO/PLUS 金色尊贵标识 */}
                    {(userTier === 'pro' || userTier === 'plus') && !isDeveloperMode && (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[9px] font-black rounded-md shadow-[0_0_20px_rgba(251,191,36,0.8)] flex-shrink-0 z-10">{userTier.toUpperCase()}</span>
                    )}
                    {/* Basic 标识 */}
                    {userTier === 'basic' && !isDeveloperMode && (
                      <span className="px-2 py-0.5 bg-slate-500 text-white text-[9px] font-black rounded-md flex-shrink-0 z-10">BASIC</span>
                    )}
                  </div>
                  <p className="text-[8.5px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.1em] text-center leading-tight">{domain.titleEn}</p>
                </div>
                <div className="flex flex-col justify-center h-16 pl-1">
                  <button onClick={toggleTheme} className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 flex items-center justify-center border border-slate-100 dark:border-slate-700/50 hover:text-theme transition-all shadow-sm">
                    {isDarkMode ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth={2.5} /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" strokeWidth={2.5} /></svg>}
                  </button>
                </div>
              </div>
              <div className={`pt-2 border-t border-slate-100 dark:border-slate-800/60`}><p className={`text-[10px] text-${themeColor}-600 dark:text-${themeColor}-400 font-bold tracking-[0.25em] uppercase leading-none italic`}>Finite Form Infinite Tech</p></div>
              <div className={`border-l-2 border-${themeColor}-500 pl-3`}><p className="text-[13px] text-slate-900 dark:text-white font-black tracking-[0.1em] text-sm uppercase leading-none">设计有形 科技无界</p></div>
              <div className="flex items-center gap-4 py-1">
                <div onClick={() => companyLogoInputRef.current?.click()} className="w-12 h-12 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-center shrink-0 overflow-hidden p-2 transition-all hover:rotate-6 cursor-pointer group">
                  {companyLogoUrl ? (
                    <img 
                      src={companyLogoUrl} 
                      onError={() => { setCompanyLogoUrl(null); localStorage.removeItem(COMPANY_LOGO_KEY); }} 
                      className="w-full h-full object-contain" 
                    />
                  ) : (
                    !logoLoadError ? (
                      <img 
                        src="./Com_Logo.png" 
                        onError={() => setLogoLoadError(true)} 
                        className="w-full h-full object-contain" 
                        alt="Logo" 
                      />
                    ) : (
                      <span className="text-[12px] font-black text-theme-light uppercase tracking-tighter">KF</span>
                    )
                  )}
                </div>
                <input type="file" ref={companyLogoInputRef} onChange={(e) => handleFileChange(e, setCompanyLogoUrl, COMPANY_LOGO_KEY)} accept="image/*" className="hidden" />
                <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold volunteering leading-normal">Author：刘珂（Archilau）</p>
                  <p className="text-[13px] text-slate-900 dark:text-white font-black tracking-tight leading-normal truncate">匡形无界智能科技有限公司</p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold leading-tight uppercase tracking-tighter whitespace-normal">Kuanform Boundless Intelligent Technology Co., Ltd.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Middle Section: Navigation (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-6">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => onTabChange(item.id as AppTab)} className={`w-full text-left px-6 py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest transition-all ${activeTab === item.id ? `bg-${themeColor}-600 text-white shadow-xl translate-x-1` : `text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-${themeColor}-500`}`}>{item.label}</button>
            ))}
          </div>
        </div>

        {/* Bottom Fixed Section: Status, Finance & Record Info */}
        <div className="mt-auto shrink-0 pt-6 border-t border-slate-100 dark:border-slate-800/40 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5 min-w-0 shrink">
              <div className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-500 ${getStatusColor()}`} />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[100px]" title={currentModelName}>
                {currentModelName}
              </span>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 ml-auto">
              <div className="flex flex-col items-end leading-tight gap-0.5">
                <span className={`text-[8px] font-black tracking-tighter transition-colors text-slate-400 opacity-60 uppercase`}>消耗: {dailyUsage} 点</span>
                <span className={`text-[8px] font-black tracking-tighter transition-colors ${balance < 10 ? 'text-rose-500' : 'text-slate-400'}`}>余额: {balance} 点</span>
              </div>
              <button 
                onClick={onOpenSettings} 
                className={`w-7 h-7 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-${themeColor}-600 transition-all flex items-center justify-center active:scale-90 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50 shadow-sm`}
                title="系统管控中心"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
              <span className="text-[7px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-tighter">OK</span>
            </div>
          </div>

          {/* Record / ICP Info Section */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/40 mt-2 px-1">
            <div className="flex justify-between items-start opacity-40 grayscale hover:opacity-70 transition-opacity">
              {/* ICP - Left */}
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[6.5px] font-black uppercase tracking-tighter">ICP备案</span>
                <span className="text-[6px] font-bold tracking-tighter whitespace-nowrap">津ICP备2026002055号</span>
              </div>
              {/* Public Security - Center */}
              <div className="flex flex-col items-center leading-tight">
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 bg-slate-400 rounded-[1px] shrink-0" title="警徽占位" />
                  <span className="text-[6.5px] font-black uppercase tracking-tighter">公安备案</span>
                </div>
                <span className="text-[6px] font-bold tracking-tighter whitespace-nowrap">津公网安备XXXX号</span>
              </div>
              {/* MIIT - Right */}
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[6.5px] font-black uppercase tracking-tighter">工信部备案</span>
                <span className="text-[6px] font-bold tracking-tighter whitespace-nowrap">待审批</span>
              </div>
            </div>
          </div>
          {/* Copyright Section */}
          <div className="mt-4 text-center opacity-30">
            <p className="text-[7px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
              2026 匡形无界 版权所有
            </p>
          </div>
        </div>
      </nav>

      <main className="flex-1 min-w-0 h-screen overflow-y-auto custom-scrollbar relative p-0 transition-all duration-300">
        <div className="max-w-none mx-auto w-full h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;