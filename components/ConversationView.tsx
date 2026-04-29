import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GeminiService, MASTER_STYLES } from '../services/geminiService.ts';
import { ConversationMode, CustomModel, CreativeDomain, UserTier } from '../types.ts';
import UnifiedInput, { UnifiedPayload } from './UnifiedInput.tsx';
import InpaintEditor from './InpaintEditor.tsx';
import { VideoPlayer } from './VideoPlayer.tsx';
import { Ph8UsageService } from '../services/ph8UsageService.ts';
import { WatermarkUtils } from '../services/watermarkService.ts';
import { getTranslation } from '../i18n/locales.ts';
import type { Language } from '../i18n/locales.ts';
import { MessageCircle, Image, Video, Download, RefreshCw, Copy, StopCircle, UserCircle, Palette, X, Lock, LockOpen } from 'lucide-react';

// ─── PH8 费用扣除（共享函数，避免竞态：每次调用独立查询，不依赖闭包状态）─────────
async function deductPh8Cost(label: string, onConsumePoints?: (n: number) => Promise<boolean>) {
  try {
    const session = localStorage.getItem('architect-invite-session');
    if (!session) return;
    const { user_id, email } = JSON.parse(session);
    const userId = user_id || email;
    const result = await Ph8UsageService.getLatestUsage(userId);
    if (result.success && result.data) {
      const realCost = result.data.total_tokens || 0;
      console.log(`[PH8真实费用-${label}]`, { requestId: result.data.request_id, cost: realCost, model: result.data.model });
      if (realCost > 0 && onConsumePoints) {
        const userPoints = Math.ceil(realCost / 10);
        if (!onConsumePoints(userPoints)) console.warn('[PH8费用] 积分不足:', userPoints);
      }
    }
  } catch (err) {
    console.error('获取PH8真实费用失败:', err);
  }
}

// ─── Mode Icons ────────────────────────────────────────────────────────────────
const MODE_ICONS: Record<ConversationMode, React.FC<{ className?: string }>> = {
  chat:      ({ className = "w-4 h-4" }) => <MessageCircle className={className} />,
  architect: ({ className = "w-4 h-4" }) => <Image className={className} />,
  video:     ({ className = "w-4 h-4" }) => <Video className={className} />,
};



// ─── Message types ────────────────────────────────────────────────────────────
type MsgRole = 'user' | 'assistant';
type MsgType = 'text' | 'image' | 'video' | 'error' | 'thinking';

interface Message {
  id: string;
  role: MsgRole;
  type: MsgType;
  text?: string;
  images?: string[];   // base64 data URLs
  watermarkedImages?: string[];  // 带水印版本
  seeds?: number[];    // 每张图对应的seed值
  videoUrl?: string;
  watermarkedVideoUrl?: string;  // 带水印的视频版本
  timestamp: number;
  rerunPayload?: UnifiedPayload;
  searchImages?: string[];  // 搜索结果中的图片URL
}

interface ConversationViewProps {
  modelConfig: CustomModel;
  domain: CreativeDomain;
  instructions: any;
  points: { daily: number; purchased: number };
  onConsumePoints: (n: number) => Promise<boolean>;
  pendingVideoMessage?: { url: string; prompt: string } | null;
  onClearPendingVideo?: () => void;
  useThirdPartyGateway?: boolean;
  isDeveloperMode?: boolean;
  showPresetPanel?: boolean;
  onTogglePresetPanel?: () => void;
  language?: Language;
  theme?: string;
  userTier?: UserTier;
  onModeChange?: (mode: ConversationMode) => void;
}

const gemini = GeminiService;
let msgId = 0;
const uid = () => `m${++msgId}_${Date.now()}`;

// ─── Text renderer（图片解析/反推提示词专用）─────────────────────────────
// 规则：去除 ### 和 ** 标记，用项目主题色矩形块做背景，无左竖边框，支持暗/亮模式
const renderTextWithCode = (text: string, isError: boolean, copyLabel = 'Copy', theme = 'dark') => {
  // 预处理：去掉所有 ### 和 ** 标记
  const cleaned = text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .trim();

  // 按代码块分割
  const parts = cleaned.split(/(```[\w]*\n?[\s\S]*?```)/g);
  // 使用CSS变量读取项目实时主题色（自动跟随用户选择的主题方案）
  const isDark = theme === 'dark';

  return parts.map((part, i) => {
    const match = part.match(/^```([\w]*)\n?([\s\S]*?)```$/);
    if (match) {
      const lang = match[1] || 'code';
      const code = match[2].trim();
      return (
        <div key={i} className="mt-2 rounded-xl overflow-hidden"
          style={{
            backgroundColor: isDark ? 'var(--bg-secondary)' : '#ffffff',
            border: '1px solid var(--border-color)'
          }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            borderColor: 'var(--border-color)'
          }}>
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--theme-primary-light)' }}>{lang}</span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="text-[10px] transition-colors px-2 py-0.5 rounded hover:opacity-80 flex items-center gap-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Copy className="w-3 h-3" strokeWidth={2} />
              {copyLabel}
            </button>
          </div>
          <pre className="p-3 text-[12px] overflow-x-auto font-mono leading-relaxed custom-scrollbar"
            style={{ color: isDark ? 'rgb(110,231,183)' : 'rgb(5,150,105)' }}>{code}</pre>
        </div>
      );
    }
    // 正文文本：用主题色矩形块做背景，无边框竖线
    return (
      <span key={i} className={`whitespace-pre-wrap ${part.length > 20 ? 'block' : ''}`}
        style={part.length > 20 ? {
          color: isError ? (isDark ? 'rgb(251,113,133)' : 'rgb(220,38,38)') : 'var(--text-primary)',
          padding: '12px 16px',
          marginTop: '8px',
          borderRadius: '12px',
          lineHeight: '1.75',
          fontSize: '13.5px',
          // 核心设计：纯矩形色块背景，用项目主题色的低透明度版本
          backgroundColor: isDark
            ? 'rgba(var(--theme-primary-rgb, 99, 102, 241), 0.08)'   // 暗色：8%透明度主题色
            : 'rgba(var(--theme-primary-rgb, 99, 102, 241), 0.06)',   // 亮色：6%（更淡）
          border: 'none',
          boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.04)'
        } : {
          color: isError ? (isDark ? 'rgb(251,113,133)' : 'rgb(220,38,38)') : 'var(--text-primary)'
        }}>
        {part}
      </span>
    );
  });
};


