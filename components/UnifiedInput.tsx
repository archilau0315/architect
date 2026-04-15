import React, { useState, useRef, useEffect } from 'react';
import { ConversationMode } from '../types.ts';
import InpaintEditor from './InpaintEditor.tsx';
import { getTranslation } from '../i18n/locales.ts';
import type { Language } from '../i18n/locales.ts';

export interface UnifiedInputProps {
  mode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;
  onSubmit: (payload: UnifiedPayload) => void;
  isLoading?: boolean;
  placeholder?: string;
  language?: Language;
  onUpscale?: (size: '2K' | '4K' | null, imageUrl?: string) => void;
}

export interface ImageItem {
  name: string;
  type: string;
  data: string;
  maskDataUrl?: string;
  role?: 'donor' | 'recipient';
  detectedRatio?: string;
  fileCategory?: 'image' | 'pdf' | 'ppt' | 'text'; // 文件分类
}

export interface UnifiedPayload {
  text: string;
  images: ImageItem[];
  mode: ConversationMode;
  silent?: boolean;
  imageConfig?: {
    aspectRatio: string;
    imageSize: '1K' | '2K' | '4K';
    modelTier: 'FAST' | 'QUALITY';
    model: string;
    imageCount: number;
    lockRatio?: string | null;
    temperature?: number;
    top_p?: number;
    seed?: number | null;
  };
  videoConfig?: {
    model: string;
    aspectRatio: string;
    cameraMotion: string;
    duration: string;
  };
}

const MODE_ICONS: Record<ConversationMode, React.FC> = {
  chat:      () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  architect: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  video:     () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
};

interface UnifiedInputRef {
  setText: (text: string) => void;
  appendText: (text: string) => void;
}

