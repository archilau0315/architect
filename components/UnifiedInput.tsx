import React, { useState, useRef, useEffect } from 'react';
import { ConversationMode } from '../types.ts';
import InpaintEditor from './InpaintEditor.tsx';
import ScreenshotCropper from './ScreenshotCropper.tsx';
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
  useSearch?: boolean;
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
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 视频生成参数
  const VIDEO_MODELS = [
    { id: 'SeeDance-1.0PF',   label: 'SeeDance-1.0PF', ratios: ['16:9', '9:16', '1:1'],          duration: '5s / 10s',          images: '最多1张',  remoteModelId: 'doubao-seedance-1-0-pro-fast-251015' },
    { id: 'SeeDance-1.5',     label: 'SeeDance-1.5',  ratios: ['16:9', '9:16', '1:1'],          duration: '4s/6s/8s/12s',      images: '最多2张',  remoteModelId: 'doubao-seedance-1-5-pro-251215' },
    { id: 'SeeDance-2.0',     label: 'SeeDance-2.0',  ratios: ['16:9', '9:16', '1:1'],          duration: '4s/8s/12s/15s',     images: '最多9张',  remoteModelId: 'doubao-seedance-2-0', supportsVideo: true },
    { id: 'SeeDance-2.0F',    label: 'SeeDance-2.0F', ratios: ['16:9', '9:16', '1:1'],          duration: '4s/8s/12s/15s',     images: '最多9张',  remoteModelId: 'doubao-seedance-2-0-fast', supportsVideo: true },
  ];
  const [videoModel, setVideoModel] = useState('SeeDance-1.0PF');
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
        let fileType = file.type || '';
        if (isImage && (!fileType || fileType === 'image/' || fileType.length <= 6)) {
          const dataUrlMatch = dataUrl.match(/^data:([^;]+);/);
          if (dataUrlMatch) {
            fileType = dataUrlMatch[1];
          } else {
            fileType = 'image/png';
          }
        } else if (!fileType) {
          fileType = isText ? 'text/plain' : 'application/octet-stream';
        }
        const item: ImageItem = {
          name: file.name,
          type: fileType,
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

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      setScreenshotDataUrl(canvas.toDataURL('image/png'));
    } catch {
      // user cancelled
    }
  };

  const effectiveRatio = lockRatio
    ? (images[parseInt(lockRatio)]?.detectedRatio || aspectRatio)
    : (aspectRatio === 'custom' ? (customRatio || '1:1') : aspectRatio);

  // 快捷动作：解析图片 / 反推提示词 / JSON提示词
  const handleQuickAction = (action: 'analyze' | 'reverse' | 'reverse_json') => {
    if (isLoading || images.filter(i => i.fileCategory === 'image').length === 0) return;
    const prompts = {
      analyze: '请详细分析这张图片，从构图、光影、色彩、材质、风格等维度进行专业解读。输出格式：纯文本，不要使用JSON格式。',
      reverse: '请根据这张图片反推生成其创意提示词。输出内容：中文描述、英文提示词、风格特征、关键视觉元素和技术参数（光线、构图、情绪氛围）。输出格式：纯文本，清晰的分段描述，不要使用JSON格式，不要包含任何###或**符号。',
      reverse_json: '分析这张图片，直接输出一个JSON对象，不要有任何其他文字。JSON结构：{"subject":{"category":"","features":"","action":""},"details":{"color":"","texture":"","material":""},"environment":{"scene":"","time":"","weather":""},"lighting":{"quality":"","effect":"","tone":""},"style":{"genre":"","medium":"","reference":""},"composition":{"angle":"","shot":"","rule":""},"parameters":{"aspect_ratio":"","quality":"","detail":""},"prompt_en":"","prompt_zh":""}'
    };
    onSubmit({ text: prompts[action], images, mode: 'chat', silent: true });
    setText('');
    setImages([]);
  };

  const shouldAutoSearch = (query: string): boolean => {
    const searchKeywords = [
      '2024', '2025', '最新', '今天', '现在', '最近', '最新消息', '最新动态',
      '趋势', '行情', '新闻', '天气', '股票', '价格', '政策', '发布',
      '排名', '数据', '统计', '报告', '研究', '分析', '对比',
      '设计趋势', '行业案例', '素材参考', '外部资料', '实时信息',
      '搜', '搜索', '查找', '查询', '搜一下',
      '案例', '实例', '范例', '样板',
      '参考', '资料', '素材', '灵感', '图片',
      '宋式', '中式', '北欧', '极简', '欧式', '日式', '赛博朋克',
      '建筑', '设计', '景观', '室内', '装修', '效果图'
    ];
    return searchKeywords.some(keyword => query.includes(keyword));
  };

  const handleSubmit = (useSearch: boolean = false) => {
    if ((!text.trim() && images.length === 0) || isLoading) return;
    const payload: UnifiedPayload = {
      text: text.trim(),
      images,
      mode,
      useSearch: useSearch || (mode === 'chat' && shouldAutoSearch(text)),
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(false); }
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
                <div key={i} className="relative group flex items-center gap-2 px-3 py-2 rounded-xl min-w-0 max-w-[160px]" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                  <svg className={`w-4 h-4 shrink-0 ${img.fileCategory === 'pdf' ? 'text-red-400' : img.fileCategory === 'ppt' ? 'text-orange-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {img.fileCategory === 'pdf'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      : img.fileCategory === 'ppt'
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    }
                  </svg>
                  <span className="text-[11px] truncate" style={{ color: 'var(--text-primary)' }}>{img.name}</span>
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-[12px] transition-all hover:text-rose-500" style={{ color: 'var(--text-tertiary)' }}>×</button>
                </div>
              ) : (
                // 图片：原有预览
                <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--border-color)' }}>
                  <img src={img.data} className="w-full h-full object-cover" />
                  {img.role && (
                    <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${img.role === 'donor' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                      {img.role === 'donor' ? '供' : '受'}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center gap-1.5">
                    {/* 局部编辑 */}
                    <button onClick={() => setInpaintIdx(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }} title="局部编辑">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[13px] transition-all ${lockRatio === String(i) ? 'bg-blue-500/20 text-blue-400' : ''}`} style={lockRatio !== String(i) ? { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' } : undefined}>
                      {lockRatio === String(i)
                        ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M8 11V7a4 4 0 0 1 8 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                      }
                    </button>
                    {/* 删除 */}
                    <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all text-white text-lg font-light hover:bg-rose-500/60" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} title="删除">×</button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* 快捷动作：仅在 chat 模式且有图片时显示 */}
        {mode === 'chat' && images.some(img => img.fileCategory === 'image') && (
          <div className="flex items-center gap-2 px-4 pt-2 pb-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{language === 'zh-CN' ? '快捷操作:' : 'Quick Actions:'}</span>
            {[
              { action: 'analyze' as const,       label: language === 'zh-CN' ? '解析图片' : 'Analyze',   icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg> },
              { action: 'reverse' as const,        label: language === 'zh-CN' ? '反推提示词' : 'Reverse Prompt', icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg> },
              { action: 'reverse_json' as const,   label: language === 'zh-CN' ? 'JSON提示词' : 'JSON Prompt', icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg> },
            ].map(({ action, label, icon }) => (
              <button key={action} onClick={() => handleQuickAction(action)} disabled={isLoading}
                className="flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg border text-[12px] font-medium transition-all duration-150 btn-scale disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500/15 hover:border-indigo-500/30 hover:text-indigo-300" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <span className="flex items-center justify-center">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        {/* 图像生成参数（仅渲染模式） */}
        {mode === 'architect' && (
          <div className="px-4 pt-2.5 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex flex-wrap items-center gap-2">
              {/* 比例 */}
              <select
                value={lockRatio !== null ? 'custom' : aspectRatio}
                onChange={e => { setLockRatio(null); setAspectRatio(e.target.value); }}
                className="h-8 px-2 rounded-lg border text-[12px] cursor-pointer focus:outline-none transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                <option value="1:1" style={{ backgroundColor: 'var(--bg-tertiary)' }}>1:1</option>
                <option value="3:4" style={{ backgroundColor: 'var(--bg-tertiary)' }}>3:4</option>
                <option value="4:3" style={{ backgroundColor: 'var(--bg-tertiary)' }}>4:3</option>
                <option value="16:9" style={{ backgroundColor: 'var(--bg-tertiary)' }}>16:9</option>
                <option value="custom" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{lockRatio !== null ? `${t.parameters.custom} (${effectiveRatio})` : t.parameters.custom}</option>
              </select>
              {(aspectRatio === 'custom' && lockRatio === null) && (
                <input value={customRatio} onChange={e => setCustomRatio(e.target.value)}
                  placeholder="w:h"
                  className="h-8 w-16 px-2 rounded-lg border text-[12px] focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              )}

              {/* 尺寸 */}
              <select value={imageSize} onChange={e => setImageSize(e.target.value as any)}
                className="h-8 px-2 rounded-lg border text-[12px] cursor-pointer focus:outline-none transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                <option value="1K" style={{ backgroundColor: 'var(--bg-tertiary)' }}>1K</option>
                <option value="2K" style={{ backgroundColor: 'var(--bg-tertiary)' }}>2K</option>
                <option value="4K" style={{ backgroundColor: 'var(--bg-tertiary)' }}>4K</option>
              </select>

              {/* 质量 */}
              <select value={modelTier} onChange={e => setModelTier(e.target.value as any)}
                className="h-8 px-2 rounded-lg border text-[12px] cursor-pointer focus:outline-none transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                <option value="FAST" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{t.parameters.fast}</option>
                <option value="QUALITY" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{t.parameters.highQuality}</option>
              </select>

              {/* 数量 */}
              <select value={imageCount} onChange={e => setImageCount(Number(e.target.value))}
                className="h-8 px-2 rounded-lg border text-[12px] focus:outline-none transition-colors cursor-pointer"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                {[1,2,3,4].map(n => <option key={n} value={n} style={{ backgroundColor: 'var(--bg-tertiary)' }}>×{n}</option>)}
              </select>

              {/* 高清放大 */}
              {onUpscale && (
                <button onClick={() => onUpscale(null, images.find(i => i.fileCategory === 'image')?.data)} disabled={isLoading}
                  aria-label="高清放大"
                  className="min-h-[40px] px-3 rounded-lg border text-[12px] transition-all btn-scale disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 hover:bg-blue-500/10"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0m4 0h-4m2 2v-4" /></svg>HD
                </button>
              )}

              {/* 高级参数展开 */}
              <button onClick={() => setShowAdvanced(p => !p)}
                className="min-h-[40px] px-3 rounded-lg border text-[12px] transition-all btn-scale flex items-center gap-1.5"
                style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                {t.parameters.advanced}
              </button>
            </div>

            {/* 高级参数 */}
            {showAdvanced && (
              <div className="flex flex-wrap items-center gap-4 pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t.parameters.temperature}</span>
                  <input type="range" min="0" max="2" step="0.05" value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-20 h-1.5 accent-theme" />
                  <span className="text-[11px] font-mono w-8" style={{ color: 'var(--text-secondary)' }}>{temperature.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t.parameters.topP}</span>
                  <input type="range" min="0" max="1" step="0.01" value={topP}
                    onChange={e => setTopP(parseFloat(e.target.value))}
                    className="w-20 h-1.5 accent-theme" />
                  <span className="text-[11px] font-mono w-8" style={{ color: 'var(--text-secondary)' }}>{topP.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 视频生成参数 */}
        {mode === 'video' && (
          <div className="px-4 pt-2 pb-2 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--border-color)' }}>
            <select value={videoModel} onChange={e => { const m = VIDEO_MODELS.find(x => x.id === e.target.value)!; setVideoModel(m.id); if (!m.ratios.includes(videoRatio)) setVideoRatio(m.ratios[0]); }}
              className="h-8 px-2 rounded-lg border text-[12px] cursor-pointer focus:outline-none transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              {VIDEO_MODELS.map(m => <option key={m.id} value={m.id} style={{ backgroundColor: 'var(--bg-tertiary)' }}>{m.label}</option>)}
            </select>
            <select value={videoRatio} onChange={e => setVideoRatio(e.target.value)}
              className="h-8 px-2 rounded-lg border text-[12px] cursor-pointer focus:outline-none transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              {currentVideoModel.ratios.map(r => <option key={r} value={r} style={{ backgroundColor: 'var(--bg-tertiary)' }}>{r}</option>)}
            </select>
            <span className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
              {currentVideoModel.images}底图 · 时长: {currentVideoModel.duration}{currentVideoModel.supportsVideo ? ' · 支持参考视频' : ''}
            </span>
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
            style={{ color: 'var(--text-primary)' }}
            className="w-full bg-transparent resize-none outline-none text-[15px] leading-relaxed px-4 pt-4 pb-2 min-h-[56px] max-h-[200px] custom-scrollbar"
          />
          {text && (
            <button onClick={() => setText('')} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full transition-all btn-scale hover:bg-red-500/20 hover:text-red-400 text-[14px]" title="清空">×</button>
          )}
        </div>

        {/* bottom toolbar */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">

          {/* mode switcher */}
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(p => !p)}
              className="flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl border text-[13px] font-semibold transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <span className="flex items-center justify-center">{(() => { const I = MODE_ICONS[mode]; return <I />; })()}</span>
              <span>{cfg.label}</span>
              <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showModeMenu && (
              <div className="absolute bottom-full mb-2 left-0 border rounded-xl shadow-2xl overflow-hidden z-50 min-w-[140px]" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                {(Object.keys(MODE_CONFIG) as ConversationMode[]).map(m => {
                  const Icon = MODE_ICONS[m];
                  return (
                    <button
                      key={m}
                      onClick={() => { onModeChange(m); setShowModeMenu(false); }}
                      className={`w-full flex items-center gap-3 min-h-[48px] px-4 py-2.5 text-[13px] font-semibold transition-all duration-150 focus:outline-none ${mode === m ? 'text-blue-400 bg-blue-500/10' : ''}`}
                      style={mode !== m ? { color: 'var(--text-secondary)' } : undefined}
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-150 btn-scale focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            title="上传文件"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.ppt,.pptx,.txt,.md,.json,.csv" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

          {/* screenshot */}
          <button
            onClick={handleScreenshot}
            aria-label="截图"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-150 btn-scale focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            title="截图"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <div className="flex-1" />

          {/* char count */}
          {text.length > 0 && (
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{text.length}</span>
          )}

          {/* search button - only in chat mode */}
          {mode === 'chat' && (
            <button
              onClick={() => handleSubmit(shouldAutoSearch(text))}
              disabled={(!text.trim() && images.length === 0) || isLoading}
              aria-label={isLoading ? "生成中" : "发送"}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-150
                ${(!text.trim() && images.length === 0) || isLoading
                  ? 'cursor-not-allowed'
                  : 'bg-blue-500/80 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/40'}`}
              style={(!text.trim() && images.length === 0) || isLoading ? { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' } : undefined}
              title={shouldAutoSearch(text) ? '发送并联网搜索' : '发送'}
            >
              {isLoading
                ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : shouldAutoSearch(text)
                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
              }
            </button>
          )}

          {mode !== 'chat' && (
            <button
              onClick={() => handleSubmit(false)}
              disabled={(!text.trim() && images.length === 0) || isLoading}
              aria-label={isLoading ? "生成中" : "发送"}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-150
                ${(!text.trim() && images.length === 0) || isLoading
                  ? 'cursor-not-allowed'
                  : 'bg-blue-500/80 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/40'}`}
              style={(!text.trim() && images.length === 0) || isLoading ? { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' } : undefined}
            >
              {isLoading
                ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
              }
            </button>
          )}
        </div>
      </div>

      {/* hint */}
      <p className="text-center text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
        {language === 'zh-CN'
          ? 'Enter 发送 · Shift+Enter 换行 · 拖拽图片上传'
          : 'Enter to send · Shift+Enter for new line · Drag to upload'}
      </p>

      {screenshotDataUrl && (
        <ScreenshotCropper
          imageDataUrl={screenshotDataUrl}
          onCrop={(dataUrl) => {
            setImages(prev => [...prev, { name: 'screenshot.png', type: 'image/png', data: dataUrl, fileCategory: 'image' }]);
            setScreenshotDataUrl(null);
          }}
          onCancel={() => setScreenshotDataUrl(null)}
        />
      )}

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