// ─── ImageBubble：三层结构成图展示 ────────────────────────────────────────────
const ImageBubble: React.FC<{
  images: string[];
  watermarkedImages?: string[];
  seeds?: number[];
  onInpaint?: (imageUrl: string) => void;
  onRerun?: (payload: UnifiedPayload) => void;
  onUpscale?: (imageUrl: string) => void;
  rerunPayload?: UnifiedPayload;
  t: any;
  rerunCount: number;
  setRerunCount: (n: number) => void;
  isDeveloper?: boolean;
}> = ({ images, watermarkedImages = [], seeds = [], onInpaint, onRerun, onUpscale, rerunPayload, t, rerunCount, setRerunCount, isDeveloper = false }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsIdx, setFsIdx] = useState(0);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  // Seed 锁定状态：锁定时重跑复用当前图的seed，解锁时随机
  const [seedLocked, setSeedLocked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('architect-seed-lock-v120') || 'false'); }
    catch { return false; }
  });

  // 监听 ESC 键关闭全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (fullscreen && e.key === 'Escape') {
        setFullscreen(false);
      }
      // 全屏时左右箭头切换图片
      if (fullscreen && images.length > 1) {
        if (e.key === 'ArrowLeft') {
          setFsIdx(p => p > 0 ? p - 1 : images.length - 1);
        } else if (e.key === 'ArrowRight') {
          setFsIdx(p => p < images.length - 1 ? p + 1 : 0);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen, images.length]);

  const safeIdx = Math.min(activeIdx, images.length - 1);

  return (
    <div className="mt-2 flex flex-col gap-3">
      {/* 层1：主图区 */}
      <div className="relative group cursor-zoom-in rounded-xl overflow-hidden border border-white/10 shadow-lg"
        onClick={() => { setFsIdx(safeIdx); setFullscreen(true); }}>
        <img src={images[safeIdx]} className="w-full rounded-xl object-contain transition-transform duration-200 group-hover:scale-[1.01]" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/50 backdrop-blur-sm rounded-full p-2.5">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </div>
        </div>
      </div>

      {/* 层2：操作栏 */}
      <div className="flex items-center gap-3 pt-3 pb-2 border-t flex-wrap" style={{ borderColor: 'var(--border-color)' }}>
        {/* 左侧：图片计数 */}
        <span className="text-[11px] mr-2 shrink-0" style={{ color: 'var(--text-tertiary)' }}>{t.buttons.imageCount} {safeIdx + 1}/{images.length}</span>

        {/* Seed显示：随图切换，可点击复制；点击图标切换锁定状态 */}
        {seeds.length > 0 && seeds[safeIdx] != null && (
          <button
            onClick={() => {
              // 左键：锁定/解锁seed（切换状态）
              setSeedLocked(prev => {
                const next = !prev;
                localStorage.setItem('architect-seed-lock-v120', JSON.stringify(next));
                return next;
              });
              // 同时复制seed值
              navigator.clipboard.writeText(String(seeds[safeIdx]));
            }}
            title={`${seedLocked ? t.parameters.unlockSeed : t.parameters.lockSeed}\n${t.parameters.seed}: ${seeds[safeIdx]}`}
            className={`flex items-center gap-1 min-h-[28px] px-2 py-1 rounded-md text-[11px] font-mono transition-all btn-scale ${
              seedLocked ? 'ring-1 ring-offset-1' : ''
            }`}
            style={{
              backgroundColor: seedLocked ? 'rgba(234, 179, 8, 0.15)' : 'rgba(99, 102, 241, 0.08)',
              borderColor: seedLocked ? 'rgba(234, 179, 8, 0.5)' : 'rgba(99, 102, 241, 0.2)',
              color: seedLocked ? 'rgb(245, 158, 11)' : 'rgb(139, 92, 246)',
              ...(seedLocked ? { '--tw-ring-color': 'rgba(234, 179, 8, 0.4)', '--tw-ring-offset-color': 'transparent' } as React.CSSProperties : {})
            }}>
            {/* 锁定=关闭的锁，解锁=打开的锁（Lucide 项目统一图标） */}
            {seedLocked ? (
              <Lock className="w-3.5 h-3.5" strokeWidth={2.5} />
            ) : (
              <LockOpen className="w-3.5 h-3.5" strokeWidth={2} />
            )}
            S:{seeds[safeIdx]}
          </button>
        )}
        
        {/* 编辑按钮组 */}
        <div className="flex items-center gap-2">
          {/* 全屏查看 - 图标按钮 */}
          <button 
            onClick={() => { setFsIdx(safeIdx); setFullscreen(true); }}
            title={t.buttons.fullscreen}
            className="w-11 h-11 flex items-center justify-center rounded-lg border transition-all btn-scale"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </button>
          
          {/* 图生图 - 图标按钮 */}
          {onInpaint && (
            <button 
              onClick={() => { if (window.confirm(t.buttons.inpaintConfirm.replace('{n}', String(safeIdx + 1)))) onInpaint(images[safeIdx]); }}
              title={t.buttons.inpaintShort}
              className="w-11 h-11 flex items-center justify-center rounded-lg border transition-all btn-scale"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
          )}
          
          {/* HD放大 - 图标按钮 */}
          {onUpscale && (
            <button 
              onClick={() => onUpscale(images[safeIdx])}
              title={t.parameters.hdUpscale}
              className="w-11 h-11 flex items-center justify-center rounded-lg border transition-all btn-scale"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0m4 0h-4m2 2v-4" /></svg>
            </button>
          )}
        </div>
        
        {/* 分隔线 */}
        {onRerun && rerunPayload && (
          <>
            <div className="w-px h-7 mx-1" style={{ backgroundColor: 'var(--border-color)' }} />
            
            {/* 重新生成组 */}
            <div className="flex items-center gap-2">
              <select 
                value={rerunCount} 
                onChange={e => setRerunCount(Number(e.target.value))}
                title={t.buttons.imageCount}
                className="min-h-[44px] w-14 px-2 py-2 rounded-lg border text-[12px] font-medium focus:outline-none cursor-pointer"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                {[1,2,3,4].map(n => <option key={n} value={n} style={{ backgroundColor: 'var(--bg-tertiary)' }}>x{n}</option>)}
              </select>
              
              {/* 重新生成 - 图标按钮（锁定seed时复用固定值，否则随机） */}
              <button
                onClick={() => {
                  const lockedSeed = (seedLocked && seeds.length > 0 && seeds[safeIdx] != null) ? seeds[safeIdx] : undefined;
                  onRerun({ ...rerunPayload,
                    imageConfig: rerunPayload.imageConfig ? { ...rerunPayload.imageConfig, imageCount: rerunCount } : undefined,
                    // 锁定时传递固定seed，解锁时传undefined让后端随机
                    ...(lockedSeed != null && { lockedSeed })
                  });
                }}
                title={seedLocked
                  ? `${t.buttons.rerender} (🔒 Seed: ${seeds.length > 0 && seeds[safeIdx] != null ? seeds[safeIdx] : '?'})`
                  : t.buttons.rerender}
                className={`w-11 h-11 flex items-center justify-center rounded-lg border transition-all btn-scale ${
                  seedLocked ? 'animate-pulse-subtle' : ''
                }`}
                style={{
                  backgroundColor: seedLocked ? 'rgba(234, 179, 8, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                  borderColor: seedLocked ? 'rgba(234, 179, 8, 0.5)' : 'rgba(99, 102, 241, 0.3)',
                  color: seedLocked ? 'rgb(245, 158, 11)' : 'rgb(99, 102, 241)'
                }}>
                <RefreshCw className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </>
        )}
        
        {/* 下载按钮 - 下拉菜单（放在最右侧） */}
        <div className="relative download-dropdown ml-auto" style={{ zIndex: 100 }}>
          <button 
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            title={t.buttons.stdDownload}
            className="w-11 h-11 flex items-center justify-center rounded-lg border transition-all btn-scale"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            <Download className="w-4 h-4" strokeWidth={2} />
          </button>
          
          {/* 下拉菜单 - 向上展开 */}
          {showDownloadMenu && (
            <>
              <div className="absolute bottom-full right-0 mb-1 w-44 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200" style={{ zIndex: 200 }}>
                {/* 带水印下载 */}
                <button
                  onClick={() => {
                    const src = watermarkedImages[safeIdx] || images[safeIdx];
                    const a = document.createElement('a');
                    a.href = src;
                    a.download = `image_${Date.now()}.png`;
                    a.click();
                    setShowDownloadMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
                  style={{ color: 'var(--text-secondary)' }}>
                  <Download className="w-4 h-4" strokeWidth={2} />
                  <span>{t.buttons.stdDownload}</span>
                </button>
                
                {/* 无水印下载（根据权限显示） */}
                {isDeveloper ? (
                  <button
                    onClick={() => { 
                      const a = document.createElement('a'); 
                      a.href = images[safeIdx]; 
                      a.download = `image_PRO_${Date.now()}.png`; 
                      a.click();
                      setShowDownloadMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
                    style={{ color: 'rgb(16, 185, 129)' }}>
                    <Download className="w-4 h-4" strokeWidth={2} />
                    <span>{t.buttons.originalDownload}</span>
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-3 px-4 py-3 text-sm opacity-50 cursor-not-allowed" style={{ color: 'var(--text-tertiary)' }}>
                    <Download className="w-4 h-4" strokeWidth={2} />
                    <span>{t.buttons.unlockOriginal}</span>
                  </div>
                )}
              </div>
              {/* 点击外部关闭菜单 */}
              <div className="fixed inset-0" onClick={() => setShowDownloadMenu(false)} style={{ zIndex: 150 }} />
            </>
          )}
        </div>
      </div>

      {/* 层3：缩略图条（多图时） */}
      {images.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((src, idx) => (
            <div key={idx} onClick={() => setActiveIdx(idx)}
              className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${safeIdx === idx ? 'ring-2 ring-indigo-400 scale-110' : 'ring-1 ring-white/20 opacity-50 hover:opacity-90'}`}>
              <img src={src} className="w-16 h-16 object-cover" />
              <div className={`absolute bottom-0 inset-x-0 py-0.5 text-center text-[10px] font-bold ${safeIdx === idx ? 'bg-indigo-600 text-white' : 'bg-black/60 text-white/60'}`}>
                {safeIdx === idx ? `▶ ${idx+1}` : idx+1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 全屏模式 - Portal 到 body，完全脱离父容器约束（不受导航栏/输入栏/overflow 限制） */}
      {fullscreen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black flex items-center justify-center cursor-zoom-out"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, width: '100vw', height: '100vh', backgroundColor: '#000' }}
          onClick={() => setFullscreen(false)}>
          {/* 图片容器：完全铺满视口 */}
          <div className="relative flex items-center justify-center" style={{ width: '100vw', height: '100vh' }}>
            <img src={watermarkedImages[fsIdx] || images[fsIdx]}
              className="object-contain shadow-2xl select-none"
              style={{ maxWidth: '100vw', maxHeight: '100vh', width: 'auto', height: 'auto', display: 'block' }}
              onClick={e => e.stopPropagation()} />
          </div>
          
          {/* 左右切换按钮 */}
          {images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setFsIdx(p => p > 0 ? p-1 : images.length-1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-all btn-scale shadow-lg backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={e => { e.stopPropagation(); setFsIdx(p => p < images.length-1 ? p+1 : 0); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-all btn-scale shadow-lg backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}
          
          {/* 底部操作栏 */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-5 pt-4 bg-gradient-to-t from-black/80 to-transparent" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl px-6 py-3 shadow-2xl">
              <span className="text-[13px] text-white/70 font-medium tabular-nums min-w-[60px] text-center">{fsIdx+1} / {images.length}</span>
              <div className="w-px h-6 bg-white/15" />
              <button onClick={() => { const a = document.createElement('a'); a.href = watermarkedImages[fsIdx] || images[fsIdx]; a.download = `Creative_STD_${Date.now()}.png`; a.click(); }}
                className="flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-white/[0.08] text-white/80 text-[13px] hover:bg-white/[0.16] hover:text-white transition-all btn-scale font-medium">
                <Download className="w-4 h-4" strokeWidth={2} />下载
              </button>
              <button onClick={() => setFullscreen(false)}
                className="flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-white/[0.08] text-white/80 text-[13px] hover:bg-white/[0.16] hover:text-white transition-all btn-scale font-medium">
                <X className="w-4 h-4" />关闭 (Esc)
              </button>
            </div>
          </div>

          <div className="absolute top-5 right-5 text-white/30 text-[11px] pointer-events-none select-none">按 Esc 退出</div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── Bubble ───────────────────────────────────────────────────────────────────
const Bubble = React.memo(({ msg, onInpaint, onRerun, onUpscale, language = 'zh-CN', isDeveloper = false, theme = 'dark' }: { msg: Message; onInpaint?: (imageUrl: string) => void; onRerun?: (payload: UnifiedPayload) => void; onUpscale?: (imageUrl: string) => void; language?: Language; isDeveloper?: boolean; theme?: string }) => {
  const isUser = msg.role === 'user';
  const [rerunCount, setRerunCount] = useState(1);
  const [aiLogoError, setAiLogoError] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [videoMenuOpen, setVideoMenuOpen] = useState(false);
  const t = getTranslation(language);

  // 获取用户头像
  const getUserAvatar = () => {
    try {
      const avatarUrl = localStorage.getItem('user-architect-avatar-v120-locked');
      return avatarUrl;
    } catch {
      return null;
    }
  };

  const userAvatar = getUserAvatar();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (videoMenuOpen && !target.closest('.video-menu-container')) {
        setVideoMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [videoMenuOpen]);

  return (
    <>
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end mb-4`}>
      {/* avatar */}
      <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center shadow-lg transition-all duration-200 overflow-hidden
        ${isUser
          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 ring-2 ring-indigo-400/30'
          : 'bg-gradient-to-br from-slate-800 to-slate-900 ring-2 ring-white/[0.08]'}`}>
        {isUser ? (
          userAvatar ? (
            <img src={userAvatar} className="w-full h-full object-cover" alt="User" />
          ) : (
            <UserCircle className="w-5 h-5 text-white" strokeWidth={2} />
          )
        ) : (
          aiLogoError ? (
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          ) : (
            <img src="/public/archi01.png" className="w-full h-full object-cover" alt="AI" onError={() => setAiLogoError(true)} />
          )
        )}
      </div>

      {/* bubble */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed transition-all duration-200 card-hover
        ${isUser
          ? 'rounded-tr-sm'
          : 'rounded-tl-sm'}`}
        style={isUser ? {
          background: `linear-gradient(135deg, color-mix(in srgb, var(--theme-primary) 18%, var(--bg-secondary)), var(--bg-secondary))`,
          color: 'var(--text-primary)',
          borderColor: 'var(--border-color)',
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: 'var(--shadow-md)'
        } : {
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-color)',
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: 'var(--shadow-sm)'
        }}>

        {/* thinking */}
        {msg.type === 'thinking' && (
          <div className="flex items-center gap-2.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex gap-1">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ backgroundColor: 'var(--theme-primary)', animationDelay: `${i*0.18}s`, opacity: 0.7 }} />
              ))}
            </span>
            <span className="text-[11px] tracking-wide">{msg.text || t.buttons.thinkingText}</span>
          </div>
        )}

        {/* text with code block support */}
        {(msg.type === 'text' || msg.type === 'error') && msg.text && (
          <div>{renderTextWithCode(msg.text, msg.type === 'error', t.common.copy, theme)}</div>
        )}

