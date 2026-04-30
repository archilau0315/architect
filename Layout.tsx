
import React, { useState, useRef, useEffect } from 'react';
import { AppTab } from './types.ts';
import { UserAvatar } from './components/UserAvatar';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  isDeveloper: boolean;
  onToggleDeveloper: () => void;
  onOpenSettings: () => void;
  onOpenPricing: () => void;
  currentModelName: string;
  credits: number;
  userTier: string;
  modelStatus: 'connected' | 'assigning' | 'error';
  todayUsed?: number;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  isDeveloper, 
  onToggleDeveloper, 
  onOpenSettings,
  onOpenPricing,
  currentModelName,
  credits,
  userTier,
  modelStatus,
  todayUsed = 0,
}) => {
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [versionClickCount, setVersionClickCount] = useState(0);
  
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  
  const COMPANY_LOGO_KEY = 'kbit-company-logo-v120-locked';
  const THEME_KEY = 'architect-theme-v120';

  useEffect(() => {
    try {
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
  }, []);

  // 监听公司 logo 变更事件
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === COMPANY_LOGO_KEY && e.newValue) setCompanyLogoUrl(e.newValue);
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
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
    const newCount = versionClickCount + 1;
    if (newCount >= 5) {
      onToggleDeveloper();
      setVersionClickCount(0);
    } else {
      setVersionClickCount(newCount);
      setTimeout(() => setVersionClickCount(0), 3000);
    }
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
    { id: 'architect', label: '空间渲染工坊', locked: false },
    { id: 'chat', label: '架构顾问咨询', locked: false },
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-500 font-sans">
      <nav className="w-full md:w-80 h-auto md:h-screen sticky top-0 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-10 z-50 shadow-2xl transition-all duration-500 overflow-y-auto custom-scrollbar shrink-0">
        <div className="flex flex-col gap-6 select-none">
          <div className="flex items-center justify-between gap-3">
            <UserAvatar size="md" editable className="shrink-0" />
            <div className="flex-1 flex flex-col items-center">
              <h1 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white italic leading-none mb-1.5 text-center whitespace-nowrap">首席图像架构师</h1>
              <p onClick={handleVersionClick} className="text-[8.5px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.25em] cursor-pointer">CORE <span className={`font-mono ${isDeveloper ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-700'}`}>V1.45</span></p>
            </div>
            <div className="flex flex-col justify-center h-16 pl-1">
              <button onClick={toggleTheme} className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-400 flex items-center justify-center border border-slate-100 dark:border-slate-700/50 hover:text-theme transition-all shadow-sm">
                {isDarkMode ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth={2.5} /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" strokeWidth={2.5} /></svg>}
              </button>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60"><p className="text-[10px] text-theme dark:text-theme-light font-bold tracking-[0.25em] uppercase leading-none italic">Finite Form Infinite Tech</p></div>
          <div className="border-l-2 border-theme pl-3"><p className="text-[13px] text-slate-900 dark:text-white font-black tracking-[0.1em] text-sm uppercase leading-none">设计有形 科技无界</p></div>
          <div className="flex items-center gap-4 py-1">
            <div onClick={() => companyLogoInputRef.current?.click()} className="w-12 h-12 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-center shrink-0 overflow-hidden p-2 transition-all hover:rotate-6 cursor-pointer group">
              {companyLogoUrl ? <img src={companyLogoUrl} className="w-full h-full object-contain" /> : <span className="text-[12px] font-black text-theme-light uppercase tracking-tighter">KF</span>}
            </div>
            <input type="file" ref={companyLogoInputRef} onChange={(e) => handleFileChange(e, setCompanyLogoUrl, COMPANY_LOGO_KEY)} accept="image/*" className="hidden" />
            <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-normal">Author：刘珂（Archilau）</p>
              <p className="text-[13px] text-slate-900 dark:text-white font-black tracking-tight leading-normal truncate">匡形无界智能科技有限公司</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold leading-tight uppercase tracking-tighter whitespace-normal">Kuanform Boundless Intelligent Technology Co., Ltd.</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 mt-4">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => onTabChange(item.id as AppTab)} className={`w-full text-left px-6 py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-theme text-white shadow-xl translate-x-1' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-theme'}`}>{item.label}</button>
          ))}
          <button 
            onClick={onOpenPricing} 
            className="w-full text-left px-6 py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center justify-between group"
          >
            <span>订阅与积分</span>
            <div className="flex flex-col items-end">
              <span className="text-[10px] tabular-nums">{credits.toLocaleString()} PTS</span>
              <span className="text-[7px] opacity-60 uppercase tracking-tighter">{userTier} TIER</span>
            </div>
          </button>
        </div>

        <div className="mt-auto pt-8 border-t border-slate-100 dark:border-slate-800/40 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-500 ${getStatusColor()}`} />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[110px]" title={currentModelName}>
              {currentModelName}
            </span>
          </div>
          <div className="flex-1 h-px" />
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={onOpenSettings} 
              className="w-8 h-8 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-theme transition-all flex items-center justify-center active:scale-90 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50" 
              title="系统管控中心"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
            </button>
            <span className="text-[8px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-tighter">ENGINE: OK</span>
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
