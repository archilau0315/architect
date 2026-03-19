
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { GeminiService, DEFAULT_SYSTEM_PRESETS } from '../services/geminiService.ts';
import { WatermarkUtils } from '../services/watermarkService.ts';
import { VideoWatermarkUtils } from '../services/videoWatermarkService.ts';
import { UserTier } from '../types.ts';

interface VideoGeneratorProps {
  instructions: typeof DEFAULT_SYSTEM_PRESETS;
  onReset: () => void;
  fontSize?: number;
  userTier?: UserTier;
  points: { daily: number; purchased: number };
  onConsumePoints: (amount: number) => boolean;
  useThirdPartyGateway?: boolean;
  isDeveloperMode?: boolean;
}

const STORAGE_KEY = 'ARCHITECT_VIDEO_WORKBENCH_V2';
const VIDEO_DOWNLOAD_KEY = 'ARCHITECT_VIDEO_DOWNLOAD_COUNT';

const getDownloadLimits = (tier: UserTier | 'dev'): { daily: number; label: string } => {
  switch (tier) {
    case 'pro': return { daily: 5, label: '5段/天' };
    case 'plus': return { daily: Infinity, label: '无限' };
    case 'dev': return { daily: Infinity, label: '无限' };
    default: return { daily: 0, label: '无权限' };
  }
};

const getTodayDownloadCount = (): number => {
  try {
    const saved = localStorage.getItem(VIDEO_DOWNLOAD_KEY);
    if (!saved) return 0;
    const data = JSON.parse(saved);
    const today = new Date().toISOString().split('T')[0];
    if (data.date === today) {
      return data.count || 0;
    }
    return 0;
  } catch {
    return 0;
  }
};