{msg.searchImages && msg.searchImages.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {msg.searchImages.slice(0, 4).map((src, i) => (
              <img 
                key={i} 
                src={src} 
                className="max-h-32 max-w-32 rounded-xl object-cover border border-white/10 cursor-pointer hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-200" 
                loading="lazy"
                onClick={() => setFullscreenImg(src)}
                title="点击放大查看"
              />
            ))}
          </div>
        )}

        {msg.type !== 'image' && msg.images && msg.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {msg.images.map((src, i) => (
              <img 
                key={i} 
                src={src} 
                className="max-h-32 max-w-32 rounded-xl object-cover border border-white/10 cursor-pointer hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-200" 
                loading="lazy"
                onClick={() => setFullscreenImg(src)}
                title="点击放大查看"
              />
            ))}
          </div>
        )}

        {/* generated images */}
        {msg.type === 'image' && msg.images && msg.images.length > 0 && (
          <ImageBubble images={msg.images} watermarkedImages={msg.watermarkedImages} seeds={msg.seeds} onInpaint={onInpaint} onRerun={onRerun} onUpscale={onUpscale} rerunPayload={msg.rerunPayload} t={t} rerunCount={rerunCount} setRerunCount={setRerunCount} isDeveloper={isDeveloper} />
        )}

        {/* video */}
        {msg.type === 'video' && msg.videoUrl && (
          <div className="mt-2">
            <VideoPlayer
              videoUrl={msg.videoUrl}
              watermarkedVideoUrl={msg.watermarkedVideoUrl}
              isDeveloper={isDeveloper}
              onRerun={msg.rerunPayload ? () => onRerun?.(msg.rerunPayload) : undefined}
              t={{
                buttons: {
                  stdDownload: t.buttons.stdDownload,
                  originalDownload: t.buttons.originalDownload,
                  unlockOriginal: t.buttons.unlockOriginal,
                  rerender: t.buttons.rerender,
                  pictureInPicture: '画中画',
                  fullscreen: '全屏',
                  normalSpeed: '正常速度',
                  slowSpeed: '慢速',
                  fastSpeed: '快速',
                },
              }}
            />
          </div>
        )}

        {/* 标识内容 */}
        {!isUser && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)] ring-1 ring-blue-400/50" />
              <span className="text-[10px] text-white/30">人工智能KbitAI生成</span>
            </div>
            <span className="text-[10px] text-white/25">
              {new Date(msg.timestamp).toLocaleString('zh', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        {isUser && (
          <p className="text-[10px] opacity-20 mt-1 text-right">
            {new Date(msg.timestamp).toLocaleString('zh', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
    {fullscreenImg && (
      <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center cursor-zoom-out" onClick={() => setFullscreenImg(null)}>
        <img src={fullscreenImg} className="max-h-full max-w-full rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        <button onClick={() => setFullscreenImg(null)} className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>
    )}
    </>
  );
});

// ─── Main ─────────────────────────────────────────────────────────────────────
const ConversationView: React.FC<ConversationViewProps> = ({
  modelConfig, domain, instructions, points, onConsumePoints, pendingVideoMessage, onClearPendingVideo, useThirdPartyGateway, isDeveloperMode,
  showPresetPanel = false, onTogglePresetPanel, language = 'zh-CN', theme = 'dark', userTier = 'free', onModeChange
}) => {
  const t = getTranslation(language);
  // [修复] 基于用户等级判断是否为付费用户（PRO/PLUS 或开发者模式均可）
  const isDeveloper = userTier === 'pro' || userTier === 'plus' || isDeveloperMode;
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<ConversationMode>('chat');
  const handleModeChange = (m: ConversationMode) => {
    setMode(m);
    if (m === 'video') onModeChange?.(m);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [inpaintImage, setInpaintImage] = useState<string | null>(null);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [expandedPresetGroup, setExpandedPresetGroup] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [upscaleDialog, setUpscaleDialog] = useState<{ show: boolean; imageUrl: string | null }>({ show: false, imageUrl: null });
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatHistoryRef = useRef<any[]>([]);
  const inputRef = useRef<{ setText: (text: string) => void }>(null);

  const domainStyles = MASTER_STYLES.filter(s => s.domain === domain);
  const domainPresets = t.presets[domain] || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (msg: Omit<Message, 'id' | 'timestamp'>) =>
    setMessages(prev => [...prev, { ...msg, id: uid(), timestamp: Date.now() }]);

  // ── 视频回写：工作台生成完成后自动写入聊天气泡 ──
  useEffect(() => {
    if (!pendingVideoMessage?.url) return;
    // 追加一条"系统消息"标记的视频结果
    addMsg({
      role: 'assistant',
      type: 'video',
      videoUrl: pendingVideoMessage.url,
      text: `🎬 已在动态漫游导演中生成视频\n${pendingVideoMessage.prompt ? `> ${pendingVideoMessage.prompt.slice(0, 120)}${pendingVideoMessage.prompt.length > 120 ? '...' : ''}` : ''}`
    });
    onClearPendingVideo?.();
  }, [pendingVideoMessage]);

  const updateLast = (patch: Partial<Message>) =>
    setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, ...patch } : m));

  const handleSubmit = async (payload: UnifiedPayload) => {
    if (isLoading) return;

    // ── 自动模式推断 ──────────────────────────────────────────────────────────
    const txt = payload.text.toLowerCase();
    const videoKeywords = ['视频', '动画', '动态', 'video', 'animate', 'animation', 'motion', '生成视频', '制作视频', 'make video', 'create video', 'generate video'];
    const imageKeywords = ['生成图', '渲染', '画', '设计', '效果图', '图片', '图像', 'render', 'generate image', 'draw', 'design', 'visualize', 'image of', 'picture of', 'photo of', 'illustration'];
    let inferredMode: ConversationMode = payload.mode;
    if (videoKeywords.some(k => txt.includes(k))) {
      inferredMode = 'video';
    } else if (payload.mode !== 'chat' && payload.mode !== 'video' && (imageKeywords.some(k => txt.includes(k)) || payload.images.length > 0)) {
      inferredMode = 'architect';
    } else if (payload.mode === 'chat') {
      inferredMode = 'chat';
    }
    if (inferredMode !== mode) handleModeChange(inferredMode);
    const effectivePayload = { ...payload, mode: inferredMode };
    // 如果选择了大师风格或预设标签，将其添加到提示词中
    let finalText = payload.text;
    if (effectivePayload.mode === 'architect') {
      const additions: string[] = [];
      if (selectedStyle) {
        const styleObj = MASTER_STYLES.find(s => s.name === selectedStyle);
        if (styleObj) additions.push(`Style: ${styleObj.name} - ${styleObj.logic}`);
      }
      if (selectedPresets.length > 0) {
        additions.push(`Presets: ${selectedPresets.join(', ')}`);
      }
      if (additions.length > 0) {
        finalText = `${payload.text}\n\n${additions.join('\n')}`;
      }
    }

    // add user bubble (show when: not silent OR no images OR has images to display)
    const hasImages = payload.images && payload.images.length > 0;
    if (!payload.silent || payload.silent === undefined || hasImages) {
      const userImages = hasImages ? payload.images.map(f => f.data) : undefined;
      addMsg({ role: 'user', type: 'text', text: payload.text || '', images: userImages });
    }

    setIsLoading(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // thinking bubble
    addMsg({ role: 'assistant', type: 'thinking', text: t.buttons.thinkingText });

    try {
      const m = effectivePayload.mode;

      // ── CHAT ──────────────────────────────────────────────────────────────
        if (m === 'chat') {
          const files = payload.images.map(f => {
            let mimeType = f.type || f.mimeType || '';
            if (!mimeType || mimeType === 'image/' || mimeType.length <= 6) {
              const dataUrlMatch = f.data.match(/^data:([^;]+);/);
              if (dataUrlMatch) {
                mimeType = dataUrlMatch[1];
              } else {
                mimeType = 'image/png';
              }
            }
            return { name: f.name, type: mimeType, mimeType: mimeType, data: f.data };
          });

          // 检测是否需要图像分析和搜索
          const txt = payload.text.toLowerCase();
          const needsImageAnalysis = payload.images.length > 0 && (
            txt.includes('分析') || txt.includes('解析') || txt.includes('识别') ||
            txt.includes('analyze') || txt.includes('analy') || txt.includes('identify') ||
            txt.includes('search') || txt.includes('搜索') || txt.includes('similar') ||
            txt.includes('相关') || txt.includes('案例') || txt.includes('cases')
          );

          // 执行联网搜索
          let searchContext = '';
          let searchImages: string[] = [];
          
          if (payload.images.length > 0) {
            try {
              updateLast({ type: 'thinking', text: '正在分析图像并搜索相似图片...' });
              console.log('[Search] Calling similar image search API...');
              const analysisResponse = await fetch('/api/search/similar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  image: payload.images[0]?.data,
                  max_results: 8
                }),
                signal
              });
              const analysisData = await analysisResponse.json();
              console.log('[Search] Similar image search response:', analysisData);
              if (analysisData.success && analysisData.data) {
                searchImages = analysisData.data.images || [];
                console.log('[Search] Found similar images:', searchImages.length);
              } else {
                console.log('[Search] Similar image search failed:', analysisData.error);
              }
            } catch (analysisErr) {
              console.error('[Image Analysis] 图像分析失败:', analysisErr);
            }
          } else if (payload.useSearch) {
            try {
              updateLast({ type: 'thinking', text: '正在联网搜索...' });
              const searchResponse = await fetch('/api/search/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: payload.text, force: true }),
                signal
              });
              const searchData = await searchResponse.json();
              if (searchData.success && searchData.searched) {
                if (searchData.context) {
                  searchContext = searchData.context;
                }
                if (searchData.images && Array.isArray(searchData.images)) {
                  searchImages = searchData.images;
                }
              }
            } catch (searchErr) {
              console.error('[Search] 联网搜索失败:', searchErr);
            }
          }

          // 构建最终提示词（包含搜索上下文）
          let enhancedText = finalText;
          if (searchContext) {
            enhancedText = `${searchContext}\n\n${enhancedText}`;
          }
          
          const res = await gemini.chat(enhancedText, chatHistoryRef.current, 'FAST', files, instructions, modelConfig, signal);
          const text = res?.text || '';
          updateLast({ type: 'text', text, searchImages });
        
        // 构建包含图片的用户消息
        const userParts: any[] = [{ text: finalText }];
        for (const f of files) {
          if (f.data && f.mimeType) {
            userParts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
          }
        }
        
        chatHistoryRef.current = [...chatHistoryRef.current,
          { role: 'user', parts: userParts },
          { role: 'model', parts: [{ text }] }
        ];

        // 获取 PH8 真实费用并扣除积分
        setTimeout(() => deductPh8Cost('Chat', onConsumePoints), 500);
      }

      // ── IMAGE ─────────────────────────────────────────────────────────────
      else if (m === 'architect') {
        updateLast({ type: 'thinking', text: t.buttons.generatingImage });
        
        // 分离供体和受体图像
        const donorImages = payload.images.filter((f: any) => f.role === 'donor');
        const recipientImages = payload.images.filter((f: any) => f.role === 'recipient');
        const normalImages = payload.images.filter((f: any) => !f.role);
        
        // 构建底图列表：受体优先，其次是普通图像
        const baseRefs = [...recipientImages, ...normalImages].map(f => f.data);
        const donorRefs = donorImages.length > 0 ? donorImages.map(f => f.data) : undefined;
        
        // 获取遮罩信息
        const maskA = donorImages[0]?.maskDataUrl;
        const maskB = recipientImages[0]?.maskDataUrl;
        
        const config = payload.imageConfig || { aspectRatio: '1:1', imageSize: '1K', modelTier: 'FAST', imageCount: 1 };
        const forcedSeed = (payload as any).lockedSeed || config.seed || undefined;
        
        console.log(`[Donor/Recipient] 供体: ${donorImages.length}张, 受体: ${recipientImages.length}张, 普通: ${normalImages.length}张`);
        
        const imgResult: any = await gemini.generateImage(
          finalText,
          {
            aspectRatio: config.aspectRatio,
            imageSize: config.imageSize,
            modelTier: config.modelTier,
            imageCount: config.imageCount,
            temperature: 1.0,
            top_p: 0.95,
            seed: forcedSeed
          },
          false, baseRefs, [], [], [], maskB, finalText, maskA,
          instructions, modelConfig, signal, domain, undefined, undefined,
          donorRefs
        );
        // 防御性解构：兼容旧版(返回数组)和新版({images, seeds})两种格式
        let imgList: string[];
        let seedList: number[];
        if (Array.isArray(imgResult)) {
          imgList = imgResult;
          seedList = [];
        } else if (imgResult && typeof imgResult === 'object') {
          imgList = Array.isArray(imgResult.images) ? imgResult.images : [];
          seedList = Array.isArray(imgResult.seeds) ? imgResult.seeds : [];
        } else {
          imgList = [];
          seedList = [];
        }
        const wmList1: string[] = [];
        for (const url of imgList) {
          try { wmList1.push((await WatermarkUtils.addWatermark(url)).dataUrl); }
          catch { wmList1.push(url); }
        }
        updateLast({ type: 'image', images: imgList, watermarkedImages: wmList1, seeds: seedList, text: undefined, rerunPayload: payload });

        // 获取 PH8 真实费用并扣除积分
        setTimeout(() => deductPh8Cost('Image', onConsumePoints), 500);
      }

      // ── VIDEO ─────────────────────────────────────────────────────────────
      else if (m === 'video') {
        updateLast({ type: 'thinking', text: t.buttons.generatingVideo });
        const assets = payload.images.map(f => f.data);
        const res: any = await gemini.generateVideo(finalText, assets, '16:9', instructions, signal);
        if (res?.url) {
          // 立即显示原始视频
          updateLast({ type: 'video', videoUrl: res.url, text: undefined, rerunPayload: payload });
          
          // 异步生成水印版本供普通下载使用
          setTimeout(async () => {
            try {
              const { VideoWatermarkUtils } = await import('../services/videoWatermarkService');
              const watermarkResult = await VideoWatermarkUtils.addWatermark(res.url);
              // 更新消息对象，添加水印视频URL
              updateLast({ watermarkedVideoUrl: watermarkResult.objectUrl });
            } catch (error) {
              console.error('视频水印生成失败:', error);
            }
          }, 500);
        }
        else updateLast({ type: 'error', text: t.buttons.videoGenerationFailed });

        // 获取 PH8 真实费用并扣除积分
        setTimeout(() => deductPh8Cost('Video', onConsumePoints), 500);
      }

    } catch (err: any) {
      if (err?.name !== 'AbortError') updateLast({ type: 'error', text: err?.message || t.common.error });
      else updateLast({ type: 'error', text: t.buttons.cancelled });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpscaleDirect = (size: '2K' | '4K' | null, uploadedImageUrl?: string) => {
    let imageUrl = uploadedImageUrl;
    if (!imageUrl) {
      const lastImageMsg = [...messages].reverse().find(m => m.type === 'image' && m.images && m.images.length > 0);
      imageUrl = lastImageMsg?.images?.[0];
    }
    if (!imageUrl) { alert('没有可放大的图片，请先上传底图或生成图片'); return; }
    if (size === null) {
      // 弹出选择弹窗
      setUpscaleDialog({ show: true, imageUrl });
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      const max = Math.max(img.naturalWidth, img.naturalHeight);
      if (size === '2K' && max >= 2048) { alert('当前图片已达 2K 或以上，请使用 4K 放大'); return; }
      if (size === '4K' && max >= 4096) { alert('当前图片已是 4K 分辨率，无需放大'); return; }
      setUpscaleDialog({ show: false, imageUrl });
      executeUpscale(size, imageUrl);
    };
    img.src = imageUrl;
  };

  const handleUpscale = (imageUrl: string) => {
    setUpscaleDialog({ show: true, imageUrl });
  };

  const executeUpscale = async (targetSize: '2K' | '4K', overrideUrl?: string) => {
    const imageUrl = overrideUrl ?? upscaleDialog.imageUrl;
    if (!imageUrl) return;
    if (!overrideUrl) setUpscaleDialog({ show: false, imageUrl: null });
    const maxPx = targetSize === '4K' ? 4096 : 2048;

    addMsg({ role: 'assistant', type: 'thinking', text: t.parameters.upscaling.replace('{size}', targetSize) });

    try {
      const imgInfo = await new Promise<{w:number,h:number}>((res, rej) => {
        const img = new window.Image(); img.onload = () => res({w:img.naturalWidth,h:img.naturalHeight}); img.onerror = rej; img.src = imageUrl;
      });
      if (Math.max(imgInfo.w, imgInfo.h) >= maxPx) {
        updateLast({ type: 'error', text: `当前图片已达 ${targetSize} 分辨率，无需放大` });
        return;
      }
      const ratio = `${imgInfo.w}:${imgInfo.h}`;
      const imgResult: any = await gemini.generateImage(
        '[HIFI-EVOLUTION]: Enhance texture and clarity while maintaining 100% structural fidelity.',
        { aspectRatio: ratio, imageSize: targetSize as any, modelTier: 'FAST', imageCount: 1, temperature: 1.0, top_p: 0.95 },
        false, [imageUrl], [], [], [], undefined, undefined, undefined,
        instructions, modelConfig, undefined, domain, undefined, true
      );
      const imgList = Array.isArray(imgResult) ? imgResult : (imgResult?.images || []);
      const seedListUpscale = Array.isArray(imgResult) ? [] : (imgResult?.seeds || []);
      const wmList: string[] = [];
      for (const url of imgList) {
        try { wmList.push((await WatermarkUtils.addWatermark(url)).dataUrl); } catch { wmList.push(url); }
      }
      updateLast({ type: 'image', images: imgList, watermarkedImages: wmList, seeds: seedListUpscale, text: undefined, rerunPayload: {
        text: '[HIFI-EVOLUTION]: Enhance texture and clarity while maintaining 100% structural fidelity.',
        images: [{ name: 'upscaled.png', type: 'image/png', data: imgList[0], fileCategory: 'image' }],
        mode: 'architect',
        imageConfig: { aspectRatio: ratio, imageSize: targetSize as any, modelTier: 'FAST', model: 'gemini-3.1-flash-image-preview', imageCount: 1 }
      } });
    } catch (err: any) {
      updateLast({ type: 'error', text: `${t.parameters.upscaleFailed}: ${err?.message}` });
    }
  };

  const handleInpaintSubmit = async (maskDataUrl: string, prompt: string) => {
    if (!inpaintImage) return;
    setInpaintImage(null);
    setIsLoading(true);

    // add user bubble
    addMsg({ role: 'user', type: 'text', text: `${t.buttons.inpaint}: ${prompt}`, images: [inpaintImage] });
    addMsg({ role: 'assistant', type: 'thinking', text: t.buttons.inpainting });

    try {
      const imgResult2: any = await gemini.generateImage(
        prompt,
        { aspectRatio: '1:1', imageSize: '1K', modelTier: 'FAST', imageCount: 1, temperature: 1.0, top_p: 0.95 },
        false, [inpaintImage], [], [], [], maskDataUrl, prompt, undefined,
        instructions, modelConfig, abortRef.current?.signal, domain
      );
      const imgList2 = Array.isArray(imgResult2) ? imgResult2 : (imgResult2?.images || []);
      const seedListInpaint = Array.isArray(imgResult2) ? [] : (imgResult2?.seeds || []);
      const wmList2: string[] = [];
      for (const url of imgList2) {
        try { wmList2.push((await WatermarkUtils.addWatermark(url)).dataUrl); }
        catch { wmList2.push(url); }
      }
      updateLast({ type: 'image', images: imgList2, watermarkedImages: wmList2, seeds: seedListInpaint, text: undefined });

      // 获取 PH8 真实费用并扣除积分
      setTimeout(() => deductPh8Cost('Inpaint', onConsumePoints), 500);
    } catch (err: any) {
      if (err?.name !== 'AbortError') updateLast({ type: 'error', text: err?.message || 'Inpaint 失败' });
      else updateLast({ type: 'error', text: '已取消' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen transition-colors duration-300" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* ── messages ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-8 text-center select-none px-4 relative">
            {/* 背景光晕 - 暗/亮模式优雅退晕渐变 */}
            <div 
              className="absolute inset-0 pointer-events-none" 
              style={{
                background: theme === 'dark'
                  ? `
                    radial-gradient(ellipse 100% 80% at 50% 40%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
                    radial-gradient(ellipse 80% 60% at 50% 60%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)
                  `
                  : `
                    radial-gradient(ellipse 120% 100% at 50% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 70%),
                    radial-gradient(ellipse 100% 80% at 50% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 60%)
                  `
              }} 
            />
            {/* logo */}
            <div className="relative">
              <div 
                className="absolute inset-0 scale-[2]"
                style={{
                  background: theme === 'dark'
                    ? 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0.08) 30%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.06) 30%, transparent 70%)'
                }}
              />
              <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-2xl shadow-indigo-500/30 ring-1 ring-white/10">
                <img src="/public/archi01.png" className="w-full h-full object-cover" alt="Kbit" />
              </div>
            </div>
            {/* 文字 */}
            <div className="space-y-2 relative">
              <p className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t.main.welcome}</p>
              <p className="text-[13px] max-w-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t.main.welcomeMessage}</p>
            </div>
            {/* 模式按钮 */}
            <div className="flex gap-2 flex-wrap justify-center relative">
              {[
                { icon: 'chat',      text: t.tabs.chat,      mode: 'chat'      as ConversationMode },
                { icon: 'architect', text: t.tabs.imageGen,  mode: 'architect' as ConversationMode },
                { icon: 'video',     text: t.tabs.video,     mode: 'video'     as ConversationMode },
              ].map(s => {
                const Icon = MODE_ICONS[s.icon as ConversationMode];
                return (
                  <button key={s.mode} onClick={() => handleModeChange(s.mode)}
                    className="flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl border text-[13px] font-medium transition-all duration-200 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    <Icon className="w-4 h-4" />
                    <span>{s.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 200px' }}>
              <Bubble msg={msg} onInpaint={msg.type === 'image' ? setInpaintImage : undefined} onRerun={msg.type === 'image' ? handleSubmit : undefined} onUpscale={handleUpscale} language={language} isDeveloper={isDeveloper} theme={theme} />
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* ── Inpaint Editor ── */}
      {inpaintImage && (
        <InpaintEditor
          imageUrl={inpaintImage}
          onSaveMask={() => {}}
          onSubmit={handleInpaintSubmit}
          onClose={() => setInpaintImage(null)}
          language={language}
        />
      )}

      {/* ── stop button ── */}
      {isLoading && (
        <div className="flex justify-center pb-3">
          <button onClick={() => abortRef.current?.abort()}
            className="flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-300 text-[13px] font-medium hover:bg-white dark:hover:bg-slate-700 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-500/40 shadow-lg">
            <StopCircle className="w-4 h-4 text-rose-500" strokeWidth={2} />
            {t.buttons.stopGenerate}
          </button>
        </div>
      )}

      {/* ── unified input ── */}
      <div className="shrink-0 border-t backdrop-blur-xl py-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        {/* 选中的风格和预设标签 */}
        {mode === 'architect' && (selectedStyle || selectedPresets.length > 0) && (
          <div className="max-w-5xl mx-auto px-4 mb-3">
            <div className="flex flex-wrap gap-2">
              {selectedStyle && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[11px] font-medium">
                  <Palette className="w-3 h-3" strokeWidth={2} />
                  <span>{selectedStyle.split(' ')[0]}</span>
                  <button onClick={() => setSelectedStyle('')}
                    className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white/20 transition-all">
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              )}
              {selectedPresets.map(preset => (
                <div key={preset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 text-[11px] font-medium">
                  <span>{preset}</span>
                  <button onClick={() => setSelectedPresets(prev => prev.filter(p => p !== preset))}
                    className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white/20 transition-all">
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <UnifiedInput ref={inputRef} mode={mode} onModeChange={handleModeChange} onSubmit={handleSubmit} isLoading={isLoading} language={language} onUpscale={handleUpscaleDirect} />
      </div>

      {/* ── 预设风格面板（双击领域按钮触发） ── */}
      {showPresetPanel && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
          onClick={e => { if (e.target === e.currentTarget) onTogglePresetPanel?.(); }}>
          <div className="w-full max-w-3xl bg-[#111111] border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto max-h-[80vh] custom-scrollbar">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] sticky top-0 bg-[#111111]">
              <p className="text-base font-semibold text-white/90">{t.presets.title}</p>
              <button onClick={onTogglePresetPanel}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* masterStyles */}
              <div>
                <p className="text-[11px] font-medium uppercase text-white/30 tracking-widest mb-3">{t.presets.masterStyles}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {domainStyles.map(style => (
                    <button key={style.name}
                      onClick={() => {
                        inputRef.current?.appendText(style.logic);
                        onTogglePresetPanel?.();
                      }}
                      className="min-h-[44px] px-3 py-2 rounded-xl text-left text-[12px] transition-all duration-150 active:scale-95 cursor-pointer bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70 hover:border-blue-500/30"
                      title="单击插入到输入框">
                      <div className="font-medium truncate">{language === 'zh-CN' ? style.name.split(' ')[0] : style.name.split(' ').slice(1).join(' ').split('(')[0].trim()}</div>
                      <div className="text-[10px] opacity-50 truncate">{language === 'zh-CN' ? style.name.split(' ').slice(1).join(' ') : style.name.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 预设标签 */}
              {domainPresets.map(category => (
                <div key={category.label}>
                  <p className="text-[11px] font-medium uppercase text-white/30 tracking-widest mb-3">{category.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {category.tags.map(tag => (
                      <button key={tag}
                        onClick={() => {
                          inputRef.current?.appendText(tag);
                          onTogglePresetPanel?.();
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 active:scale-95 cursor-pointer bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-white/[0.06] hover:text-white/70 hover:border-blue-500/30"
                        title="单击插入到输入框">
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 高清放大弹窗 */}
      {upscaleDialog.show && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-white/80 mb-4">选择放大分辨率</h3>
            <div className="flex gap-3 mb-4">
              <button onClick={() => executeUpscale('2K')}
                className="flex-1 py-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08] transition-all">
                <div className="text-lg font-semibold">2K</div>
                <div className="text-xs text-white/30 mt-1">2048px</div>
              </button>
              <button onClick={() => executeUpscale('4K')}
                className="flex-1 py-4 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-white hover:bg-indigo-500/30 transition-all relative">
                <div className="text-lg font-semibold">4K</div>
                <div className="text-xs text-white/50 mt-1">4096px</div>
                <span className="absolute -top-2 -right-2 bg-amber-400 text-black text-[8px] font-bold px-2 py-0.5 rounded-full">推荐</span>
              </button>
            </div>
            <button onClick={() => setUpscaleDialog({ show: false, imageUrl: null })}
              className="w-full py-2 bg-white/[0.04] border border-white/[0.06] text-white/40 rounded-xl text-sm hover:text-white/70 transition-all">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationView;
