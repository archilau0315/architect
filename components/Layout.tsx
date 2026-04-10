import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppTab, CreativeDomain, UserTier, ConversationNode, ConversationMode, UserPreferences } from '../types.ts';
import { getTranslation } from '../i18n/locales.ts';
import {
  Home, Package, Palette, User, MessageCircle, Image as ImageIcon, Video,
  ChevronRight, ChevronDown, Plus, X, Settings, Moon, Sun,
  Building2, Sparkles
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LayoutProps {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  currentDomain: CreativeDomain;
  onDomainChange: (domain: CreativeDomain) => void;
  onDomainDoubleClick?: () => void;
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
  // conversation tree
  activeSessionId?: string;
  onSessionChange?: (id: string, mode?: ConversationMode) => void;
  // theme toggle
  preferences?: UserPreferences;
  onPreferencesChange?: (prefs: UserPreferences) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TREE_KEY = 'kbitai-conv-tree-v1';
const AVATAR_KEY = 'user-architect-avatar-v120-locked';
const COMPANY_LOGO_KEY = 'kbit-company-logo-v120-locked';
const THEME_KEY = 'architect-theme-v120';

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconArch = ({ className = "w-3.5 h-3.5" }) => <Building2 className={className} strokeWidth={1.5} />;
const IconProduct = ({ className = "w-3.5 h-3.5" }) => <Package className={className} strokeWidth={1.5} />;
const IconArt = ({ className = "w-3.5 h-3.5" }) => <Palette className={className} strokeWidth={1.5} />;
const IconChar = ({ className = "w-3.5 h-3.5" }) => <User className={className} strokeWidth={1.5} />;
const IconChat = ({ className = "w-4 h-4" }) => <MessageCircle className={className} strokeWidth={2} />;
const IconRender = ({ className = "w-4 h-4" }) => <ImageIcon className={className} strokeWidth={2} />;
const IconVideo = ({ className = "w-4 h-4" }) => <Video className={className} strokeWidth={2} />;

const DOMAIN_ICONS: Record<string, React.FC<{ className?: string }>> = {
  architecture: IconArch,
  product: IconProduct,
  art: IconArt,
  character: IconChar
};

const DOMAIN_CONFIG: Record<CreativeDomain, { label: string; icon: string; title: string; titleEn: string }> = {
  architecture: { label: '建筑空间', icon: 'architecture', title: '建筑空间设计师', titleEn: 'Architectural Space Designer' },
  product:      { label: '产品设计', icon: 'product',      title: '工业创意设计师', titleEn: 'Industrial Creative Designer' },
  art:          { label: '视觉艺术', icon: 'art',          title: '视觉艺术总监',   titleEn: 'Visual Art Director' },
  character:    { label: '角色概念', icon: 'character',    title: '角色概念原画师', titleEn: 'Character Concept Artist' },
};

const MODE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  chat: IconChat,
  architect: IconRender,
  video: IconVideo
};
const MODE_META: Record<ConversationMode, { icon: string; label: string; tab: AppTab }> = {
  chat:      { icon: 'chat',      label: '对话', tab: 'chat' },
  architect: { icon: 'architect', label: '渲染', tab: 'architect' },
  video:     { icon: 'video',     label: '视频', tab: 'video' },
};

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ─── Editable label ───────────────────────────────────────────────────────────
const EditableLabel: React.FC<{ value: string; onChange: (v: string) => void; className?: string }> = ({ value, onChange, className }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
  const commit = () => { setEditing(false); if (draft.trim()) onChange(draft.trim()); else setDraft(value); };
  if (editing) return (
    <input ref={ref} value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
      className="bg-transparent border-b border-indigo-400/60 outline-none text-xs w-full text-slate-200 py-0"
    />
  );
  return <span className={className} onDoubleClick={() => { setDraft(value); setEditing(true); }}>{value}</span>;
};

// ─── Tree node ────────────────────────────────────────────────────────────────
const TreeNode: React.FC<{
  node: ConversationNode;
  depth: number;
  activeId: string;
  onSelect: (id: string, mode?: ConversationMode) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddGroup: (parentId: string) => void;
  onAddSession: (parentId: string) => void;
  onToggle: (id: string) => void;
}> = ({ node, depth, activeId, onSelect, onRename, onDelete, onAddGroup, onAddSession, onToggle }) => {
  const [hover, setHover] = useState(false);
  const isGroup = node.type === 'group';
  const isActive = !isGroup && node.id === activeId;

  return (
    <div>
      <div
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`flex items-center gap-1.5 pr-2 py-2 rounded-lg cursor-pointer transition-all duration-150 select-none min-h-[44px]
          ${isActive ? 'bg-white/8 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'}
          focus-within:ring-2 focus-within:ring-indigo-500/40`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => isGroup ? onToggle(node.id) : onSelect(node.id, node.mode)}
      >
        {/* chevron / mode icon */}
        <span className="shrink-0 w-4 flex items-center justify-center text-slate-500">
          {isGroup
            ? (node.isExpanded ? <ChevronDown className="w-3 h-3" strokeWidth={2} /> : <ChevronRight className="w-3 h-3" strokeWidth={2} />)
            : node.mode ? (() => { const I = MODE_ICONS[node.mode]; return I ? <I className="w-4 h-4" /> : null; })() : <IconChat className="w-4 h-4" />
          }
        </span>

        <EditableLabel value={node.name} onChange={v => onRename(node.id, v)}
          className="flex-1 text-[11px] truncate leading-none" />

        {/* action buttons */}
        {hover && (
          <div className="flex items-center gap-0.5 shrink-0 ml-1" onClick={e => e.stopPropagation()}>
            {isGroup && <>
              <button onClick={() => onAddSession(node.id)} title={t.sidebar.newSession}
                className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-150 active:scale-95">
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <button onClick={() => onAddGroup(node.id)} title={t.sidebar.newGroup}
                className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-150 active:scale-95">
                <Plus className="w-3 h-3" strokeWidth={2} />
              </button>
            </>}
            <button onClick={() => onDelete(node.id)} title={t.common.delete}
              className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150 active:scale-95">
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {isGroup && node.isExpanded && node.children?.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1} activeId={activeId}
          onSelect={onSelect} onRename={onRename} onDelete={onDelete}
          onAddGroup={onAddGroup} onAddSession={onAddSession} onToggle={onToggle} />
      ))}
    </div>
  );
};

