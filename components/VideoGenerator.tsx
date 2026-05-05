
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { GeminiService, DEFAULT_SYSTEM_PRESETS } from '../services/geminiService.ts';
import { WatermarkUtils } from '../services/watermarkService.ts';
import { Ph8UsageService } from '../services/ph8UsageService.ts';
import { videoBlobService } from '../services/videoBlobService.ts';
import { UserTier, Language } from '../types.ts';
import { getTranslation } from '../i18n/locales.ts';

interface VideoGeneratorProps {
  instructions: typeof DEFAULT_SYSTEM_PRESETS;
  onReset: () => void;
  onBack?: () => void;
  onVideoGenerated?: (result: { url: string; prompt: string }) => void;
  fontSize?: number;
  userTier?: UserTier;
  points: { daily: number; purchased: number; bonus?: number };
  onConsumePoints: (opts: { amount: number; feature?: string; modelId?: string }) => Promise<boolean>;
  useThirdPartyGateway?: boolean;
  isDeveloperMode?: boolean;
  language?: Language;
  onBusyStateChange?: (busy: boolean) => void;
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

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ instructions, onReset, onBack, onVideoGenerated, fontSize = 18, userTier = 'free', points, onConsumePoints, useThirdPartyGateway = false, isDeveloperMode = false, language = 'zh-CN', onBusyStateChange }) => {
  const t = getTranslation(language);
  const isDeveloper = userTier === 'pro' || userTier === 'plus' || isDeveloperMode;
  const effectiveTier = (isDeveloperMode ? 'dev' : userTier) as UserTier | 'dev';
  const [prompt, setPrompt] = useState('');
  const [assets, setAssets] = useState<string[]>([]);
  const [originalAssets, setOriginalAssets] = useState<string[]>([]); // 裁剪前原始底图
  const [lockedAssets, setLockedAssets] = useState<boolean[]>([]); // 每张底图独立锁定状态
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [selectedEngine, setSelectedEngine] = useState<string>('SeeDance-1.0PF');

  // 视频生成参数（API 可控）
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');
  const [videoDuration, setVideoDuration] = useState<number>(-1);
  const [cameraFixed, setCameraFixed] = useState<boolean>(false);
  const [videoSeed, setVideoSeed] = useState<number | null>(null);

  const engineToModelId: Record<string, string> = {
    'SeeDance-1.0PF': 'doubao-seedance-1-0-pro-fast-251015',
    'SeeDance-1.5': 'doubao-seedance-1-5-pro-251215',
    'SeeDance-2.0F': 'doubao-seedance-2-0-fast',
    'SeeDance-2.0': 'doubao-seedance-2-0',
  };
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [previousVideoUrl, setPreviousVideoUrl] = useState<string | null>(null);
  const [watermarkedVideoUrl, setWatermarkedVideoUrl] = useState<string | null>(null);
  const [isWatermarkProcessing, setIsWatermarkProcessing] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false); // [Bug修复] 补充缺失的状态声明
  const [lastVideoRef, setLastVideoRef] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('解算引擎运行中');
  const [referenceVideos, setReferenceVideos] = useState<string[]>([]);

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

  // 更新导航栏模型状态
  useEffect(() => {
    onBusyStateChange?.(isGenerating);
  }, [isGenerating, onBusyStateChange]);

  // [Bug修复] 依赖 referenceVideos，确保 cleanup 捕获最新值释放 Blob URL，防止内存泄漏
  useEffect(() => {
    const currentUrls = [...referenceVideos];
    return () => { currentUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [referenceVideos]);

  // 预加载 FFmpeg 和 Logo 以加快水印处理速度（动态导入，避免WASM加载失败导致组件崩溃）
  useEffect(() => {
    const loadResourcesAsync = async () => {
      try {
        const { VideoWatermarkUtils: VWU } = await import('../services/videoWatermarkService');
        await Promise.all([
          VWU.loadFFmpeg(),
          VWU.preloadLogo('/public/LOGOkbitwater.png')
        ]);
        console.log('[资源预加载] FFmpeg 和 Logo 预加载完成');
      } catch (e) {
        console.warn('[资源预加载] FFmpeg/WASM 加载失败(非致命):', e?.message || e);
      }
    };
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

  const supportedDurations = useMemo(() => {
    const durStr = currentEngineDetails.duration || '5-15s';
    if (durStr.includes('-')) {
      const match = durStr.match(/(\d+)/);
      if (match) return [parseInt(match[1])];
    }
    return durStr.split(/\s*\/\s*/).map(s => parseInt(s.replace(/[^0-9]/g, ''))).filter(n => n > 0);
  }, [currentEngineDetails]);

  const autoCalculatedDuration = useMemo(() => {
    if (supportedDurations.length === 0) return 5;
    if (prompt.length < 20) return Math.min(supportedDurations[0], 5);
    if (assets.length >= 3) return supportedDurations[supportedDurations.length - 1] || 10;
    const mid = Math.floor(supportedDurations.length / 2);
    return supportedDurations[mid] || 8;
  }, [supportedDurations, prompt.length, assets.length]);

  const displayDuration = videoDuration === -1 ? autoCalculatedDuration : videoDuration;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setPrompt(data.prompt || '');
        setAssets(data.assets || []);
        setOriginalAssets(data.originalAssets || data.assets || []); // 兼容旧数据
        setLockedAssets(data.lockedAssets || (data.assets || []).map(() => true)); // 兼容旧数据，默认全锁
        setAspectRatio(data.aspectRatio || '16:9');
        if (data.selectedEngine) setSelectedEngine(data.selectedEngine);
        if (data.videoResolution) setVideoResolution(data.videoResolution);
        if (typeof data.videoDuration === 'number') setVideoDuration(data.videoDuration);
        if (typeof data.cameraFixed === 'boolean') setCameraFixed(data.cameraFixed);
        if (data.videoSeed !== undefined) setVideoSeed(data.videoSeed);

        // 恢复视频 URL（如果是 blob URL，需要检查是否仍然有效）
        if (data.videoUrl) {
          // 检查 blob URL 是否仍然有效（通过 videoBlobService）
          if (data.videoUrl.startsWith('blob:')) {
            const isValid = videoBlobService.ensureValid(data.videoUrl) !== null;
            if (isValid) {
              setVideoUrl(data.videoUrl);
            } else {
              console.warn('[VideoGenerator] Blob URL 已失效，尝试使用 videoRef 重新获取');
              // 如果有 videoRef，尝试从服务器重新获取视频
              if (data.lastVideoRef) {
                console.log('[VideoGenerator] 尝试重新获取视频:', data.lastVideoRef);
                // 标记需要重新加载
                sessionStorage.setItem('RELOAD_VIDEO_REF', data.lastVideoRef);
                // 清除失效的 videoUrl
                const newData = { ...data };
                delete newData.videoUrl;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
              } else {
                console.warn('[VideoGenerator] Blob URL 已失效且无 videoRef，无法恢复');
                // 清除失效的 videoUrl
                const newData = { ...data };
                delete newData.videoUrl;
                delete newData.lastVideoRef;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
              }
            }
          } else {
            // 非 blob URL（如服务器 URL）直接恢复
            setVideoUrl(data.videoUrl);
          }
        }
        if (data.lastVideoRef) setLastVideoRef(data.lastVideoRef);

        // 恢复水印视频 URL
        if (data.watermarkedVideoUrl) {
          if (data.watermarkedVideoUrl.startsWith('blob:')) {
            const isValid = videoBlobService.ensureValid(data.watermarkedVideoUrl) !== null;
            if (isValid) {
              setWatermarkedVideoUrl(data.watermarkedVideoUrl);
            }
          } else {
            setWatermarkedVideoUrl(data.watermarkedVideoUrl);
          }
        }
      } catch (e) { console.error("Restore workbench failed", e); }
    }

    // 检查是否需要重新加载视频（blob URL 失效后）
    const reloadVideoRef = sessionStorage.getItem('RELOAD_VIDEO_REF');
    if (reloadVideoRef && !videoUrl) {
      console.log('[VideoGenerator] 检测到需要重新加载视频:', reloadVideoRef);
      // 设置加载状态
      setIsGenerating(true);
      setProgress(90);
      setStatusText('正在恢复视频...');
      
      // 调用重新获取视频的函数
      restoreVideoFromRef(reloadVideoRef);
    }
  }, []);

  // 从 videoRef 重新获取视频
  const restoreVideoFromRef = async (videoRef: string) => {
    try {
      console.log('[VideoGenerator] 开始重新获取视频:', videoRef);
      
      // 使用 PH8 网关获取视频
      const proxiedUrl = `${window.location.origin}/api/ph8-openai/videos/${videoRef}`;
      console.log('[VideoGenerator] 请求URL:', proxiedUrl);
      
      const response = await fetch(proxiedUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const statusData = await response.json();
      console.log('[VideoGenerator] 获取视频状态:', statusData);
      
      // 尝试从响应中获取视频 URL
      let videoUrl = statusData.url || 
                     statusData.video_url || 
                     statusData.content_url ||
                     statusData.output?.url ||
                     statusData.data?.url;
      
      if (videoUrl) {
        console.log('[VideoGenerator] 成功恢复视频:', videoUrl);
        setVideoUrl(videoUrl);
        // 如果是 blob URL，标记为持久化
        if (videoUrl.startsWith('blob:')) {
          videoBlobService.markAsPersistent(videoUrl);
        }
      } else {
        // 尝试下载内容
        console.log('[VideoGenerator] 尝试下载视频内容...');
        const contentUrl = `${window.location.origin}/api/ph8/videos/${videoRef}/content`;
        const contentResponse = await fetch(contentUrl);
        if (contentResponse.ok) {
          const arrayBuffer = await contentResponse.arrayBuffer();
          const contentType = contentResponse.headers.get('content-type') || 'video/mp4';
          const blob = new Blob([arrayBuffer], { type: contentType });
          const objectUrl = URL.createObjectURL(blob);
          videoBlobService.markAsPersistent(objectUrl);
          setVideoUrl(objectUrl);
          console.log('[VideoGenerator] 成功下载并恢复视频:', objectUrl);
        } else {
          throw new Error('无法获取视频内容');
        }
      }
      
      // 清除重新加载标记
      sessionStorage.removeItem('RELOAD_VIDEO_REF');
    } catch (error) {
      console.error('[VideoGenerator] 重新获取视频失败:', error);
      sessionStorage.removeItem('RELOAD_VIDEO_REF');
    } finally {
      setIsGenerating(false);
      setProgress(0);
      setStatusText('就绪');
    }
  };

  useEffect(() => {
    if (!currentEngineDetails.supportedRatios.includes(aspectRatio)) {
      setAspectRatio(currentEngineDetails.supportedRatios[0]);
    }
    // 确保当前选中的引擎在可用列表中，如果不在则重置为第一个可用引擎
    if (!capabilities.engines.find(e => e.id === selectedEngine)) {
      setSelectedEngine(capabilities.engines[0].id);
    }
  }, [capabilities, aspectRatio, selectedEngine, currentEngineDetails]);

  // 当视频比例改变时，自动将所有已上传底图重新裁剪到新比例
  useEffect(() => {
    if (originalAssets.length === 0) return;
    let cancelled = false;
    const recrop = async () => {
      const cropped = await Promise.all(
        originalAssets.map(orig => GeminiService.cropImageToRatio(orig, aspectRatio))
      );
      if (!cancelled) setAssets(cropped);
    };
    recrop();
    return () => { cancelled = true; };
  }, [aspectRatio]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const data = { prompt, assets, originalAssets, lockedAssets, aspectRatio, selectedEngine, videoUrl, watermarkedVideoUrl, lastVideoRef, videoResolution, videoDuration, cameraFixed, videoSeed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // 捕获 QuotaExceededError 溢出错误，防止崩溃
      console.warn("LocalStorage Quota Exceeded. State maintained in RAM only.");
    }
  }, [prompt, assets, aspectRatio, selectedEngine, videoUrl, watermarkedVideoUrl, lastVideoRef]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      const newOriginalAssets = [...originalAssets];
      const newAssets = [...assets];
      for (const file of files) {
        if (newOriginalAssets.length >= 9) break;
        const dataUrl = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.readAsDataURL(file);
        });
        // 先压缩到 1024（保留原始比例，存入 originalAssets）
        const compressed = await GeminiService.compressImage(dataUrl);
        newOriginalAssets.push(compressed);
        // 再按当前视频比例裁剪（存入 assets，用于发送 API）
        const cropped = await GeminiService.cropImageToRatio(compressed, aspectRatio);
        newAssets.push(cropped);
      }
      setOriginalAssets(newOriginalAssets);
      setAssets(newAssets);
      setLockedAssets(prev => [...prev, ...newOriginalAssets.map(() => true)]); // 新上传默认锁定
      setLastVideoRef(null);
    }
    e.target.value = '';
  };

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
    setOriginalAssets(prev => prev.filter((_, i) => i !== index));
    setLockedAssets(prev => prev.filter((_, i) => i !== index));
    setLastVideoRef(null);
  };

  // 切换单张底图的锁定状态
  const toggleAssetLock = (index: number) => {
    setLockedAssets(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  // Token 到积分的换算比例：1 积分 = 100 token
  const TOKENS_PER_POINT = 100;

  // 计算视频生成成本（按秒数估算）
  const calculateVideoCost = () => {
    // 视频生成成本较高，5秒视频约 20000-30000 token
    // 按 25000 token 计算 = 167 积分
    return Math.ceil(25000 / TOKENS_PER_POINT); // 约 167 积分
  };

  // 撤销功能：回退到上一次生成的视频
  const handleUndo = () => {
    if (!previousVideoUrl) return;
    // 交换当前视频和上一次视频
    const temp = videoUrl;
    setVideoUrl(previousVideoUrl);
    setPreviousVideoUrl(temp);
    setWatermarkedVideoUrl(null);
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
      return;
    }

    // [前置余额检查] 非开发者模式且使用第三方网关时，先检查积分余额
    if (!isDeveloperMode && useThirdPartyGateway && onConsumePoints) {
      // 视频PH8标准费用: ≤10s=42分, >10s=420分
      const estimatedCost = (displayDuration > 0 ? displayDuration : 5) <= 10 ? 42 : 420;
      const currentBalance = points?.daily_balance ?? points?.total_points ?? 0;
      
      if (currentBalance < estimatedCost) {
        window.alert(`⚠️ 积分余额不足\n\n视频生成需要 ${estimatedCost} 积分\n当前可用余额: ${currentBalance} 积分\n\n每日免费额度: ${points?.daily_quota || 200} 次\n今日已用: ${points?.daily_used || 0} 次\n\n请明日重试或联系管理员充值`);
        return; // 拦截，不调用API，不扣费
      }
    }

    // 视频生成走 PH8 后端代理，不需要前端检查 API Key

    // 保存当前视频作为上一次版本，用于撤销
    if (videoUrl) {
      setPreviousVideoUrl(videoUrl);
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
        },
        { resolution: videoResolution, duration: displayDuration, camerafixed: cameraFixed, seed: videoSeed }
      );
      setProgress(100);
      
      // [关键] 先显示视频结果给用户，确保用户一定看到成果
      blobUrlRef.current = result.url.startsWith('blob:') ? result.url : null;
      if (result.url.startsWith('blob:')) {
        videoBlobService.markAsPersistent(result.url);
      }
      setVideoUrl(result.url);
      setLastVideoRef(result.videoRef);
      
      // 通知父组件写入聊天气泡（必须在setVideoUrl之后）
      if (onVideoGenerated) {
        try { onVideoGenerated({ url: result.url, prompt: finalPrompt }); } catch(e) { console.warn('[VideoGenerator] onVideoGenerated回调失败(非致命):', e); }
      }
      
      console.log('[VideoGenerator] ✅ 视频生成成功，已显示给用户');

      // 水印处理：完全非致命，失败不影响已显示的视频
      setTimeout(async () => {
        try {
          const { VideoWatermarkUtils } = await import('../services/videoWatermarkService');
          const watermarkResult = await VideoWatermarkUtils.addWatermark(result.url);
          if (watermarkResult.objectUrl.startsWith('blob:')) {
            videoBlobService.markAsPersistent(watermarkResult.objectUrl);
          }
          setWatermarkedVideoUrl(watermarkResult.objectUrl);
          console.log('[VideoGenerator] ✅ 水印添加成功');
        } catch (error) {
          // 水印失败 = 仅影响无水印下载，视频本身已正常显示
          console.warn('[VideoGenerator] ⚠️ 水印添加失败(非致命，视频已正常显示):', error?.message || error);
          setWatermarkedVideoUrl(null); // 标记无水印版本
        }
      }, 1000);

      // 积分扣除由 ConversationView.deductPh8Cost 统一处理（从PH8账单读取actual_cost×1000）
    } catch (err: any) {
      console.error('[VideoGenerator] ❌ 视频生成失败:', err?.message || err);
      console.error('[VideoGenerator] 错误详情:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      
      if (err.name === 'AbortError') {
        console.log('[VideoGenerator] 用户主动取消');
      } else {
        const errorHint = err?.message || err?.error?.message || '未知错误';
        const isNetwork = errorHint.includes('fetch') || errorHint.includes('network') || errorHint.includes('timeout');
        const isPH8 = errorHint.includes('ph8') || errorHint.includes('502') || errorHint.includes('503');
        
        let detailMsg = '';
        if (isNetwork) detailMsg = '\n\n可能原因：网络连接不稳定，请检查网络后重试';
        else if (isPH8) detailMsg = '\n\n可能原因：视频服务暂时繁忙，请稍后重试';
        else if (errorHint.includes('Watermark') || errorHint.includes('watermark')) detailMsg = '\n\n注意：视频已生成成功，仅水印处理失败';
        else if (errorHint.includes('balance') || errorHint.includes('积分')) detailMsg = '\n\n可能原因：积分余额不足';
        
        alert(`视频生成失败：${errorHint}${detailMsg}\n\n详细信息请查看 F12 控制台`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLocalReset = () => {
    if (window.confirm("确定要重置当前导播台吗？")) {
      localStorage.removeItem(STORAGE_KEY);
      setAssets([]);
      setOriginalAssets([]);
      setLockedAssets([]);
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

  const AssetSlot = ({ current, isLocked, onToggleLock, onUpload, index, style, onRemove }: any) => {
    const displayRatio = (current && isLocked) ? aspectRatio : '16:9';
    return (
    <div
      style={style}
      className={`w-full aspect-square rounded-xl border ${current ? 'border-blue-500/30' : 'border-white/[0.06]'} bg-white/[0.03] flex flex-col overflow-hidden transition-all shrink-0`}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.05]">
        <span className="text-[9px] font-medium text-white/30 uppercase tracking-widest">{index !== undefined ? `分镜 ${index + 1}` : '待上传'}</span>
      </div>
      <div className={`flex-1 relative flex items-center justify-center group ${onUpload ? 'cursor-pointer' : ''}`} onClick={onUpload || undefined}>
        {current ? (
          <>
            <img src={current} className="w-full h-full object-cover" />
            {/* 悬停时显示操作按钮 */}
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                {onRemove && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-600/80 text-white/90 border border-transparent hover:bg-red-500 hover:text-white transition-all"
                    title="移除底图"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {onToggleLock && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleLock(index); }} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
                      isLocked 
                        ? 'bg-blue-600 text-white border-transparent shadow-lg' 
                        : 'bg-slate-800/80 text-white/60 border-transparent hover:text-white hover:bg-slate-700/80'
                    }`}
                    title={isLocked ? '已锁定 - 跟随比例裁剪' : '未锁定 - 默认 16:9'}
                  >
                    {isLocked ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M8 11V7a4 4 0 0 1 8 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                    )}
                  </button>
                )}
              </div>
            </div>
            {/* 锁定指示器：右上角小绿点 */}
            {isLocked && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full shadow-lg animate-pulse" />}
            {/* 比例标签：锁闭显示当前比例，锁开显示默认 16:9 */}
            <div className={`absolute bottom-1.5 left-1.5 px-1.5 py-0.5 backdrop-blur-sm rounded text-[8px] font-mono font-semibold select-none pointer-events-none transition-colors ${
              isLocked ? 'bg-black/60 text-blue-400/90' : 'bg-white/10 text-white/40'
            }`}>
              {displayRatio}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center opacity-20 group-hover:opacity-50 transition-opacity">
            <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="text-[8px] font-medium uppercase tracking-wide">添加</span>
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <div className="w-full h-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button type="button" onClick={onBack}
              className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl
                bg-white/[0.03] border border-white/[0.08] text-white/35
                hover:text-blue-400 hover:bg-blue-500/8 hover:border-blue-500/25
                transition-all duration-200 active:scale-95"
              title="返回对话">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="space-y-0.5">
            <h3 className="text-xl font-semibold text-white/90">动态漫游导演 <span className="text-white/30 font-normal text-base">Motion Director</span></h3>
            <p className="text-[10px] font-medium text-white/25 uppercase tracking-widest">Sequence-Based Spatial Walkthrough Engine</p>
          </div>
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
                    isLocked={lockedAssets[i] ?? true}
                    onToggleLock={toggleAssetLock}
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

            {(selectedEngine === 'SeeDance-2.0' || selectedEngine === 'SeeDance-2.0F') && (
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
                <span className="text-[11px] font-medium text-blue-400">
                  {videoDuration === -1 ? `Auto (~${autoCalculatedDuration}s)` : `${displayDuration}s`}
                  <span className="text-white/25 ml-1.5">| {currentEngineDetails.duration}</span>
                </span>
              </div>

              {/* 比例选择器：仅显示当前引擎支持的比例 */}
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">画面比例 / Aspect Ratio</label>
                <div className="flex flex-wrap gap-2">
                  {currentEngineDetails.supportedRatios.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all active:scale-95 ${
                        aspectRatio === ratio
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm shadow-blue-500/10'
                          : 'bg-white/[0.03] text-white/40 border border-white/[0.08] hover:text-white/70 hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
              </div>

              {/* ===== 高级参数面板（API 可控）===== */}
              <div className="space-y-3 pt-1">
                <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">高级参数 / Advanced</label>
                <div className="grid grid-cols-2 gap-3">
                  {/* 分辨率 */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-white/25 font-medium uppercase tracking-wider">清晰度</span>
                    <div className="flex gap-1.5">
                      {(['720p', '1080p'] as const).map(r => (
                        <button key={r} type="button" onClick={() => setVideoResolution(r)}
                          className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all active:scale-95 ${
                            videoResolution === r
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
                              : 'bg-white/[0.03] text-white/40 border border-white/[0.08] hover:text-white/70 hover:border-white/20'
                          }`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 时长 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/25 font-medium uppercase tracking-wider">时长</span>
                      {videoDuration === -1 && (
                        <span className="text-[10px] font-mono text-purple-400/80">≈ {autoCalculatedDuration}s</span>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {supportedDurations.map(d => (
                        <button key={d} type="button" onClick={() => setVideoDuration(d)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all active:scale-95 ${
                            videoDuration === d
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/40'
                              : 'bg-white/[0.03] text-white/40 border border-white/[0.08] hover:text-white/70 hover:border-white/20'
                          }`}>
                          {d}s
                        </button>
                      ))}
                      <button type="button" onClick={() => setVideoDuration(-1)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                          videoDuration === -1
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/40'
                            : 'bg-white/[0.03] text-white/40 border border-white/[0.08] hover:text-white/70 hover:border-white/20'
                        }`}>
                        Auto
                      </button>
                    </div>
                  </div>
                </div>
                {/* 镜头固定 + 种子值：单行排列 */}
                <div className="flex items-center gap-4 px-1">
                  {/* 镜头固定 Toggle */}
                  <button type="button" onClick={() => setCameraFixed(v => !v)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all active:scale-95 ${
                      cameraFixed
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-white/[0.03] text-white/40 border border-white/[0.08] hover:text-white/60 hover:border-white/15'
                    }`}>
                    {/* Toggle 指示器 */}
                    <span className={`relative w-7 h-4 rounded-full transition-colors ${cameraFixed ? 'bg-amber-500/50' : 'bg-white/15'}`}>
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${cameraFixed ? 'left-3.5' : 'left-0.5'}`} />
                    </span>
                    定镜模式
                  </button>
                  {/* 种子值输入 */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[9px] text-white/25 font-medium uppercase tracking-wider shrink-0">种子</span>
                    <input type="number" value={videoSeed ?? ''} onChange={(e) => {
                      const v = e.target.value;
                      setVideoSeed(v === '' ? null : parseInt(v, 10));
                    }} placeholder="随机"
                      className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white/70 outline-none focus:border-white/20 placeholder-white/20 transition-all" />
                    {videoSeed !== null && (
                      <button type="button" onClick={() => setVideoSeed(null)} className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
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

            <button onClick={handleGenerate} className={`w-full py-4 rounded-xl font-medium text-sm transition-all active:scale-95 ${isGenerating ? 'bg-red-500/80 text-white hover:bg-red-500 border border-red-500/40' : 'bg-blue-500/80 text-white hover:bg-blue-500'}`}>
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>取消生成</span>
                  <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                "执行分镜动态解算"
              )}
            </button>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center p-8 min-h-[500px] relative overflow-hidden">
            {/* 生成中状态 */}
            {isGenerating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20 animate-in fade-in">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
                <p className="text-white/80 text-sm font-medium mb-2">{statusText}</p>
                <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-white/50 text-xs mt-2">{progress}%</p>
                <button
                  onClick={handleGenerate}
                  className="mt-4 px-6 py-2 bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-all active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  取消生成
                </button>
              </div>
            )}
            
            {videoUrl ? (
             <div className="w-full flex flex-col items-center gap-4 animate-in fade-in duration-300">
                <div className={`relative rounded-xl overflow-hidden border border-white/10 ${aspectRatio === '9:16' ? 'h-[60vh]' : 'w-full'} shadow-2xl`}>
                  <video 
  ref={videoRef}
  src={previewVideoSrc} 
  {...(isDeveloper ? { controls: true } : { controls: false, autoPlay: true, loop: true, muted: true })}
  playsInline
  className={`w-full h-full object-cover ${isDeveloper ? '' : 'select-none'}`}
  style={{ pointerEvents: isDeveloper ? 'auto' : 'none' }}
  disablePictureInPicture={!isDeveloper}
  onContextMenu={(e) => { if (!isDeveloper) e.preventDefault(); }}
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
                    {/* 撤销按钮 */}
                    <button 
                      onClick={handleUndo}
                      disabled={!previousVideoUrl}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all active:scale-95 ${previousVideoUrl ? 'bg-white/[0.08] border border-white/15 text-white/60 hover:bg-white/15 hover:text-white/80' : 'bg-white/[0.03] border border-white/[0.06] text-white/20 cursor-not-allowed'}`}
                      title="回退上一版本"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      回退
                    </button>
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
             <div className="flex flex-col items-center text-center opacity-30 select-none">
                <div className="relative mb-6">
                  <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={0.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                </div>
                <p className="text-sm font-medium text-white/50">等待生成</p>
                <p className="text-xs text-white/30 mt-2">上传底图后点击"执行分镜动态解算"</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