const incrementDownloadCount = (): number => {
  const today = new Date().toISOString().split('T')[0];
  const current = getTodayDownloadCount();
  const newCount = current + 1;
  localStorage.setItem(VIDEO_DOWNLOAD_KEY, JSON.stringify({ date: today, count: newCount }));
  return newCount;
};

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ instructions, onReset, fontSize = 18, userTier = 'free', points, onConsumePoints, useThirdPartyGateway = false, isDeveloperMode = false }) => {
  const effectiveTier = (isDeveloperMode ? 'dev' : userTier) as UserTier | 'dev';
  const [prompt, setPrompt] = useState('');
  const [assets, setAssets] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [selectedEngine, setSelectedEngine] = useState<string>('veo-3.1-fast-generate-preview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [watermarkedVideoUrl, setWatermarkedVideoUrl] = useState<string | null>(null);
  const [isWatermarkProcessing, setIsWatermarkProcessing] = useState(false);
  const [watermarkProgress, setWatermarkProgress] = useState(0);
  const [lastVideoRef, setLastVideoRef] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const capabilities = useMemo(() => GeminiService.getVideoModelCapabilities(assets.length, useThirdPartyGateway), [assets.length, useThirdPartyGateway]);

  // 获取当前选定引擎的详细信息
  const currentEngineDetails = useMemo(() => {
    return capabilities.engineDetails?.[selectedEngine] || {
      supportedRatios: ['16:9'],
      duration: '5-15s'
    };
  }, [capabilities, selectedEngine]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setPrompt(data.prompt || '');
        setAssets(data.assets || []);
        setAspectRatio(data.aspectRatio || '16:9');
        if (data.selectedEngine) setSelectedEngine(data.selectedEngine);
      } catch (e) { console.error("Restore workbench failed", e); }
    }
  }, []);

  useEffect(() => {
    if (!currentEngineDetails.supportedRatios.includes(aspectRatio)) {
      setAspectRatio(currentEngineDetails.supportedRatios[0]);
    }
    // 确保当前选中的引擎在可用列表中，如果不在则重置为第一个可用引擎
    if (!capabilities.engines.find(e => e.id === selectedEngine)) {
      setSelectedEngine(capabilities.engines[0].id);
    }
  }, [capabilities, aspectRatio, selectedEngine, currentEngineDetails]);

  useEffect(() => {
    try {
      const data = { prompt, assets, aspectRatio, selectedEngine };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // 捕获 QuotaExceededError 溢出错误，防止崩溃
      console.warn("LocalStorage Quota Exceeded. State maintained in RAM only.");
    }
  }, [prompt, assets, aspectRatio, selectedEngine]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      const newAssets = [...assets];
      for (const file of files) {
        if (newAssets.length >= 9) break;
        const dataUrl = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.readAsDataURL(file);
        });
        const compressed = await GeminiService.compressImage(dataUrl);
        newAssets.push(compressed);
      }
      setAssets(newAssets);
      setLastVideoRef(null);
    }
    e.target.value = '';
  };

  const removeAsset = (index: number) => {
    setAssets(prev => prev.filter((_, i) => i !== index));
    setLastVideoRef(null);
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
      return;
    }

    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        if (window.confirm("视频生成任务需要绑定 Paid API Key。是否立即前往绑定？")) {
          await window.aistudio.openSelectKey();
        } else {
          return;
        }
      }
    }

    setIsGenerating(true);
    setProgress(0);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setInterval(() => {
      setProgress(p => Math.min(p + 1, 98));
    }, 2000);

    const finalPrompt = (assets.length >= 2 
      ? `[SHOT-BY-SHOT EVOLUTION]: Evolve the scene through the ${assets.length} provided reference assets. ` 
      : `[MOTION GENERATION]: Generate motion from single reference. `) + (prompt || "Architectural cinematic flythrough, hyper-realistic.");

    try {
      const result = await GeminiService.generateVideo(
        finalPrompt, 
        assets,
        aspectRatio, 
        instructions, 
        controller.signal,
        lastVideoRef,
        selectedEngine
      );
      setVideoUrl(result.url);
      setLastVideoRef(result.videoRef);
      setProgress(100);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert(`视频生成失败: ${err.message}`);
      }
    } finally {
      clearInterval(timer);
      setIsGenerating(false);
    }
  };

  const handleLocalReset = () => {
    if (window.confirm("确定要重置当前导播台吗？")) {
      localStorage.removeItem(STORAGE_KEY);
      setAssets([]);
      setPrompt('');
      setVideoUrl(null);
      setLastVideoRef(null);
      setProgress(0);
      onReset();
    }
  };

  const handleDownload = async (e: React.MouseEvent, isPro: boolean = false) => {
    e.stopPropagation();
    if (!videoUrl) return;

    if (isPro) {
      const limits = getDownloadLimits(effectiveTier as UserTier | 'dev');
      const currentCount = getTodayDownloadCount();
      
      if (limits.daily === 0) {
        window.alert("权限不足：无水印下载仅限 Pro/Plus 用户。\n\n请升级套餐以解锁此功能。");
        return;
      }
      
      if (currentCount >= limits.daily) {
        window.alert(`今日无水印下载次数已用完。\n\n您的额度：${limits.label}\n已下载：${currentCount} 次\n\n请明天再试或升级套餐。`);
        return;
      }
      
      const confirmed = window.confirm(
        `【版权合规声明】\n本 AI 生成视频仅限个人/合法使用，禁止用于违法、侵权用途。平台已记录下载日志，请合规使用。\n\n今日剩余下载次数：${limits.daily - currentCount}\n\n确认下载无水印高清原片？`
      );
      if (!confirmed) return;
      
      WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'pro' });
      incrementDownloadCount();
      
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `Architect_Motion_PRO_${Date.now()}.mp4`;
      link.click();
    } else {
      WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'standard' });
      
      const confirmed = window.confirm(
        "【标准下载】\n将为您生成带水印的视频版本。\n处理时间约需 10-30 秒，请耐心等待。\n\n确认下载带水印版本？"
      );
      if (!confirmed) return;
      
      try {
        setIsWatermarkProcessing(true);
        setWatermarkProgress(0);
        
        const wmResult = await VideoWatermarkUtils.addWatermark(
          videoUrl,
          './LOGOkbitwater.png',
          (progress) => setWatermarkProgress(progress)
        );
        
        setWatermarkedVideoUrl(wmResult.objectUrl);
        
        const link = document.createElement('a');
        link.href = wmResult.objectUrl;
        link.download = `Architect_Motion_STD_${Date.now()}.mp4`;
        link.click();
        
      } catch (error: any) {
        console.error('[标准下载] 水印处理失败:', error);
        alert(`水印处理失败: ${error.message}\n将下载原视频。`);
        
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `Architect_Motion_STD_${Date.now()}.mp4`;
        link.click();
      } finally {
        setIsWatermarkProcessing(false);
        setWatermarkProgress(0);
      }
    }
  };

  const AssetSlot = ({ current, onRemove, onUpload, index, style }: any) => (
    <div 
      style={style}
      className={`w-full aspect-square rounded-[2.5rem] border ${current ? 'border-theme ring-2 ring-theme/20 shadow-xl' : 'border-slate-200 dark:border-slate-800'} bg-white/40 dark:bg-slate-900/20 glass-card flex flex-col overflow-hidden transition-all animate-in fade-in slide-in-from-left-4 shrink-0 duration-500`}
    >
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-white/60 dark:bg-slate-900/60">
        <span className="text-[9px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest italic">{index !== undefined ? `分镜 ${index + 1}` : '待上传'}</span>
        {current && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(); }} 
            className="w-6 h-6 flex items-center justify-center bg-rose-500/10 rounded-lg text-rose-500 hover:bg-rose-500 hover:text-white transition-all z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
      </div>
      <div className="flex-1 relative flex items-center justify-center cursor-pointer group" onClick={onUpload}>
        {current ? (
          <img src={current} className="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-110" />
        ) : (
          <div className="flex flex-col items-center opacity-20 group-hover:opacity-40 transition-opacity text-center p-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            <span className="text-[8px] font-black uppercase tracking-tighter leading-tight">ADD SHOT</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full space-y-12 animate-in fade-in duration-700">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="space-y-1">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight italic">动态漫游导演 <span className="text-theme font-normal tracking-normal">Motion Director</span></h3>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] leading-none">Sequence-Based Spatial Walkthrough Engine</p>
        </div>
        <button onClick={handleLocalReset} className="px-8 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-all active:scale-95 shadow-sm">重置导播台</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full">
        <div className="space-y-8">
          <div className="bg-white/60 dark:bg-slate-900/40 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 glass-card space-y-10">
            <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">资产管理序列 / Asset Timeline (Max 9)</label>
              <div className="grid grid-cols-3 gap-4 w-full py-2 h-auto">
                {assets.map((img, i) => (
                  <AssetSlot 
                    key={`asset-${i}`} 
                    index={i} 
                    current={img} 
                    onRemove={() => removeAsset(i)} 
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
                {assets.length < 9 && (
                  <AssetSlot 
                    key="add-slot"
                    onUpload={() => fileInputRef.current?.click()} 
                    style={{ animationDelay: `${assets.length * 80}ms` }} 
                  />
                )}
              </div>
            </div>
            
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">算力引擎选择 / Engine Select</label>
              <div className="relative w-full">
                <select 
                  value={selectedEngine} 
                  onChange={(e) => setSelectedEngine(e.target.value)}
                  className="w-full appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-black tracking-widest text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-theme/10 transition-all cursor-pointer"
                >
                  {capabilities.engines.map((eng) => {
                    const isBetaLocked = userTier === 'beta' && !eng.id.toLowerCase().includes('speed');
                    return (
                      <option 
                        key={eng.id} 
                        value={eng.id} 
                        disabled={eng.isFrozen || isBetaLocked}
                        className={`bg-white dark:bg-slate-900 ${(eng.isFrozen || isBetaLocked) ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}
                      >
                        {eng.label}{eng.isFrozen ? ' (开发中)' : ''}{isBetaLocked ? ' (内测不可用)' : ''}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={18} strokeWidth={3} />
                </div>
              </div>
              <div className="flex items-center justify-between px-6 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">预计时长</span>
                <span className="text-[11px] font-bold text-theme dark:text-theme-light uppercase tracking-tighter">
                  {currentEngineDetails.duration}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between ml-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">设定运镜比例</label>
                <span className="text-[9px] font-bold text-theme-light uppercase tracking-tighter">
                  {assets.length >= 2 ? "多图模式约束：仅支持 16:9" : `当前引擎支持: ${currentEngineDetails.supportedRatios.join(', ')}`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'].map((r: string) => {
                  const isSupported = currentEngineDetails.supportedRatios.includes(r);
                  return (
                    <button 
                      key={r} 
                      disabled={!isSupported}
                      onClick={() => setAspectRatio(r)} 
                      className={`py-4 rounded-2xl text-[12px] font-black transition-all ${
                        aspectRatio === r 
                          ? 'bg-theme text-white shadow-xl' 
                          : isSupported 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200' 
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-300 opacity-20 grayscale cursor-not-allowed'
                      }`}
                    >
                      {r === '21:9' ? '21:9 超宽' : r === '16:9' ? '16:9 横屏' : r === '4:3' ? '4:3 标准' : r === '1:1' ? '1:1 正方' : r === '3:4' ? '3:4 比例' : '9:16 竖屏'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2">分镜动态演化描述 (Prompt)</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                style={{ fontSize: `${fontSize}px` }}
                placeholder="例如：相机从客厅平滑推向阳台，在此过程中光影随日落发生动态演变..."
                className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 outline-none focus:ring-4 focus:ring-theme/10 transition-all font-medium leading-relaxed"
              />
            </div>

            <button onClick={handleGenerate} className={`w-full py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] transition-all active:scale-95 shadow-2xl ${isGenerating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-theme text-white hover:bg-theme-light'}`}>
              {isGenerating ? "正在执行解算..." : "执行分镜动态解算"}
            </button>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-900/40 rounded-[4rem] border border-slate-200 dark:border-slate-800 glass-card flex flex-col items-center justify-center p-12 min-h-[600px] relative overflow-hidden group">
           {isGenerating && (
             <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-2xl flex flex-col items-center justify-center p-12 animate-in fade-in duration-500">
                <div className="relative w-24 h-24 mb-10">
                   <div className="absolute inset-0 border-4 border-theme/20 rounded-full" />
                   <div className="absolute inset-0 border-4 border-theme border-t-transparent rounded-full animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center text-white font-black">{progress}%</div>
                </div>
                <h4 className="text-xl font-black text-white italic tracking-widest uppercase">解算引擎运行中</h4>
                <button onClick={() => handleGenerate()} className="mt-12 px-8 py-3 bg-white/10 hover:bg-rose-600 text-white border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-all">终止任务</button>
             </div>
           )}

            {videoUrl ? (
             <div className="w-full h-full flex flex-col items-center gap-10 animate-in zoom-in-95 duration-500">
                <div className={`relative shadow-3xl rounded-[2.5rem] overflow-hidden border border-white/10 ${aspectRatio === '9:16' ? 'h-[75vh]' : 'w-full'}`}>
                  <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                  <div className="absolute bottom-6 right-6 pointer-events-none z-10 opacity-50">
                    <img src="./LOGOkbitwater.png" className="w-20 h-auto brightness-0 invert" alt="Watermark" />
                  </div>
                  <div className="absolute top-6 left-6 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full border border-white/10 text-[8px] text-white/60 font-black uppercase tracking-widest pointer-events-none z-10">
                    Preview Mode | Watermarked
                  </div>
                </div>
                <div className="flex gap-4 items-center flex-wrap">
                  <button 
                    onClick={(e) => {
                      if (effectiveTier === 'beta' || effectiveTier === 'free') {
                        window.alert("权限不足：视频下载仅限 Pro/Plus 用户。\n\n请升级套餐以解锁此功能。");
                        return;
                      }
                      handleDownload(e, false);
                    }} 
                    disabled={isWatermarkProcessing || effectiveTier === 'beta' || effectiveTier === 'free'}
                    className={`px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest transition-all ${
                      (effectiveTier === 'beta' || effectiveTier === 'free')
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50'
                        : 'bg-slate-100 dark:bg-white/10 backdrop-blur-xl border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20'
                    } ${isWatermarkProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    标准下载 (带水印)
                  </button>
                  
                  <button 
                    onClick={(e) => {
                      const limits = getDownloadLimits(effectiveTier);
                      if (limits.daily === 0) {
                        window.alert("权限不足：无水印下载仅限 Pro/Plus 用户。\n\n请升级套餐以解锁此功能。");
                        return;
                      }
                      handleDownload(e, true);
                    }} 
                    disabled={isWatermarkProcessing || getDownloadLimits(effectiveTier).daily === 0}
                    className={`px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest transition-all shadow-lg ${
                      getDownloadLimits(effectiveTier).daily === 0 
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50' 
                        : 'bg-theme text-white hover:bg-theme-light'
                    } ${isWatermarkProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    无水印下载 {effectiveTier !== 'dev' && `(${getDownloadLimits(effectiveTier).label})`}
                  </button>
                  
                  {isWatermarkProcessing && (
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-theme transition-all duration-300"
                          style={{ width: `${watermarkProgress}%` }}
                        />
                      </div>
                      <span className="text-white/60 text-xs">{watermarkProgress}%</span>
                    </div>
                  )}
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center text-center opacity-10 select-none grayscale">
                <svg className="w-40 h-40 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={0.2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" /></svg>
                <h4 className="text-4xl font-black uppercase tracking-[0.6em] italic">Waiting For Sequence</h4>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
