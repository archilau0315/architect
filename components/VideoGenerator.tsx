
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { GeminiService, DEFAULT_SYSTEM_PRESETS } from '../services/geminiService.ts';
import { WatermarkUtils } from '../services/watermarkService.ts';
import { VideoWatermarkUtils } from '../services/videoWatermarkService.ts';
import { Ph8UsageService } from '../services/ph8UsageService.ts';
import { UserTier, Language } from '../types.ts';
import { getTranslation } from '../i18n/locales.ts';

interface VideoGeneratorProps {
  instructions: typeof DEFAULT_SYSTEM_PRESETS;
  onReset: () => void;
  fontSize?: number;
  userTier?: UserTier;
  points: { daily: number; purchased: number };
  onConsumePoints: (amount: number) => Promise<boolean>;
  useThirdPartyGateway?: boolean;
  isDeveloperMode?: boolean;
  language?: Language;
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

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ instructions, onReset, fontSize = 18, userTier = 'free', points, onConsumePoints, useThirdPartyGateway = false, isDeveloperMode = false, language = 'zh-CN' }) => {
  const t = getTranslation(language);
  const isDeveloper = userTier === 'pro' || userTier === 'plus' || isDeveloperMode;
  const effectiveTier = (isDeveloperMode ? 'dev' : userTier) as UserTier | 'dev';
  const [prompt, setPrompt] = useState('');
  const [assets, setAssets] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [selectedEngine, setSelectedEngine] = useState<string>('KbitVeo-speed');
  
  const engineToModelId: Record<string, string> = {
    'KbitVeo-speed': 'doubao-seedance-2-0-fast',
    'KbitVeo-normal': 'doubao-seedance-1-5-normal',
    'KbitVeo-pro': 'doubao-seedance-2-0-pro',
    'KbitVeo-standard': 'doubao-seedance-2-0',
  };
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [watermarkedVideoUrl, setWatermarkedVideoUrl] = useState<string | null>(null);
  const [isWatermarkProcessing, setIsWatermarkProcessing] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false); // [Bug修复] 补充缺失的状态声明
  const [lastVideoRef, setLastVideoRef] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('解算引擎运行中');

  // 根据用户等级决定预览视频源
  // free 用户：预览已烧录水印的视频，右键保存也是带水印的
  // pro/plus/dev：预览原始高清，CSS 叠加层仅作品牌展示
  const previewVideoSrc = isDeveloper ? videoUrl : (watermarkedVideoUrl || videoUrl);
  const shouldShowWatermarkOverlay = isDeveloper; // 仅付费用户显示叠加层作为视觉提示
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 组件卸载时释放 Blob URL
  useEffect(() => {
    return () => {
      if (blobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // [Bug修复] 依赖 referenceVideos，确保 cleanup 捕获最新值释放 Blob URL，防止内存泄漏
  useEffect(() => {
    const currentUrls = [...referenceVideos];
    return () => { currentUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [referenceVideos]);

  // 预加载 FFmpeg 和 Logo 以加快水印处理速度
  useEffect(() => {
    const loadResourcesAsync = async () => {
      try {
        await Promise.all([
          VideoWatermarkUtils.loadFFmpeg(),
          VideoWatermarkUtils.preloadLogo('/public/LOGOkbitwater.png')
        ]);
        console.log('[资源预加载] FFmpeg 和 Logo 预加载完成');
      } catch (e) {
        console.warn('[资源预加载] 失败:', e);
      }
    };
    // 延迟预加载，避免阻塞页面加载
    const timer = setTimeout(loadResourcesAsync, 2000);
    return () => clearTimeout(timer);
  }, []);

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

  const [referenceVideos, setReferenceVideos] = useState<string[]>([]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      setReferenceVideos(prev => {
        const urls = [...prev];
        for (const file of files) {
          if (urls.length >= 3) break;
          urls.push(URL.createObjectURL(file));
        }
        return urls;
      });
    }
    e.target.value = '';
  };

  const removeVideo = (index: number) => setReferenceVideos(prev => {
    URL.revokeObjectURL(prev[index]);
    return prev.filter((_, i) => i !== index);
  });

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
    setStatusText('正在初始化引擎...');
    setWatermarkedVideoUrl(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        engineToModelId[selectedEngine] || selectedEngine,
        (p) => {
          setProgress(p);
          // 根据进度更新状态文本
          if (p < 15) {
            setStatusText('正在分析场景...');
          } else if (p < 35) {
            setStatusText('正在构建3D模型...');
          } else if (p < 55) {
            setStatusText('正在计算光影...');
          } else if (p < 75) {
            setStatusText('正在渲染帧序列...');
          } else if (p < 95) {
            setStatusText('正在合成视频...');
          } else {
            setStatusText('即将完成...');
          }
        }
      );
      setProgress(100);
      if (blobUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = result.url.startsWith('blob:') ? result.url : null;
      setVideoUrl(result.url);
      setLastVideoRef(result.videoRef);
      setProgress(100);

      // 自动生成水印版本供普通下载使用
      setTimeout(async () => {
        try {
          const { VideoWatermarkUtils } = await import('../services/videoWatermarkService');
          const watermarkResult = await VideoWatermarkUtils.addWatermark(result.url);
          setWatermarkedVideoUrl(watermarkResult.objectUrl);
        } catch (error) {
          console.error('自动添加水印失败:', error);
        }
      }, 1000);

      // 扣积分
      setTimeout(async () => {
        try {
          const session = localStorage.getItem('architect-invite-session');
          if (!session) return;
          const sessionData = JSON.parse(session);
          const userId = sessionData.user_id || sessionData.email;
          const usageResult = await Ph8UsageService.getLatestUsage(userId);
          if (usageResult.success && usageResult.data) {
            const realCost = usageResult.data.total_tokens || 0;
            if (realCost > 0 && onConsumePoints) {
              await onConsumePoints(Math.ceil(realCost / 10));
            }
          }
        } catch (err) {
          console.error('获取PH8真实费用失败:', err);
        }
      }, 500);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert(`视频生成失败，请稍后重试`); // [安全修复] 不暴露原始错误信息
      }
    } finally {
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
      // ===== 服务端权限验证（双重校验：后端数据库 + 前端localStorage）=====
      try {
        const session = localStorage.getItem('architect-invite-session');
        let userId = '';
        if (session) {
          try { const sd = JSON.parse(session); userId = sd.user_id || sd.email || ''; } catch {}
        }
        const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:3001' : 'https://api.kbitai.com.cn';
        const checkRes = await fetch(`${apiBase}/api/usage/video-download/check`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            // [安全修复] 携带 session token，后端用于验证用户身份
            ...(session ? { 'X-Session-Token': Buffer.from(session).toString('base64') } : {})
          },
          body: JSON.stringify({ userId, type: 'pro', sessionToken: session ? Buffer.from(session).toString('base64') : '' })
        });
        const checkResult = await checkRes.json();
        if (!checkResult.allowed) {
          window.alert(checkResult.error === 'UPGRADE_NEEDED'
            ? (t.buttons.unlockOriginal || '升级 PRO/PLUS 解锁无水印下载')
            : checkResult.message || '权限不足，请升级套餐');
          return;
        }
        console.log('[Video Download] 服务端授权通过');
      } catch (serverErr) {
        console.warn('[Video Download] 后端验证失败，降级到本地:', serverErr);
        const limits = getDownloadLimits(effectiveTier as UserTier | 'dev');
        const currentCount = getTodayDownloadCount();
        if (limits.daily === 0) { window.alert(t.buttons.unlockOriginal); return; }
        if (currentCount >= limits.daily) { window.alert(`今日额度已用完 (${currentCount}/${limits.daily})`); return; }
      }

      const confirmed = window.confirm('【版权合规声明】本视频仅限个人/合法使用。\n确认下载无水印高清原片？');
      if (!confirmed) return;

      WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'pro' });
      incrementDownloadCount();

      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `Architect_Motion_PRO_${Date.now()}.mp4`;
      link.click();
    } else {
      WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'standard' });
      
      const confirmMessages: Record<Language, string> = {
        'zh-CN': "【标准下载】\n将为您生成带水印的视频版本。\n处理时间约需 10-30 秒，请耐心等待。\n\n确认下载带水印版本？",
        'en-US': "【Standard Download】\nA watermarked version will be generated for you.\nProcessing time is about 10-30 seconds, please wait.\n\nConfirm download watermarked version?",
        'ja-JP': "【スタンダードダウンロード】\n透かし付きバージョンを生成します。\n処理時間は10-30秒程度かかりますので、お待ちください。\n\n透かし付きバージョンをダウンロードしますか？",
        'ko-KR': "【표준 다운로드】\n워터마크가 있는 버전이 생성됩니다.\n처리 시간은 약 10-30초입니다. 기다려주세요.\n\n워터마크 버전 다운로드 확인?",
        'es-ES': "【Descarga Estándar】\nSe generará una versión con marca de agua.\nEl tiempo de procesamiento es de aproximadamente 10-30 segundos.\n\n¿Confirmar descarga de la versión con marca de agua?",
        'fr-FR': "【Téléchargement Standard】\nUne version avec filigrane sera générée pour vous.\nLe temps de traitement est d'environ 10-30 secondes.\n\nConfirmer le téléchargement de la version avec filigrane ?",
        'de-DE': "【Standard-Download】\nEs wird eine Version mit Wasserzeichen generiert.\nDie Verarbeitungszeit beträgt etwa 10-30 Sekunden.\n\nWatermark-Version herunterladen bestätigen?",
        'ru-RU': "【Стандартная загрузка】\nБудет сгенерирована версия с водяным знаком.\nВремя обработки около 10-30 секунд.\n\nПодтвердить загрузку версии с водяным знаком?",
      };
      const confirmed = window.confirm(confirmMessages[language]);
      if (!confirmed) return;
      
      try {
        setIsWatermarkProcessing(true);

        // 标准下载必须使用带水印的版本
        if (watermarkedVideoUrl) {
          // 使用预先生成的水印视频
          const link = document.createElement('a');
          link.href = watermarkedVideoUrl;
          link.download = `Architect_Motion_STD_${Date.now()}.mp4`;
          link.click();
        } else {
          // 动态生成水印视频
          const { VideoWatermarkUtils } = await import('../services/videoWatermarkService');
          const result = await VideoWatermarkUtils.addWatermark(
            videoUrl,
            '/public/LOGOkbitwater.png',
            (progress) => {
              console.log('水印处理进度:', progress);
            }
          );
          
          // 保存水印视频URL供后续使用
          setWatermarkedVideoUrl(result.objectUrl);
          
          // 下载带水印的视频
          const link = document.createElement('a');
          link.href = result.objectUrl;
          link.download = `Architect_Motion_STD_${Date.now()}.mp4`;
          link.click();
        }
      } catch (error) {
        console.error('水印处理失败:', error);
        window.alert('水印处理失败，将下载原视频');
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `Architect_Motion_STD_${Date.now()}.mp4`;
        link.click();
      } finally {
        setIsWatermarkProcessing(false);
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
            <input type="file" ref={videoInputRef} onChange={handleVideoUpload} accept="video/mp4,video/quicktime" multiple className="hidden" />

            {(selectedEngine === 'KbitVeo-standard' || selectedEngine === 'KbitVeo-pro') && (
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">参考视频 / Ref Video (Max 3 · MP4/MOV · 2–15s)</label>
                <div className="flex flex-wrap gap-2">
                  {referenceVideos.map((v, i) => (
                    <div key={i} className="relative w-20 h-14 rounded-lg overflow-hidden border border-white/10 bg-white/[0.03]">
                      <video src={v} className="w-full h-full object-cover" muted />
                      <button onClick={() => removeVideo(i)} className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded bg-black/60 text-white/70 hover:text-white">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                  {referenceVideos.length < 3 && (
                    <button onClick={() => videoInputRef.current?.click()} className="w-20 h-14 rounded-lg border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center gap-1 hover:border-white/20 hover:bg-white/[0.04] transition-all">
                      <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      <span className="text-[8px] text-white/20">添加视频</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">算力引擎 / Engine</label>
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setShowEngineDropdown(v => !v)}
                  className="w-full flex items-center justify-between bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm font-medium text-white/70 outline-none hover:border-white/20 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    <span>{capabilities.engines.find(e => e.id === selectedEngine)?.label}</span>
                    <span className="text-white/30 text-[11px]">{capabilities.engines.find(e => e.id === selectedEngine)?.desc}</span>
                  </span>
                  <ChevronDown size={14} className="text-white/30 shrink-0" />
                </button>
                {showEngineDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-[#1a1a2e] border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl">
                    {capabilities.engines.map((eng) => (
                      <button
                        key={eng.id}
                        type="button"
                        disabled={eng.isFrozen}
                        onClick={() => { setSelectedEngine(eng.id); setShowEngineDropdown(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${eng.isFrozen ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.06] cursor-pointer'} ${selectedEngine === eng.id ? 'bg-blue-500/10' : ''}`}
                      >
                        <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        <span className="text-sm font-medium text-white/80">{eng.label}</span>
                        <span className="text-[11px] text-white/30">{eng.desc}</span>
                        {eng.isFrozen && <span className="ml-auto text-[10px] text-white/30">开发中</span>}
                      </button>
                    ))}
                  </div>
                )}
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

            <button onClick={handleGenerate} disabled={isGenerating} className={`w-full py-4 rounded-xl font-medium text-sm transition-all active:scale-95 ${isGenerating ? 'bg-white/[0.04] border border-white/[0.06] text-white/50 cursor-not-allowed' : 'bg-blue-500/80 text-white hover:bg-blue-500'}`}>
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{progress}% - {statusText}</span>
                  <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                "执行分镜动态解算"
              )}
            </button>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center p-8 min-h-[500px] relative overflow-hidden">
            {videoUrl ? (
             <div className="w-full flex flex-col items-center gap-4 animate-in fade-in duration-300">
                <div className={`relative rounded-xl overflow-hidden border border-white/10 ${aspectRatio === '9:16' ? 'h-[60vh]' : 'w-full'} shadow-2xl`}>
                  <video 
  ref={videoRef}
  src={previewVideoSrc} 
  controls 
  autoPlay 
  loop 
  playsInline
  className="w-full h-full object-cover" 
  disablePictureInPicture={false}
/>
                  {/* 水印叠加层：仅付费用户可见（品牌展示用，非安全防护） */}
                  {shouldShowWatermarkOverlay && (
                  <div className="absolute bottom-4 right-4 w-20 h-auto opacity-60 pointer-events-none z-10">
                    <img src="/public/LOGOkbitwater.png" className="w-full h-full object-contain" />
                  </div>
                  )}
                  {/* 非付费用户：显示"升级解锁无水印"提示 */}
                  {!isDeveloper && videoUrl && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-md text-[10px] text-white/60 font-medium pointer-events-none select-none flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      预览版本 · 升级解锁高清原片
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between w-full">
                  <div className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                    {t.tabs.video} {t.buttons.generate}
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all active:scale-95 ${isGenerating ? 'bg-white/8 text-white/40 cursor-not-allowed border border-white/10' : 'bg-gradient-to-r from-blue-500/30 to-cyan-500/30 border border-blue-500/40 text-blue-300 hover:from-blue-500/40 hover:to-cyan-500/40 hover:text-blue-200'}`}
                    >
                      <svg className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {isGenerating ? '生成中...' : t.buttons.regenerate}
                    </button>
                    <button 
                      onClick={(e) => handleDownload(e, false)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold border border-white/20 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all active:scale-95"
                      title="带水印下载"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {t.buttons.stdDownload || '带水印'}
                    </button>
                    <button 
                      onClick={(e) => handleDownload(e, true)}
                      disabled={!isDeveloper}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all active:scale-95 ${isDeveloper ? 'border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300' : 'border border-white/10 bg-white/5 text-white/40 cursor-not-allowed'}`}
                      title={isDeveloper ? '无水印下载' : '升级 PRO/PLUS 解锁无水印下载'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
                      </svg>
                      {isDeveloper ? (t.buttons.originalDownload || '无水印') : '无水印'}
                    </button>
                  </div>
                </div>
                {isWatermarkProcessing && (
                  <div className="text-white/40 text-[10px]">
                    {t.parameters.upscaling.replace('{size}', 'WM')}
                  </div>
                )}
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
