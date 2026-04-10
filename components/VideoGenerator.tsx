
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { GeminiService, DEFAULT_SYSTEM_PRESETS } from '../services/geminiService.ts';
import { WatermarkUtils } from '../services/watermarkService.ts';
import { VideoWatermarkUtils } from '../services/videoWatermarkService.ts';
import { Ph8UsageService } from '../services/ph8UsageService.ts';
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
      const data = { prompt, assets, aspectRatio, selectedEngine, videoUrl, lastVideoRef };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // 捕获 QuotaExceededError 溢出错误，防止崩溃
      console.warn("LocalStorage Quota Exceeded. State maintained in RAM only.");
    }
  }, [prompt, assets, aspectRatio, selectedEngine, videoUrl, lastVideoRef]);

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

  // Token 到积分的换算比例：1 积分 = 100 token
  const TOKENS_PER_POINT = 100;

  // 计算视频生成成本（按秒数估算）
  const calculateVideoCost = () => {
    // 视频生成成本较高，5秒视频约 20000-30000 token
    // 按 25000 token 计算 = 167 积分
    return Math.ceil(25000 / TOKENS_PER_POINT); // 约 167 积分
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

      // 获取 PH8 真实费用并扣除积分
      setTimeout(async () => {
        try {
          const session = localStorage.getItem('architect-invite-session');
          if (!session) return;
          const sessionData = JSON.parse(session);
          const userId = sessionData.user_id || sessionData.email;

          const usageResult = await Ph8UsageService.getLatestUsage(userId);
          if (usageResult.success && usageResult.data) {
            const realCost = usageResult.data.total_tokens || 0;
            console.log('[PH8真实费用-Video]', {
              requestId: usageResult.data.request_id,
              cost: realCost,
              costInYuan: (realCost * 0.0001).toFixed(4),
              model: usageResult.data.model
            });

            if (realCost > 0 && onConsumePoints) {
              const userPoints = Math.ceil(realCost / 10);
              const deducted = onConsumePoints(userPoints);
              if (!deducted) {
                console.warn('[PH8费用] 积分不足，无法扣除:', userPoints);
              }
            }
          }
        } catch (err) {
          console.error('获取PH8真实费用失败:', err);
        }
      }, 500);

      // 获取用户ID
      let userId = 'guest';
      try {
        const sessionData = localStorage.getItem('architect-invite-session');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          userId = parsed.userId || parsed.email || 'guest';
        }
      } catch (e) {
        console.error('获取用户ID失败:', e);
      }
      
      // 延迟获取真实的 Token 消耗数据（等待后端记录完成）
      setTimeout(async () => {
        try {
          const result = await Ph8UsageService.getLatestUsage(userId);
          if (result.success && result.data) {
            console.log('[Video真实Token消耗]', {
              requestId: result.data.request_id,
              promptTokens: result.data.prompt_tokens,
              completionTokens: result.data.completion_tokens,
              totalTokens: result.data.total_tokens,
              model: result.data.model
            });
          } else {
            console.log('[Video] 未获取到真实Token消耗数据');
          }
        } catch (err) {
          console.error('[Video] 获取真实Token消耗失败:', err);
        }
      }, 500); // 延迟500ms确保后端已记录
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
      className={`w-full aspect-square rounded-xl border ${current ? 'border-blue-500/30' : 'border-white/[0.06]'} bg-white/[0.03] flex flex-col overflow-hidden transition-all shrink-0`}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.05]">
        <span className="text-[9px] font-medium text-white/30 uppercase tracking-widest">{index !== undefined ? `分镜 ${index + 1}` : '待上传'}</span>
        {current && onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/8 transition-all">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      <div className={`flex-1 relative flex items-center justify-center group ${onUpload ? 'cursor-pointer' : ''}`} onClick={onUpload || undefined}>
        {current ? (
          <img src={current} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center opacity-20 group-hover:opacity-50 transition-opacity">
            <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="text-[8px] font-medium uppercase tracking-wide">添加</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="space-y-0.5">
          <h3 className="text-xl font-semibold text-white/90">动态漫游导演 <span className="text-white/30 font-normal text-base">Motion Director</span></h3>
          <p className="text-[10px] font-medium text-white/25 uppercase tracking-widest">Sequence-Based Spatial Walkthrough Engine</p>
        </div>
        <button onClick={handleLocalReset} className="min-h-[36px] px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] font-medium text-white/40 hover:text-white/70 hover:bg-white/8 transition-all active:scale-95">重置导播台</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <div className="space-y-4">
          <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/[0.06] space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">资产序列 / Asset Timeline (Max 9)</label>
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

            <div className="space-y-3">
              <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">算力引擎 / Engine</label>
              <div className="relative w-full">
                <select
                  value={selectedEngine}
                  onChange={(e) => setSelectedEngine(e.target.value)}
                  className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm font-medium text-white/70 outline-none focus:border-white/20 transition-all cursor-pointer"
                >
                  {capabilities.engines.map((eng) => (
                    <option key={eng.id} value={eng.id} disabled={eng.isFrozen} className="bg-[#1a1a1a] text-white/70">
                      {eng.label}{eng.isFrozen ? ' (开发中)' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                  <ChevronDown size={14} />
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">预计时长</span>
                <span className="text-[11px] font-medium text-blue-400">{currentEngineDetails.duration}</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">分镜描述 (Prompt)</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                style={{ fontSize: `${fontSize}px` }}
                placeholder="例如：相机从客厅平滑推向阳台，光影随日落动态演变..."
                className="w-full h-28 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 outline-none focus:border-white/20 transition-all font-medium leading-relaxed text-white/70 placeholder-white/20 resize-none"
              />
            </div>

            <button onClick={handleGenerate} className={`w-full py-4 rounded-xl font-medium text-sm transition-all active:scale-95 ${isGenerating ? 'bg-white/[0.04] border border-white/[0.06] text-white/30 cursor-not-allowed' : 'bg-blue-500/80 text-white hover:bg-blue-500'}`}>
              {isGenerating ? "解算中..." : "执行分镜动态解算"}
            </button>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center p-8 min-h-[500px] relative overflow-hidden">
           {isGenerating && (
             <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
                <div className="relative w-16 h-16 mb-6">
                   <div className="absolute inset-0 border-2 border-white/10 rounded-full" />
                   <div className="absolute inset-0 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm font-medium">{progress}%</div>
                </div>
                <p className="text-base font-medium text-white/70">解算引擎运行中</p>
                <button onClick={() => handleGenerate()} className="mt-8 min-h-[36px] px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-sm hover:bg-white/8 hover:text-white/70 transition-all">终止任务</button>
             </div>
           )}

            {videoUrl ? (
             <div className="w-full flex flex-col items-center gap-4 animate-in fade-in duration-300">
                <div className={`relative rounded-xl overflow-hidden border border-white/10 ${aspectRatio === '9:16' ? 'h-[60vh]' : 'w-full'}`}>
                  <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-sm rounded-lg border border-white/10 text-[9px] text-white/40 font-medium pointer-events-none z-10">
                    Preview · Watermarked
                  </div>
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                  <button
                    onClick={(e) => {
                      if (effectiveTier === 'beta' || effectiveTier === 'free') { window.alert("视频下载仅限 Pro/Plus 用户。"); return; }
                      handleDownload(e, false);
                    }}
                    disabled={isWatermarkProcessing || effectiveTier === 'beta' || effectiveTier === 'free'}
                    className={`min-h-[36px] px-4 rounded-xl text-[11px] font-medium transition-all border ${(effectiveTier === 'beta' || effectiveTier === 'free') || isWatermarkProcessing ? 'bg-white/[0.02] border-white/[0.04] text-white/20 cursor-not-allowed' : 'bg-white/[0.04] border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70'}`}
                  >标准下载 (带水印)</button>

                  <button
                    onClick={(e) => {
                      if (getDownloadLimits(effectiveTier).daily === 0) { window.alert("无水印下载仅限 Pro/Plus 用户。"); return; }
                      handleDownload(e, true);
                    }}
                    disabled={isWatermarkProcessing || getDownloadLimits(effectiveTier).daily === 0}
                    className={`min-h-[36px] px-4 rounded-xl text-[11px] font-medium transition-all ${getDownloadLimits(effectiveTier).daily === 0 || isWatermarkProcessing ? 'bg-white/[0.02] border border-white/[0.04] text-white/20 cursor-not-allowed' : 'bg-blue-500/80 text-white hover:bg-blue-500'}`}
                  >无水印下载 {effectiveTier !== 'dev' ? `(${getDownloadLimits(effectiveTier).label})` : ''}</button>

                  {isWatermarkProcessing && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${watermarkProgress}%` }} />
                      </div>
                      <span className="text-white/40 text-xs">{watermarkProgress}%</span>
                    </div>
                  )}
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center text-center opacity-10 select-none">
                <svg className="w-24 h-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={0.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <p className="text-sm font-medium text-white/30">等待生成</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