const UnifiedInput = React.forwardRef<UnifiedInputRef, UnifiedInputProps>(({ mode, onModeChange, onSubmit, isLoading = false, placeholder, language = 'zh-CN', onUpscale }, ref) => {
  const t = getTranslation(language);

  // 动态翻译模式配置
  const MODE_CONFIG: Record<ConversationMode, { label: string; color: string; placeholder: string }> = {
    chat:      { label: t.tabs.chat,     color: 'indigo', placeholder: language === 'zh-CN' ? '和 AI 聊聊你的想法…' : 'Chat with AI...' },
    architect: { label: t.tabs.imageGen, color: 'violet', placeholder: language === 'zh-CN' ? '描述你想生成的创意图像…' : 'Describe the image you want to generate...' },
    video:     { label: t.tabs.video,    color: 'rose',   placeholder: language === 'zh-CN' ? '描述你想生成的视频场景…' : 'Describe the video scene...' },
  };

  const [text, setText] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [showModeMenu, setShowModeMenu] = useState(false);

  // 图像生成参数
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [customRatio, setCustomRatio] = useState('');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [modelTier, setModelTier] = useState<'FAST' | 'QUALITY'>('FAST');
  const [imageCount, setImageCount] = useState(1);
  const [lockRatio, setLockRatio] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(1.0);
  const [topP, setTopP] = useState(0.95);
  const [seed, setSeed] = useState<number | null>(null);
  const [seedLocked, setSeedLocked] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inpaintIdx, setInpaintIdx] = useState<number | null>(null);

  // 视频生成参数
  const VIDEO_MODELS = [
    { id: 'KbitVeo-speed',  label: 'Speed-SD1',  ratios: ['16:9'],                   duration: '5-15s' },
    { id: 'KbitVeo-normal', label: 'Normal-SD1.5', ratios: ['16:9', '9:16'],            duration: '5-30s' },
    { id: 'KbitVeo-pro',    label: 'Pro-SD2',    ratios: ['16:9', '9:16', '21:9'],    duration: '5-45s' },
  ];
  const [videoModel, setVideoModel] = useState('KbitVeo-speed');
  const [videoRatio, setVideoRatio] = useState('16:9');
  const currentVideoModel = VIDEO_MODELS.find(m => m.id === videoModel) || VIDEO_MODELS[0];

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cfg = MODE_CONFIG[mode];

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [text]);

  // expose setText and appendText methods via ref
  useEffect(() => {
    if (ref) {
      (ref as React.MutableRefObject<UnifiedInputRef | null>).current = {
        setText: setText,
        appendText: (textToAppend: string) => {
          setText(prev => {
            const separator = prev.trim() ? ', ' : '';
            return prev + separator + textToAppend;
          });
        }
      };
    }
  }, [ref]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 4).forEach((file, idx) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const isPpt = file.type === 'application/vnd.ms-powerpoint' || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.name.match(/\.pptx?$/i);
      const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|csv)$/i);
      if (!isImage && !isPdf && !isPpt && !isText) return;

      const r = new FileReader();
      r.onloadend = () => {
        const dataUrl = r.result as string;
        const item: ImageItem = {
          name: file.name,
          type: file.type || (isText ? 'text/plain' : 'application/octet-stream'),
          data: dataUrl,
          fileCategory: isImage ? 'image' : isPdf ? 'pdf' : isPpt ? 'ppt' : 'text'
        };
        setImages(prev => [...prev, item]);

        if (isImage) {
          const img = new Image();
          img.onload = () => {
            const g = (a: number, b: number): number => b === 0 ? a : g(b, a % b);
            const d = g(img.width, img.height);
            const ratio = `${img.width / d}:${img.height / d}`;
            setImages(prev => {
              const targetIdx = prev.findIndex(it => it.data === dataUrl);
              if (targetIdx === -1) return prev;
              const updated = prev.map((it, i) => i === targetIdx ? { ...it, detectedRatio: ratio } : it);
              if (idx === 0) {
                setAspectRatio(ratio);
                setLockRatio(String(targetIdx));
              }
              return updated;
            });
          };
          img.src = dataUrl;
        }
      };
      r.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const effectiveRatio = lockRatio
    ? (images[parseInt(lockRatio)]?.detectedRatio || aspectRatio)
    : (aspectRatio === 'custom' ? (customRatio || '1:1') : aspectRatio);

  // 快捷动作：解析图片 / 反推提示词 / JSON提示词
  const handleQuickAction = (action: 'analyze' | 'reverse' | 'reverse_json') => {
    if (isLoading || images.filter(i => i.fileCategory === 'image').length === 0) return;
    const prompts = {
      analyze: '请详细分析这张图片，从构图、光影、色彩、材质、风格等维度进行专业解读。',
      reverse: '请根据这张图片反推生成其创意提示词，输出中文描述、英文提示词、风格特征、关键视觉元素和技术参数（光线、构图、情绪氛围）。',
      reverse_json: '分析这张图片，直接输出一个JSON对象，不要有任何其他文字。JSON结构：{"subject":{"category":"","features":"","action":""},"details":{"color":"","texture":"","material":""},"environment":{"scene":"","time":"","weather":""},"lighting":{"quality":"","effect":"","tone":""},"style":{"genre":"","medium":"","reference":""},"composition":{"angle":"","shot":"","rule":""},"parameters":{"aspect_ratio":"","quality":"","detail":""},"prompt_en":"","prompt_zh":""}'
    };
    onSubmit({ text: prompts[action], images, mode: 'chat', silent: true });
    setText('');
    setImages([]);
  };

  const handleSubmit = () => {
    if ((!text.trim() && images.length === 0) || isLoading) return;
    const payload: UnifiedPayload = {
      text: text.trim(),
      images,
      mode,
      imageConfig: mode === 'architect' ? {
        aspectRatio: effectiveRatio,
        imageSize, modelTier,
        model: (imageSize === '4K' && modelTier === 'QUALITY') ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image-preview',
        imageCount, lockRatio,
        temperature, top_p: topP,
        seed: seedLocked ? seed : null
      } : undefined,
      videoConfig: mode === 'video' ? {
        model: videoModel,
        aspectRatio: videoRatio,
        cameraMotion: '', // 用户在提示词中自己输入
        duration: currentVideoModel.duration
      } : undefined
    };
    onSubmit(payload);
    setText('');
    setImages([]);
    if (!seedLocked) setSeed(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const activeColor = 'text-blue-400 border-blue-500/30 bg-blue-500/10';

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div
        className="relative rounded-2xl border shadow-xl transition-all duration-200 focus-within:border-white/20"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        {/* image previews + file attachments */}
        {images.length > 0 && (
          <div className="flex gap-2 px-4 pt-3 flex-wrap items-center">
            {images.map((img, i) => (
              img.fileCategory !== 'image' ? (
                // 非图片文件：显示为 chip
                <div key={i} className="relative group flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] min-w-0 max-w-[160px]">
                  <svg className={`w-4 h-4 shrink-0 ${img.fileCategory === 'pdf' ? 'text-red-400' : img.fileCategory === 'ppt' ? 'text-orange-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {img.fileCategory === 'pdf'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      : img.fileCategory === 'ppt'
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    }
                  </svg>
                  <span className="text-[11px] text-white/60 truncate">{img.name}</span>
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 text-[12px] transition-all">×</button>
                </div>
              ) : (
                // 图片：原有预览
                <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-white/10 shadow-sm">
                  <img src={img.data} className="w-full h-full object-cover" />
                  {img.role && (
                    <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${img.role === 'donor' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                      {img.role === 'donor' ? '供' : '受'}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center gap-1.5">
                    {/* 局部编辑 */}
                    <button onClick={() => setInpaintIdx(i)}
                      className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-all" title="局部编辑">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {/* 比例锁（所有图都显示，互斥） */}
                    <button onClick={() => {
                      const key = String(i);
                      if (lockRatio === key) { setLockRatio(null); }
                      else { if (img.detectedRatio) setAspectRatio(img.detectedRatio); setLockRatio(key); }
                    }}
                      title={`锁定此图比例${img.detectedRatio ? ' (' + img.detectedRatio + ')' : ''}`}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[13px] transition-all ${lockRatio === String(i) ? 'bg-blue-500/20 text-blue-400' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                      {lockRatio === String(i)
                        ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                        : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                      }
                    </button>
                    {/* 删除 */}
                    <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center hover:bg-rose-500/60 transition-all text-white text-lg font-light" title="删除">×</button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* 快捷动作：仅在 chat 模式且有图片时显示 */}
        {mode === 'chat' && images.some(img => img.fileCategory === 'image') && (
          <div className="flex items-center gap-2 px-4 pt-2 pb-1 flex-wrap">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">{language === 'zh-CN' ? '快捷操作:' : 'Quick Actions:'}</span>
            {[
              { action: 'analyze' as const,       label: language === 'zh-CN' ? '解析图片' : 'Analyze',   icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg> },
              { action: 'reverse' as const,        label: language === 'zh-CN' ? '反推提示词' : 'Reverse Prompt', icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg> },
              { action: 'reverse_json' as const,   label: language === 'zh-CN' ? 'JSON提示词' : 'JSON Prompt', icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg> },
            ].map(({ action, label, icon }) => (
              <button key={action} onClick={() => handleQuickAction(action)} disabled={isLoading}
                className="flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/40 text-[11px] font-medium hover:bg-indigo-500/15 hover:border-indigo-500/30 hover:text-indigo-300 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="flex items-center justify-center">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        {/* 图像生成参数（仅渲染模式） */}
        {mode === 'architect' && (
          <div className="px-4 pt-2.5 pb-2 border-b border-white/[0.06]">
            <div className="flex flex-wrap items-center gap-2">
              {/* 比例 */}
              <select
                value={lockRatio !== null ? 'custom' : aspectRatio}
                onChange={e => { setLockRatio(null); setAspectRatio(e.target.value); }}
                className="h-8 px-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white/70 text-[12px] cursor-pointer focus:outline-none focus:border-white/20 hover:border-white/20 transition-colors">
                <option value="1:1" className="bg-[#1a1a1a]">1:1</option>
                <option value="3:4" className="bg-[#1a1a1a]">3:4</option>
                <option value="4:3" className="bg-[#1a1a1a]">4:3</option>
                <option value="16:9" className="bg-[#1a1a1a]">16:9</option>
                <option value="custom" className="bg-[#1a1a1a]">{lockRatio !== null ? `${t.parameters.custom} (${effectiveRatio})` : t.parameters.custom}</option>
              </select>
              {(aspectRatio === 'custom' && lockRatio === null) && (
                <input value={customRatio} onChange={e => setCustomRatio(e.target.value)}
                  placeholder="w:h"
                  className="h-8 w-16 px-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white/70 text-[12px] focus:outline-none focus:border-white/20" />
              )}

              {/* 尺寸 */}
              <select value={imageSize} onChange={e => setImageSize(e.target.value as any)}
                className="h-8 px-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white/70 text-[12px] cursor-pointer focus:outline-none focus:border-white/20 hover:border-white/20 transition-colors">
                <option value="1K" className="bg-[#1a1a1a]">1K</option>
                <option value="2K" className="bg-[#1a1a1a]">2K</option>
                <option value="4K" className="bg-[#1a1a1a]">4K</option>
              </select>

              {/* 质量 */}
              <select value={modelTier} onChange={e => setModelTier(e.target.value as any)}
                className="h-8 px-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white/70 text-[12px] cursor-pointer focus:outline-none focus:border-white/20 hover:border-white/20 transition-colors">
                <option value="FAST" className="bg-[#1a1a1a]">{t.parameters.fast}</option>
                <option value="QUALITY" className="bg-[#1a1a1a]">{t.parameters.highQuality}</option>
              </select>

              {/* 数量 */}
              <select value={imageCount} onChange={e => setImageCount(Number(e.target.value))}
                className="h-8 px-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white/70 text-[12px] focus:outline-none focus:border-white/20 hover:border-white/20 transition-colors cursor-pointer">
                {[1,2,3,4].map(n => <option key={n} value={n} className="bg-[#1a1a1a]">×{n}</option>)}
              </select>

              {/* 高清放大 */}
              {onUpscale && (
                <button onClick={() => onUpscale(null, images.find(i => i.fileCategory === 'image')?.data)} disabled={isLoading}
                  aria-label="高清放大"
                  className="h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 text-[12px] hover:bg-white/[0.08] hover:text-white/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0m4 0h-4m2 2v-4" /></svg>HD
                </button>
              )}

              {/* 高级参数展开 */}
              <button onClick={() => setShowAdvanced(p => !p)}
                className="h-8 px-2 rounded-lg text-[11px] text-white/25 hover:text-white/50 hover:bg-white/[0.04] transition-all flex items-center gap-1">
                <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                {t.parameters.advanced}
              </button>
            </div>

            {/* 高级参数 */}
            {showAdvanced && (
              <div className="flex flex-wrap items-center gap-4 pt-2 mt-2 border-t border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30">{t.parameters.temperature}</span>
                  <input type="range" min="0" max="2" step="0.05" value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-20 h-1.5 accent-theme" />
                  <span className="text-[11px] font-mono text-white/40 w-8">{temperature.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30">{t.parameters.topP}</span>
                  <input type="range" min="0" max="1" step="0.01" value={topP}
                    onChange={e => setTopP(parseFloat(e.target.value))}
                    className="w-20 h-1.5 accent-theme" />
                  <span className="text-[11px] font-mono text-white/40 w-8">{topP.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30">{t.parameters.seed}</span>
                  <input type="number" value={seed ?? ''} onChange={e => setSeed(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder={t.parameters.random}
                    className="w-20 h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/70 text-[12px] focus:outline-none focus:border-white/20" />
                  <button onClick={() => setSeedLocked(p => !p)} aria-label={seedLocked ? t.parameters.unlockSeed : t.parameters.lockSeed}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95 ${seedLocked ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.04] text-white/30 hover:text-white/60'}`}>
                    {seedLocked
                      ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                      : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 视频生成参数 */}
        {mode === 'video' && (
          <div className="px-4 pt-2.5 pb-2 border-b border-white/[0.06]">
            <div className="flex flex-wrap items-center gap-2">
              {/* 模型 */}
              <select value={videoModel} onChange={e => { const m = VIDEO_MODELS.find(x => x.id === e.target.value)!; setVideoModel(m.id); if (!m.ratios.includes(videoRatio)) setVideoRatio(m.ratios[0]); }}
                className="h-8 px-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white/70 text-[12px] cursor-pointer focus:outline-none focus:border-white/20 hover:border-white/20 transition-colors">
                {VIDEO_MODELS.map(m => <option key={m.id} value={m.id} className="bg-[#1a1a1a]">{m.label}</option>)}
              </select>
              {/* 比例 */}
              <select value={videoRatio} onChange={e => setVideoRatio(e.target.value)}
                className="h-8 px-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white/70 text-[12px] cursor-pointer focus:outline-none focus:border-white/20 hover:border-white/20 transition-colors">
                {currentVideoModel.ratios.map(r => <option key={r} value={r} className="bg-[#1a1a1a]">{r}</option>)}
              </select>
              <span className="text-[11px] text-white/25 ml-1">{currentVideoModel.duration}</span>
            </div>
            <p className="mt-1.5 text-[10px] text-blue-400/50 leading-relaxed">{t.parameters.cameraMotionTip}</p>
          </div>
        )}

        {/* textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? cfg.placeholder}
            rows={1}
            className="w-full bg-transparent resize-none outline-none text-white/80 placeholder-white/20 text-[15px] leading-relaxed px-4 pt-4 pb-2 min-h-[56px] max-h-[200px] custom-scrollbar"
          />
          {text && (
            <button onClick={() => setText('')} className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70 transition-all text-[11px]" title="清空">×</button>
          )}
        </div>

        {/* bottom toolbar */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">

          {/* mode switcher */}
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(p => !p)}
              className={`flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl border text-[13px] font-semibold transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-0 ${activeColor}`}
            >
              <span className="flex items-center justify-center">{(() => { const I = MODE_ICONS[mode]; return <I />; })()}</span>
              <span>{cfg.label}</span>
              <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showModeMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50 min-w-[140px]">
                {(Object.keys(MODE_CONFIG) as ConversationMode[]).map(m => {
                  const Icon = MODE_ICONS[m];
                  return (
                    <button
                      key={m}
                      onClick={() => { onModeChange(m); setShowModeMenu(false); }}
                      className={`w-full flex items-center gap-3 min-h-[48px] px-4 py-2.5 text-[13px] font-semibold transition-all duration-150 hover:bg-white/5 focus:outline-none ${mode === m ? 'text-blue-400 bg-blue-500/10' : 'text-white/50 hover:text-white/80'}`}
                    >
                      <Icon />
                      <span>{MODE_CONFIG[m].label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* image upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="上传图片或文件"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/30 hover:text-white/60 hover:bg-white/5 transition-all duration-150 active:scale-95 focus:outline-none"
            title="上传图片"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.ppt,.pptx,.txt,.md,.json,.csv" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

          <div className="flex-1" />

          {/* char count */}
          {text.length > 0 && (
            <span className="text-[10px] text-white/40 font-mono">{text.length}</span>
          )}

          {/* send button */}
          <button
            onClick={handleSubmit}
            disabled={(!text.trim() && images.length === 0) || isLoading}
            aria-label={isLoading ? "生成中" : "发送"}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-150
              ${(!text.trim() && images.length === 0) || isLoading
                ? 'bg-white/[0.04] text-white/20 cursor-not-allowed'
                : 'bg-blue-500/80 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/40'}`}
          >
            {isLoading
              ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
            }
          </button>
        </div>
      </div>

      {/* hint */}
      <p className="text-center text-[10px] text-white/40 mt-2">
        {language === 'zh-CN'
          ? 'Enter 发送 · Shift+Enter 换行 · 拖拽图片上传'
          : 'Enter to send · Shift+Enter for new line · Drag to upload'}
      </p>

      {inpaintIdx !== null && (
        <InpaintEditor
          imageUrl={images[inpaintIdx].data}
          onSaveMask={(maskDataUrl: string, role: 'donor' | 'recipient') => {
            setImages((prev: ImageItem[]) => prev.map((img: ImageItem, i: number) => i === inpaintIdx ? { ...img, maskDataUrl, role } : img));
          }}
          onSubmit={(maskDataUrl: string, _prompt: string, role: 'donor' | 'recipient') => {
            setImages((prev: ImageItem[]) => prev.map((img: ImageItem, i: number) => i === inpaintIdx ? { ...img, maskDataUrl, role } : img));
            setInpaintIdx(null);
          }}
          onClose={() => setInpaintIdx(null)}
        />
      )}
    </div>
  );
});

export default UnifiedInput;