// ─── Layout ───────────────────────────────────────────────────────────────────
const Layout: React.FC<LayoutProps> = ({
  children, activeTab, onTabChange, currentDomain, onDomainChange, onDomainDoubleClick,
  isDeveloper, isDeveloperMode = false, userTier = 'free',
  onToggleDeveloper, onToggleSystemVisible, onOpenSettings,
  currentModelName, modelStatus, dailyUsage = 0, balance = 0,
  activeSessionId = '', onSessionChange,
  preferences, onPreferencesChange,
}) => {
  const t = getTranslation(preferences?.language || 'zh-CN');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [versionClickCount, setVersionClickCount] = useState(0);
  const [lastVersionClickTime, setLastVersionClickTime] = useState(0);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);

  // ── conversation tree state ──────────────────────────────────────────────
  const [tree, setTree] = useState<ConversationNode[]>(() => {
    try {
      const s = localStorage.getItem(TREE_KEY);
      if (s) return JSON.parse(s);
    } catch {}
    const firstId = genId();
    const lang = preferences?.language || 'zh-CN';
    return [{
      id: genId(), type: 'group', name: lang === 'zh-CN' ? '今日对话' : 'Today', isExpanded: true, timestamp: Date.now(),
      children: [{ id: firstId, type: 'session', name: lang === 'zh-CN' ? '新对话' : 'New Chat', mode: 'chat', timestamp: Date.now() }]
    }];
  });

  const saveTree = useCallback((next: ConversationNode[]) => {
    setTree(next);
    localStorage.setItem(TREE_KEY, JSON.stringify(next));
  }, []);

  // ── init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const av = localStorage.getItem(AVATAR_KEY); if (av) setAvatarUrl(av);
      const cl = localStorage.getItem(COMPANY_LOGO_KEY); if (cl) setCompanyLogoUrl(cl);
      const th = localStorage.getItem(THEME_KEY);
      if (th === 'light') { setIsDarkMode(false); document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); }
      else { document.documentElement.classList.add('dark'); document.documentElement.classList.remove('light'); }
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY && e.newValue) setAvatarUrl(e.newValue);
      if (e.key === COMPANY_LOGO_KEY && e.newValue) setCompanyLogoUrl(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleTheme = () => {
    if (!preferences || !onPreferencesChange) {
      // Fallback: do nothing if preferences not provided
      return;
    }

    // Toggle between light and dark themes
    const newTheme = preferences.theme === 'light' ? 'dark' : 'light';
    onPreferencesChange({
      ...preferences,
      theme: newTheme
    });
  };

  const handleVersionClick = () => {
    const now = Date.now();
    const count = now - lastVersionClickTime > 3000 ? 1 : versionClickCount + 1;
    if (count >= 5) { onToggleSystemVisible(); setVersionClickCount(0); }
    else setVersionClickCount(count);
    setLastVersionClickTime(now);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void, key: string) => {
    const file = e.target.files?.[0];
    if (file && file.size < 2 * 1024 * 1024) {
      const r = new FileReader();
      r.onloadend = () => { const b = r.result as string; setter(b); localStorage.setItem(key, b); };
      r.readAsDataURL(file);
    }
  };

  // ── tree mutations ────────────────────────────────────────────────────────
  const mutate = (nodes: ConversationNode[], id: string, fn: (n: ConversationNode) => ConversationNode | null): ConversationNode[] =>
    nodes.reduce<ConversationNode[]>((acc, n) => {
      if (n.id === id) { const r = fn(n); if (r) acc.push(r); }
      else acc.push(n.children ? { ...n, children: mutate(n.children, id, fn) } : n);
      return acc;
    }, []);

  const insertInto = (nodes: ConversationNode[], parentId: string, child: ConversationNode): ConversationNode[] =>
    nodes.map(n => n.id === parentId
      ? { ...n, isExpanded: true, children: [...(n.children ?? []), child] }
      : n.children ? { ...n, children: insertInto(n.children, parentId, child) } : n);

  const handleRename = (id: string, name: string) => saveTree(mutate(tree, id, n => ({ ...n, name })));
  const handleDelete = (id: string) => saveTree(mutate(tree, id, () => null));
  const handleToggle = (id: string) => saveTree(mutate(tree, id, n => ({ ...n, isExpanded: !n.isExpanded })));

  const handleAddSession = (parentId?: string) => {
    const s: ConversationNode = { id: genId(), type: 'session', name: t.sidebar.newSession, mode: 'chat', timestamp: Date.now() };
    saveTree(parentId ? insertInto(tree, parentId, s) : [...tree, s]);
    onSessionChange?.(s.id, 'chat');
    onTabChange('chat');
  };

  const handleAddGroup = (parentId?: string) => {
    const g: ConversationNode = { id: genId(), type: 'group', name: t.sidebar.newGroup, isExpanded: true, timestamp: Date.now(), children: [] };
    saveTree(parentId ? insertInto(tree, parentId, g) : [...tree, g]);
  };

  const handleSelectSession = (id: string, mode?: ConversationMode) => {
    onSessionChange?.(id, mode);
    if (mode) onTabChange(MODE_META[mode].tab);
  };

  // ── status dot ───────────────────────────────────────────────────────────
  const statusDot = { connected: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]', assigning: 'bg-amber-500 animate-pulse', error: 'bg-rose-500' }[modelStatus];

  const domain = DOMAIN_CONFIG[currentDomain];

  return (
    <div className="flex min-h-screen w-full text-slate-100 font-sans" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* ════════════════════════════════ SIDEBAR ════════════════════════════ */}
      <aside className={`${collapsed ? 'w-14' : 'w-64'} shrink-0 h-screen sticky top-0 flex flex-col
        border-r
        transition-all duration-300 ease-in-out z-50 overflow-hidden`}
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>

        {/* ── Brand header ── */}
        <div className="flex items-center gap-2 px-2 py-3 border-b shrink-0 min-h-[56px]" style={{ borderColor: 'var(--border-color)' }}>
          {!collapsed && (
            <>
              <div onClick={() => avatarInputRef.current?.click()}
                className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer overflow-hidden hover:border-white/20 transition-all"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                {avatarUrl
                  ? <img src={avatarUrl} className="w-full h-full object-cover" />
                  : <span className="text-[9px] font-bold tracking-tight" style={{ color: 'var(--text-secondary)' }}>KB</span>}
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleFileChange(e, setAvatarUrl, AVATAR_KEY)} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold tracking-tight truncate leading-tight" style={{ color: 'var(--text-primary)' }}>首席图像架构师</p>
                <p className="text-[8px] font-medium tracking-tight truncate leading-tight opacity-60" style={{ color: 'var(--text-secondary)' }}>Chief Image Architect</p>
                <p onClick={handleVersionClick} className={`text-[9px] font-mono cursor-pointer leading-tight ${isDeveloperMode ? 'text-emerald-400' : ''}`}
                  style={{ color: isDeveloperMode ? undefined : 'var(--text-tertiary)' }}>
                  V1.50 {isDeveloperMode && <span className="text-[8px] bg-red-600 text-white px-1 rounded ml-1">DEV</span>}
                </p>
              </div>
            </>
          )}

          {/* collapse toggle - always visible */}
          <button onClick={() => setCollapsed(p => !p)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 transition-all duration-150 shrink-0 ml-auto active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            style={{ color: 'var(--text-secondary)' }}>
            {collapsed ? <ChevronRight className="w-4 h-4" strokeWidth={2.5} /> : <ChevronRight className="w-4 h-4 rotate-180" strokeWidth={2.5} />}
          </button>
        </div>

        {/* ── New conversation button ── */}
        {!collapsed && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <button onClick={() => handleAddSession()}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                bg-white/5 hover:bg-white/8 active:bg-white/10 border border-white/10
                text-white/60 hover:text-white/80 text-[13px] font-medium tracking-wide transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:scale-[0.98]">
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              {t.main.newConversation}
            </button>
          </div>
        )}

        {/* ── Conversation tree ── */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 custom-scrollbar">
            {tree.map(node => (
              <TreeNode key={node.id} node={node} depth={0} activeId={activeSessionId}
                onSelect={handleSelectSession} onRename={handleRename} onDelete={handleDelete}
                onAddGroup={handleAddGroup} onAddSession={handleAddSession} onToggle={handleToggle} />
            ))}
            <button onClick={() => handleAddGroup()}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-all">
              <Plus className="w-3 h-3" strokeWidth={2} /> {t.sidebar.newGroup}
            </button>
          </div>
        )}

        {/* ── Domain switcher (collapsed: hidden) ── */}
        {!collapsed && (
          <div className="px-3 py-2 border-t border-white/[0.06] shrink-0">
            <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest mb-2 px-1">{preferences?.language === 'zh-CN' ? '创作领域' : 'Domains'}</p>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(DOMAIN_CONFIG) as CreativeDomain[]).map(d => {
                const Icon = DOMAIN_ICONS[d];
                const domainLabel = t.domains[d] || DOMAIN_CONFIG[d].label;
                return (
                  <button key={d}
                    onClick={() => onDomainChange(d)}
                    onDoubleClick={() => onDomainDoubleClick?.()}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[9px] font-semibold transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/40
                      ${currentDomain === d
                        ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                        : 'text-slate-600 hover:bg-white/5 hover:text-slate-400'}`}
                    title={preferences?.language === 'zh-CN' ? '单击切换领域，双击展开预设风格' : 'Click to switch, double-click for presets'}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{domainLabel.slice(0, 2)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Company info ── */}
        {!collapsed && (
          <div className="px-3 py-3 border-t shrink-0 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
            {/* 口号 */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-blue-400/70 font-medium tracking-[0.2em] uppercase leading-none italic">Finite Form Infinite Tech</p>
              <div className="border-l-2 pl-2" style={{ borderColor: 'var(--border-hover)' }}>
                <p className="text-[13px] font-semibold tracking-[0.08em] uppercase leading-none" style={{ color: 'var(--text-primary)' }}>设计有形 科技无界</p>
              </div>
            </div>

            {/* 公司信息 */}
            <div className="flex items-center gap-2.5">
              <div onClick={() => companyLogoInputRef.current?.click()}
                className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:border-white/20 transition-all p-1.5"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                {companyLogoUrl
                  ? <img src={companyLogoUrl} onError={() => { setCompanyLogoUrl(null); localStorage.removeItem(COMPANY_LOGO_KEY); }} className="w-full h-full object-contain" />
                  : !logoLoadError
                    ? <img src="/architect/Com_Logo.png" onError={() => setLogoLoadError(true)} className="w-full h-full object-contain" alt="Logo" />
                    : <span className="text-[11px] font-black text-indigo-400">KF</span>}
              </div>
              <input ref={companyLogoInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleFileChange(e, setCompanyLogoUrl, COMPANY_LOGO_KEY)} />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-[9px] font-medium leading-tight" style={{ color: 'var(--text-tertiary)' }}>Author: 刘珂（Archilau）</p>
                <p className="text-[12px] font-semibold tracking-tight leading-tight truncate" style={{ color: 'var(--text-secondary)' }}>匡形无界智能科技有限公司</p>
                <p className="text-[8px] font-medium leading-tight uppercase tracking-tighter" style={{ color: 'var(--text-tertiary)' }}>Kuanform Boundless Intelligent Technology Co., Ltd.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom status bar ── */}
        <div className={`border-t shrink-0 ${collapsed ? 'px-2 py-3' : 'px-3 py-2.5'}`} style={{ borderColor: 'var(--border-color)' }}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${statusDot}`} />
              <button onClick={onOpenSettings} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all" style={{ color: 'var(--text-tertiary)' }}>
                <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
              <span className="text-[9px] font-mono truncate flex-1" style={{ color: 'var(--text-tertiary)' }} title={currentModelName}>{currentModelName}</span>
              <div className="flex flex-col items-start shrink-0 text-[9px] font-mono">
                <div className="flex items-center gap-1">
                  <span style={{ color: 'var(--text-tertiary)' }}>余额</span>
                  <span className={`font-black ${balance < 10 ? 'text-rose-400' : 'text-blue-400'}`}>{balance.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span style={{ color: 'var(--text-tertiary)' }}>消耗</span>
                  <span className="font-black text-amber-400">{dailyUsage.toLocaleString()}</span>
                </div>
              </div>
              <button onClick={toggleTheme} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all" style={{ color: 'var(--text-tertiary)' }}>
                {preferences?.theme === 'light'
                  ? <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  : <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
                }
              </button>
              <button onClick={onOpenSettings} className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        {/* ICP & 版权 */}
        {!collapsed && (
          <div className="px-3 pb-3 shrink-0 border-t pt-2" style={{ borderColor: 'var(--border-color)' }}>
            {/* 版权 */}
            <p className="text-center text-[7px] mb-1.5 opacity-70" style={{ color: 'var(--text-tertiary)' }}>
              © 天津匡形无界智能科技有限公司
            </p>
            {/* ICP + 公安备案 */}
            <div className="flex items-center justify-between opacity-40 hover:opacity-70 transition-opacity">
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer"
                className="text-[6px] transition-opacity"
                style={{ color: 'var(--text-tertiary)' }}>
                津ICP备2026002055号-1
              </a>
              <a href="https://beian.mps.gov.cn/#/query/webSearch?code=12010402002460" target="_blank" rel="noreferrer"
                className="flex items-center gap-0.5 transition-opacity">
                <img src="/architect/备案图标.png" className="w-2.5 h-2.5 shrink-0" alt="公安备案" />
                <span className="text-[6px]" style={{ color: 'var(--text-tertiary)' }}>津公网安备12010402002460号</span>
              </a>
            </div>
          </div>
        )}
      </aside>

      {/* ════════════════════════════════ MAIN ═══════════════════════════════ */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto custom-scrollbar relative" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
