
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GeminiService, ImageGenerationConfig, DEFAULT_SYSTEM_PRESETS } from '../services/geminiService.ts';
import { CustomModel, Point, Stroke, HistoryItem, CreativeDomain, UserTier, Language } from '../types.ts';
import { getTranslation } from '../i18n/locales.ts';
import { WatermarkUtils } from '../services/watermarkService.ts';
import { Ph8UsageService } from '../services/ph8UsageService.ts';

interface ImageGeneratorProps {
  currentPrompt: string;
  onImageGenerated?: (item: HistoryItem) => void;
  onReset?: () => void;
  history: HistoryItem[];
  instructions?: typeof DEFAULT_SYSTEM_PRESETS;
  fontSize?: number;
  modelConfig: CustomModel;
  onBusyStateChange?: (busy: boolean) => void;
  domain: CreativeDomain;
  userTier?: UserTier;
  points: { daily: number; purchased: number };
  onConsumePoints: (amount: number) => Promise<boolean>;
  useThirdPartyGateway?: boolean;
  language?: Language;
}

type UploadTarget = 'BASE' | 'SLOT_A' | 'SLOT_B' | 'SLOT_C';
type MarkingContext = 'A' | 'B' | 'INPAINT';

const PRESET_COLORS = [
  { name: '默认遮罩', value: '#FFFFFF' },
  { name: '区域 red', value: '#FF0000' },
  { name: '区域 green', value: '#00FF00' },
  { name: '区域 blue', value: '#0000FF' },
  { name: '区域 yellow', value: '#FFFF00' },
  { name: '区域 cyan', value: '#00FFFF' },
];

const WORKSHOP_STATE_KEY = 'architect-workshop-state-v1';

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ currentPrompt, onImageGenerated, onReset, history, instructions, fontSize = 15, modelConfig, onBusyStateChange, domain, userTier = 'free', points, onConsumePoints, useThirdPartyGateway, language = 'zh-CN' }) => {
  const t = getTranslation(language);
  const isDeveloper = userTier === 'pro' || userTier === 'plus';
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [watermarkedImages, setWatermarkedImages] = useState<string[]>([]);
  const [previousImages, setPreviousImages] = useState<string[]>([]);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(null);
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([]);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<number | null>(null);
  const [isMainImageHovered, setIsMainImageHovered] = useState(false);
  const [isCompositeMode, setIsCompositeMode] = useState(false);
  
  const [customRatioW, setCustomRatioW] = useState<number>(1);
  const [customRatioH, setCustomRatioH] = useState<number>(1);
  const [lockSource, setLockSource] = useState<'A' | 'B' | null>(null);
  const [lockedIndices, setLockedIndices] = useState<number[]>([]); 
  const [activePreset, setActivePreset] = useState<string>("1:1");

  const [config, setConfig] = useState<ImageGenerationConfig>({ aspectRatio: "1:1", imageSize: "1K", modelTier: "FAST", imageCount: 1, temperature: 1.0, top_p: 0.95 });
  // 强制单图模式
  const effectiveImageCount = 1;
  
  const [baseRefs, setBaseRefs] = useState<string[]>([]);
  const [baseRefsOriginalSizes, setBaseRefsOriginalSizes] = useState<{width: number, height: number}[]>([]);
  const [slotARefs, setSlotARefs] = useState<string[]>([]); 
  const [slotBRefs, setSlotBRefs] = useState<string[]>([]); 
  const [styleRefs, setStyleRefs] = useState<string[]>([]); 
  
  const [maskRefA, setMaskRefA] = useState<string | null>(null);
  const [maskRefB, setMaskRefB] = useState<string | null>(null);
  const [inpaintPrompt, setInpaintPrompt] = useState('');

  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [markingTarget, setMarkingTarget] = useState<MarkingContext>('B');
  const [brushSize, setBrushSize] = useState(40); 
  const [activeColor, setActiveColor] = useState('#FFFFFF');
  const [markingTool, setMarkingTool] = useState<'brush' | 'rect' | 'poly'>('brush');
  
  const [backupStrokes, setBackupStrokes] = useState<Stroke[]>([]);
  const [backupInpaintPrompt, setBackupInpaintPrompt] = useState('');
  
  const [upscaleDialog, setUpscaleDialog] = useState<{
    show: boolean;
    image: string | null;
    width: number;
    height: number;
    options: ('2K' | '4K')[];
    tier: 'FAST' | 'QUALITY';
  }>({ show: false, image: null, width: 0, height: 0, options: [], tier: 'FAST' });

  const [strokesMap, setStrokesMap] = useState<Record<MarkingContext, Stroke[]>>({
    A: [], B: [], INPAINT: []
  });
  const [currentStroke, setCurrentStroke] = useState<Point[] | null>(null);
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const [rectStart, setRectStart] = useState<Point | null>(null);
  const [rectEnd, setRectEnd] = useState<Point | null>(null);

  const [isMidStroke, setIsMidStroke] = useState(false);
  const [isRightDragging, setIsRightDragging] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState<Point | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const [uploadTarget, setUploadTarget] = useState<UploadTarget>('BASE');
  const [imgNaturalSize, setImgNaturalSize] = useState<{w: number, h: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const markCanvasRef = useRef<HTMLCanvasElement>(null);
  const markImageRef = useRef<HTMLImageElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mainImageRef = useRef<HTMLImageElement>(null);

  const themeColor = domain === 'architecture' ? 'indigo' : domain === 'product' ? 'slate' : domain === 'art' ? 'amber' : 'rose';

  const redrawCanvas = useCallback((isExport = false) => {
    const canvas = markCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = isExport ? 1.0 : 0.60;

    const drawStroke = (s: Stroke) => {
      if (s.points.length < 1) return;
      ctx.fillStyle = s.color;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.tool === 'brush') {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      } else if (s.tool === 'rect') {
        const p1 = s.points[0];
        const p2 = s.points[1];
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      } else if (s.tool === 'poly') {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.closePath();
        ctx.fill();
      }
    };

    const historyStrokes = strokesMap[markingTarget] || [];
    historyStrokes.forEach(drawStroke);

    if (markingTool === 'brush' && currentStroke) {
      drawStroke({ points: currentStroke, brushSize, color: activeColor, tool: 'brush' });
    } else if (markingTool === 'rect' && rectStart && rectEnd) {
      drawStroke({ points: [rectStart, rectEnd], brushSize: 0, color: activeColor, tool: 'rect' });
    } else if (markingTool === 'poly' && polyPoints.length > 0) {
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
      for (let i = 1; i < polyPoints.length; i++) ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!isExport) {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 1.0;
        polyPoints.forEach(p => {
          ctx.fillStyle = activeColor;
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = prevAlpha;
      }
    }
    ctx.globalAlpha = 1.0; 
  }, [strokesMap, markingTarget, currentStroke, brushSize, activeColor, markingTool, rectStart, rectEnd, polyPoints]);

  useEffect(() => {
    if (isMarkingMode) {
      const timer = setTimeout(() => {
        const img = markImageRef.current;
        const canvas = markCanvasRef.current;
        if (img && canvas) { 
          canvas.width = img.naturalWidth; 
          canvas.height = img.naturalHeight; 
          redrawCanvas(); 
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isMarkingMode, redrawCanvas]);

  useEffect(() => {
    const currentImage = generatedImages.length > 0 ? (hoveredImageIndex !== null ? generatedImages[hoveredImageIndex] : generatedImages[0]) : null;
    if (currentImage && mainImageRef.current) {
      const img = mainImageRef.current;
      const updateSize = () => {
        setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      };
      if (img.complete) updateSize();
      else img.onload = updateSize;
    } else {
      setImgNaturalSize(null);
    }
  }, [generatedImages, hoveredImageIndex]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!isMarkingMode) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.5), 10);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const imgX = (mouseX - pan.x) / zoom;
      const imgY = (mouseY - pan.y) / zoom;
      setPan({ x: mouseX - imgX * newZoom, y: mouseY - imgY * newZoom });
      setZoom(newZoom);
    }
  };

  const getCanvasCoords = (e: any) => {
    const canvas = markCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const commitBrushStroke = (points: Point[]) => {
    if (!points || points.length < 1) return;
    setStrokesMap(prev => ({ 
      ...prev, 
      [markingTarget]: [...prev[markingTarget], { points, brushSize, color: activeColor, tool: 'brush' }] 
    }));
    setCurrentStroke(null);
    setIsMidStroke(false);
    setIsRightDragging(false);
    redrawCanvas();
  };

  const closePoly = (points: Point[]) => {
    if (points.length < 3) return;
    setStrokesMap(prev => ({ 
      ...prev, 
      [markingTarget]: [...prev[markingTarget], { points, brushSize: 0, color: activeColor, tool: 'poly' }] 
    }));
    setPolyPoints([]);
    setTimeout(() => redrawCanvas(), 0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    setMouseDownPos(coords);
    if (e.button === 1 || e.altKey) { setIsPanning(true); return; }
    if (markingTool === 'brush') {
      if (e.button === 0) { 
        if (isMidStroke && currentStroke) setCurrentStroke([...currentStroke, coords]);
        else { setCurrentStroke([coords, coords]); setIsMidStroke(true); }
      } else if (e.button === 2) { 
        e.preventDefault();
        setCurrentStroke([coords]);
        setIsRightDragging(true);
      }
    } else if (markingTool === 'rect' && e.button === 0) {
      setRectStart(coords); setRectEnd(coords);
    } else if (markingTool === 'poly' && e.button === 0) {
      if (polyPoints.length > 2) {
        const d = Math.sqrt(Math.pow(coords.x - polyPoints[0].x, 2) + Math.pow(coords.y - polyPoints[0].y, 2));
        if (d < 20 / zoom) { closePoly(polyPoints); return; }
      }
      setPolyPoints(prev => [...prev, coords]);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (markingTool === 'brush' && isMidStroke && currentStroke) commitBrushStroke(currentStroke.slice(0, -1));
    else if (markingTool === 'poly' && polyPoints.length > 2) closePoly(polyPoints);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) { setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY })); return; }
    const coords = getCanvasCoords(e);
    if (markingTool === 'brush' && currentStroke) {
      if (isRightDragging) setCurrentStroke(prev => prev ? [...prev, coords] : [coords]);
      else if (isMidStroke) setCurrentStroke(prev => { if (!prev) return [coords, coords]; const next = [...prev]; next[next.length - 1] = coords; return next; });
    } else if (markingTool === 'rect' && rectStart) setRectEnd(coords);
    if (isMarkingMode) redrawCanvas();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) { setIsPanning(false); return; }
    if (markingTool === 'brush') { if (e.button === 2 && isRightDragging && currentStroke) commitBrushStroke(currentStroke); }
    else if (markingTool === 'rect' && rectStart && rectEnd) {
      setStrokesMap(prev => ({ ...prev, [markingTarget]: [...prev[markingTarget], { points: [rectStart, rectEnd], brushSize: 0, color: activeColor, tool: 'rect' }] }));
      setRectStart(null); setRectEnd(null);
    }
    redrawCanvas();
  };

  const openMarkingMode = (target: MarkingContext) => {
    setMarkingTarget(target);
    setBackupStrokes([...strokesMap[target]]);
    setBackupInpaintPrompt(inpaintPrompt);
    setZoom(1); setPan({x:0,y:0});
    setIsMidStroke(false); setIsRightDragging(false);
    // 强制重置为白色，确保资产重构模式下初始状态正确
    setActiveColor('#FFFFFF');
    setIsMarkingMode(true);
  };

  const discardMarking = () => {
    setStrokesMap(prev => ({ ...prev, [markingTarget]: backupStrokes }));
    setInpaintPrompt(backupInpaintPrompt);
    setIsMarkingMode(false); setPolyPoints([]); setIsMidStroke(false); setIsRightDragging(false); setCurrentStroke(null);
  };

  const saveAndExit = () => {
    if (!markCanvasRef.current) return;
    redrawCanvas(true);
    const maskData = markCanvasRef.current.toDataURL('image/png');
    if (markingTarget === 'A') setMaskRefA(maskData);
    else if (markingTarget === 'B') setMaskRefB(maskData);
    else if (markingTarget === 'INPAINT') {
      setMaskRefB(maskData);
      const currentImage = generatedImages.length > 0 ? generatedImages[0] : null;
      if (currentImage) { 
        setBaseRefs([currentImage]); 
        const img = new Image();
        img.onload = () => {
          setBaseRefsOriginalSizes([{ width: img.width, height: img.height }]);
        };
        img.src = currentImage;
        setIsCompositeMode(false); 
        setLockedIndices([0]); 
        syncRatioFromImage(currentImage); 
      }
    }
    setIsMarkingMode(false); setPolyPoints([]); setIsMidStroke(false); setIsRightDragging(false); setCurrentStroke(null);
  };

  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

  const syncRatioFromImage = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => { setCustomRatioW(img.naturalWidth); setCustomRatioH(img.naturalHeight); setActivePreset("CUSTOM"); };
    img.src = dataUrl;
  };

  const handleUpscale = async (e?: React.MouseEvent, overrideImg?: string) => {
    if (e) e.stopPropagation();
    
    let targetImg: string | null = null;
    
    if (overrideImg) {
      targetImg = overrideImg;
    } else if (selectedImageIndices.length > 0) {
      targetImg = generatedImages[selectedImageIndices[0]];
    } else if (hoveredImageIndex !== null) {
      targetImg = generatedImages[hoveredImageIndex];
    } else if (generatedImages.length > 0) {
      targetImg = generatedImages[0];
    }
    
    if (!targetImg || isGenerating) return;
    
    const imgInfo = await new Promise<{w: number, h: number}>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = targetImg!;
    });
    
    const maxDim = Math.max(imgInfo.w, imgInfo.h);
    const options: ('2K' | '4K')[] = [];

    if (maxDim < 2048) {
      options.push('2K', '4K');
    } else if (maxDim < 4096) {
      options.push('4K');
    } else {
      alert(t.parameters.alreadyMax4K);
      return;
    }
    
    setUpscaleDialog({
      show: true,
      image: targetImg,
      width: imgInfo.w,
      height: imgInfo.h,
      options,
      tier: 'FAST'
    });
  };

  const executeUpscale = async (targetSize: '2K' | '4K', targetTier: 'FAST' | 'QUALITY' = 'FAST') => {
    if (!upscaleDialog.image || isGenerating) return;
    
    setUpscaleDialog(prev => ({ ...prev, show: false }));
    setPreviousImages([...generatedImages]);
    
    setIsGenerating(true);
    onBusyStateChange?.(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const maxSize = targetSize === '4K' ? 4096 : 2048;
      const ratio = `${upscaleDialog.width}:${upscaleDialog.height}`;
      const upscalePrompt = `[HIFI-EVOLUTION]: Enhance texture and clarity while maintaining 100% structural fidelity. Preserve all architectural elements, structures, and composition exactly.`;
      
      const urls = await GeminiService.generateImage(
        upscalePrompt, 
        { ...config, imageSize: targetSize, aspectRatio: ratio, imageCount: 1, modelTier: targetTier }, 
        false, 
        [upscaleDialog.image], 
        [], [], [], 
        undefined, undefined, undefined, 
        instructions, 
        modelConfig, 
        controller.signal, 
        domain, 
        undefined,
        true
      );
      
      const newImages = Array.isArray(urls) ? urls : [urls];
      
      if (newImages.length > 0 && newImages[0]) {
        // 放大后的图片添加到成图区（不替换底图）
        setGeneratedImages(prev => [...newImages, ...prev]);
        setSelectedImageIndices(prev => [0, ...prev.map(i => i + newImages.length)]);
        
        // 添加水印
        const newWatermarked: string[] = [];
        for (const url of newImages) {
          try {
            const wmResult = await WatermarkUtils.addWatermark(url);
            newWatermarked.push(wmResult.dataUrl);
          } catch (e) {
            console.error("Watermark failed", e);
            newWatermarked.push(url);
          }
        }
        setWatermarkedImages(prev => [...newWatermarked, ...prev]);
        
        console.log(`[放大模式] 已添加 ${newImages.length} 张图片到成图区`);
        
        // 记录token使用情况
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
        const upscaleCost = targetSize === '4K' ? 250 : 180; // 放大的积分成本（万分之一元）
        Ph8UsageService.recordUsage(
          userId,
          { total: upscaleCost },
          targetTier || 'FAST',
          'image_upscale'
        ).catch(err => console.error('记录token使用失败:', err));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') alert(`${targetSize} ${t.parameters.upscaleFailed}: ${err.message}`);
    } finally { 
      setIsGenerating(false); 
      onBusyStateChange?.(false); 
    }
  };

  const triggerUpscale = (img: string) => handleUpscale(undefined, img);

  // PH8 返回的费用单位是万分之一元（0.0001元）
  // 1 积分 = 0.0001 元（万分之一元）
  // 例如：140 = 0.0140 元 = 140 积分
  const COST_PRECISION = 4; // 小数点后4位

  const calculateCost = () => {
    const size = config.imageSize;
    const tier = config.modelTier;
    let cost = 140; // 默认费用（万分之一元），0.0140元

    if (tier === "FAST") {
      if (size === "1K") cost = 140; // 0.0140元
      if (size === "2K") cost = 180; // 0.0180元
      if (size === "4K") cost = 250; // 0.0250元
    } else if (tier === "QUALITY") {
      if (size === "1K") cost = 180; // 0.0180元
      if (size === "2K") cost = 250; // 0.0250元
      if (size === "4K") cost = 350; // 0.0350元
    } else if (tier === "HIGH") {
      if (size === "1K") cost = 250; // 0.0250元
      if (size === "2K") cost = 350; // 0.0350元
      if (size === "4K") cost = 500; // 0.0500元
    }

    // 1 积分 = 0.0001 元
    return cost;
  };

  const handleGenerate = async () => {
    if (isGenerating) { abortControllerRef.current?.abort(); setIsGenerating(false); onBusyStateChange?.(false); return; }

    if (generatedImages.length > 0) setPreviousImages([...generatedImages]);
    
    setIsGenerating(true);
    onBusyStateChange?.(true);
    const finalRatio = `${customRatioW}:${customRatioH}`;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const isInpaintMode = !!maskRefB;
    const effectiveConfig = isInpaintMode ? { ...config, aspectRatio: finalRatio, imageCount: 1 } : { ...config, aspectRatio: finalRatio };
    
    try {
      const urls = await GeminiService.generateImage(currentPrompt, effectiveConfig, isCompositeMode, baseRefs, slotARefs, slotBRefs, styleRefs, maskRefB || undefined, inpaintPrompt, maskRefA || undefined, instructions, modelConfig, controller.signal, domain, baseRefsOriginalSizes);
      const newImages = Array.isArray(urls) ? urls : [urls];
      setGeneratedImages(newImages);
      setSelectedImageIndices([]);
      setHoveredImageIndex(null);
      const newWatermarked: string[] = [];
      for (const url of newImages) {
        try {
          const wmResult = await WatermarkUtils.addWatermark(url);
          newWatermarked.push(wmResult.dataUrl);
        } catch (e) {
          console.error("Watermark failed", e);
          newWatermarked.push(url);
        }
      }
      setWatermarkedImages(newWatermarked);
      if (isCompositeMode) { setIsCompositeMode(false); setBaseRefs([]); setBaseRefsOriginalSizes([]); setLockedIndices([]); setMaskRefB(null); }
      onImageGenerated?.({ id: Date.now().toString(), url: newImages[0], prompt: currentPrompt, config: {...config, aspectRatio: finalRatio}, timestamp: Date.now() });

      // 获取用户ID
      let userId = 'guest';
      try {
        const sessionData = localStorage.getItem('architect-invite-session');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          // 优先使用后端返回的数字用户ID
          userId = parsed.userId || parsed.email || 'guest';
          console.log('[用户ID] 从会话获取:', userId);
        }
      } catch (e) {
        console.error('获取用户ID失败:', e);
      }

      // 获取真实的费用并扣除积分
      setTimeout(async () => {
        try {
          const result = await Ph8UsageService.getLatestUsage(userId);
          if (result.success && result.data) {
            const realCost = result.data.total_tokens || 0;
            console.log('[PH8真实费用]', {
              requestId: result.data.request_id,
              cost: realCost,
              costInYuan: (realCost * 0.0001).toFixed(4),
              model: result.data.model
            });

            // 用真实费用扣除积分（利润10倍：用户积分 = cost ÷ 10，向上取整）
            if (realCost > 0 && onConsumePoints) {
              const userPoints = Math.ceil(realCost / 10);
              const deducted = await onConsumePoints(userPoints);
              if (!deducted) {
                console.warn('[PH8费用] 积分不足，无法扣除:', userPoints);
              }
            }
          }
        } catch (err) {
          console.error('获取PH8真实费用失败:', err);
        }
      }, 500);
    } catch (err: any) {
      if (err.name !== 'AbortError') alert(`渲染失败: ${err.message}`);
    } finally { if (abortControllerRef.current === controller) { setIsGenerating(false); onBusyStateChange?.(false); } }
  };

  const handleUndo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previousImages.length === 0) return;
    const current = [...generatedImages];
    setGeneratedImages(previousImages);
    setPreviousImages(current); 
    
    const newWatermarked: string[] = [];
    for (const img of previousImages) {
      try {
        const wmResult = await WatermarkUtils.addWatermark(img);
        newWatermarked.push(wmResult.dataUrl);
      } catch (e) {
        newWatermarked.push(img);
      }
    }
    setWatermarkedImages(newWatermarked);
  };

  const handleDownload = async (e: React.MouseEvent, isPro: boolean = false) => { 
    e.stopPropagation(); 
    if (generatedImages.length === 0) return; 
    
    // 如果没有选中图片，自动选中所有图片
    let indicesToDownload = selectedImageIndices;
    if (indicesToDownload.length === 0) {
      indicesToDownload = generatedImages.map((_, i) => i);
    }

    if (isPro) {
      if (userTier === 'beta') {
        window.alert("内测期间，无水印下载暂不可用。\n升级正式版即可解锁高清无水印下载。");
        return;
      }
      if (userTier === 'pro' || userTier === 'plus') {
        if (!window.confirm(`确认下载 ${indicesToDownload.length} 张无水印高清原片？\n(请遵守版权合规使用协议)`)) return;
        WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'pro' });
      } else if (userTier === 'basic') {
        const QUOTA_KEY = 'KBIT_BASIC_PRO_QUOTA';
        const today = new Date().toDateString();
        const quotaData = JSON.parse(localStorage.getItem(QUOTA_KEY) || `{"date":"${today}","count":0}`);
        let currentCount = quotaData.date === today ? quotaData.count : 0;

        if (currentCount >= 10) {
          window.alert("今日 10 次基础版无水印配额已用完。升级 PRO/PLUS 可享无限下载。");
          return;
        }

        if (!window.confirm(`基础版每日无水印下载配额剩余：${9 - currentCount} 次。\n确认下载高清原片？`)) return;
        
        localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: today, count: currentCount + 1 }));
        WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'free_pro_quota' });
      } else {
        window.alert("权限不足：无水印下载仅限付费用户（基础/PRO/PLUS）。免费用户请使用标准下载。");
        return;
      }
    } else {
      WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'standard' });
    }

    // 下载图片
    for (let i = 0; i < indicesToDownload.length; i++) {
      const idx = indicesToDownload[i];
      let downloadUrl: string;
      
      if (isPro) {
        // PRO 下载：直接使用原图
        downloadUrl = generatedImages[idx];
      } else {
        // 标准下载：确保有水印
        console.log(`[标准下载] idx=${idx}, watermarkedImages.length=${watermarkedImages.length}, hasWatermark=${!!watermarkedImages[idx]}`);
        if (watermarkedImages[idx]) {
          downloadUrl = watermarkedImages[idx];
          console.log(`[标准下载] 使用已有水印图片`);
        } else {
          // 动态添加水印
          console.log(`[标准下载] 动态添加水印...`);
          try {
            const wmResult = await WatermarkUtils.addWatermark(generatedImages[idx]);
            downloadUrl = wmResult.dataUrl;
            console.log(`[标准下载] 水印添加成功`);
          } catch (e) {
            console.error("[标准下载] 添加水印失败", e);
            downloadUrl = generatedImages[idx];
          }
        }
      }
      
      const link = document.createElement('a'); 
      link.href = downloadUrl; 
      link.download = `Creative_Asset_${isPro ? 'PRO' : 'STD'}_${Date.now()}_${i + 1}.png`; 
      link.click(); 
      
      // 添加延迟避免浏览器阻止多次下载
      if (i < indicesToDownload.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  };
  const openUpload = (uploadTargetVal: UploadTarget) => { setUploadTarget(uploadTargetVal); uploadInputRef.current?.click(); };

  const getResolutionLabel = (w: number, h: number) => {
    const maxDim = Math.max(w, h);
    if (maxDim >= 4096) return { label: '4K', next: null, color: 'text-emerald-400' };
    if (maxDim >= 2048) return { label: '2K', next: '4K', color: 'text-blue-400' };
    return { label: '1K', next: '2K', color: 'text-amber-400' };
  };

  const SlotFrame = ({ title, badge, values, onUpload, onRemove, single = false, showBrush = false, subtitle = "", locked = false, onToggleLock, lockedIndices = [], onUpscale, originalSizes = [] }: any) => (
    <div className={`flex-1 min-h-[260px] rounded-[2rem] border ${(locked || lockedIndices.length > 0) ? `border-${themeColor}-500 ring-2 ring-${themeColor}-500/20 shadow-xl` : 'border-slate-200 dark:border-slate-800'} bg-white/40 dark:bg-slate-900/20 glass-card flex flex-col overflow-hidden transition-all hover:shadow-2xl`}>
       <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-white/60 dark:bg-slate-900/60">
          <div className="flex flex-col"><span className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest italic">{title}</span><span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase">{badge}</span></div>
          <button onClick={onUpload} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg></button>
       </div>
       <div className="flex-1 relative p-4">
          {values.length > 0 ? (
             <div className={`w-full h-full ${single ? 'flex items-center justify-center' : 'grid grid-cols-2 gap-3'} overflow-y-auto custom-scrollbar`}>
               {values.map((v: string, i: number) => {
                 const isThisImageLocked = single ? locked : lockedIndices.includes(i);
                 return (
                   <div key={i} className={`relative group rounded-xl overflow-hidden border border-slate-100 dark:border-white/5 ${single ? 'w-full h-full' : 'aspect-square shadow-sm'} ${isThisImageLocked ? `ring-2 ring-${themeColor}-500` : ''}`}>
                     <img src={v} className="w-full h-full object-cover" />
                     {originalSizes[i] && (() => { const { label, next, color } = getResolutionLabel(originalSizes[i].width, originalSizes[i].height); return (<div className={`absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded-md text-[9px] font-black pointer-events-none ${color}`}>{label}{next ? ` → ${next}` : ' MAX'}</div>); })()}
                     <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3">
                        <div className="flex items-center gap-2">
                          {onToggleLock && (
                            <button onClick={(e) => { e.stopPropagation(); onToggleLock(single ? undefined : i); }} className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${isThisImageLocked ? `bg-${themeColor}-600 text-white border-transparent shadow-lg` : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500 border-transparent hover:text-theme'}`}>
                               {isThisImageLocked ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M8 11V7a4 4 0 0 1 8 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>}
                            </button>
                          )}
                          {onUpscale && (<button onClick={(e) => { e.stopPropagation(); onUpscale(i); }} className="w-9 h-9 flex items-center justify-center bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/20 shadow-md hover:bg-theme transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0m4 0h-4m2 2v-4" /></svg></button>)}
                          {(showBrush && (isCompositeMode || i === 0)) && (<button onClick={(e) => { e.stopPropagation(); openMarkingMode(isCompositeMode ? (title.includes('A') ? 'A' : 'B') : 'INPAINT'); }} className="w-9 h-9 flex items-center justify-center bg-theme text-white rounded-xl border border-theme-light shadow-md hover:bg-theme-dark transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>)}
                        </div>
                        <button onClick={() => onRemove(i)} className="px-4 py-1.5 bg-rose-600/90 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-md hover:bg-rose-700 transition-colors">移除资产</button>
                     </div>
                     {isThisImageLocked && <div className={`absolute top-2 right-2 w-2 h-2 bg-${themeColor}-500 rounded-full shadow-lg animate-pulse`} />}
                   </div>
                 );
               })}
             </div>
          ) : (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-20"><button onClick={onUpload} className="text-[10px] font-black uppercase tracking-widest italic">Asset Empty</button>{subtitle && <p className="text-[8px] mt-2 uppercase italic">{subtitle}</p>}</div>
          )}
       </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/60 dark:bg-slate-900/40 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 glass-card flex flex-col justify-center min-h-[90px]">
          <div className="flex justify-between items-center mb-3"><p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">画布比例 / Ratio</p> {(lockSource || lockedIndices.length > 0) && <span className={`text-[8px] bg-${themeColor}-500/10 text-${themeColor}-500 px-1.5 py-0.5 rounded-full font-black uppercase border border-${themeColor}-500/20 animate-pulse`}>视角锁定中</span>}</div>
          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-1">
                {["1:1", "16:9", "4:3", "3:4", "CUSTOM"].map(r => (<button key={r} disabled={lockSource !== null || lockedIndices.length > 0} onClick={() => { setActivePreset(r); if (r !== 'CUSTOM') { const [w, h] = r.split(':').map(Number); setCustomRatioW(w); setCustomRatioH(h); } }} className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${activePreset === r ? `bg-${themeColor}-600 text-white shadow-lg` : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}>{r}</button>))}
             </div>
             {(activePreset === 'CUSTOM' || lockSource !== null || lockedIndices.length > 0) && (
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-white/5 overflow-hidden"><span className="pl-2 text-[8px] font-black text-slate-500 dark:text-slate-400">W</span><input type="number" disabled={lockSource !== null || lockedIndices.length > 0} value={customRatioW} onChange={(e) => setCustomRatioW(parseInt(e.target.value) || 1)} className="w-full bg-transparent p-1 text-[10px] font-mono text-center outline-none text-slate-700 dark:text-slate-300" /></div>
                    <span className="text-slate-300 font-black">:</span>
                    <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-white/5 overflow-hidden"><span className="pl-2 text-[8px] font-black text-slate-500 dark:text-slate-400">H</span><input type="number" disabled={lockSource !== null || lockedIndices.length > 0} value={customRatioH} onChange={(e) => setCustomRatioH(parseInt(e.target.value) || 1)} className="w-full bg-transparent p-1 text-[10px] font-mono text-center outline-none text-slate-700 dark:text-slate-300" /></div>
                 </div>
                 {(lockSource !== null || lockedIndices.length > 0) && (() => { const g = gcd(customRatioW, customRatioH); return <span className={`text-[8px] font-black text-${themeColor}-500 text-center`}>底图比例 {customRatioW/g}:{customRatioH/g}</span>; })()}
               </div>
             )}
          </div>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/40 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 glass-card">
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">解算精度 / Resolution</p>
          <div className="flex gap-2">
            {["1K", "2K", "4K"].map(s => {
              const isLocked = (userTier === 'free' || userTier === 'beta') && s !== '1K';
              return (
                <button 
                  key={s} 
                  disabled={isLocked}
                  onClick={() => setConfig({...config, imageSize: s as any})} 
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all ${isLocked ? 'opacity-30 cursor-not-allowed' : ''} ${config.imageSize === s ? `bg-${themeColor}-600 text-white shadow-md` : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/40 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 glass-card">
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">解算引擎 / Engine Tier</p>
          <div className="flex gap-2">
            {["FAST", "QUALITY"].map(t => {
              const isLocked = (userTier === 'free' || userTier === 'beta') && t !== 'FAST';
              return (
                <button 
                  key={t} 
                  disabled={isLocked}
                  onClick={() => setConfig({...config, modelTier: t as any})} 
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all ${isLocked ? 'opacity-30 cursor-not-allowed' : ''} ${config.modelTier === t ? `bg-${themeColor}-600 text-white shadow-md` : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/40 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 glass-card">
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">生成数量 / Count</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setConfig({...config, imageCount: n})}
                className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all ${config.imageCount === n ? `bg-${themeColor}-600 text-white shadow-md` : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/60 dark:bg-slate-900/40 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 glass-card">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">温度 / Temperature</p>
            <span className={`text-[11px] font-mono font-bold text-${themeColor}-600`}>{config.temperature?.toFixed(1) || '1.0'}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="any"
            value={config.temperature || 1.0} 
            onChange={(e) => setConfig({...config, temperature: parseFloat(e.target.value)})} 
            className={`w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none accent-${themeColor}-600 cursor-pointer`} 
          />
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-slate-400">0.0 创意</span>
            <span className="text-[8px] text-slate-400">2.0 精确</span>
          </div>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/40 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 glass-card">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">多样性 / Top_P</p>
            <span className={`text-[11px] font-mono font-bold text-${themeColor}-600`}>{config.top_p?.toFixed(2) || '0.95'}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="any"
            value={config.top_p || 0.95} 
            onChange={(e) => setConfig({...config, top_p: parseFloat(e.target.value)})} 
            className={`w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none accent-${themeColor}-600 cursor-pointer`} 
          />
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-slate-400">0.0 保守</span>
            <span className="text-[8px] text-slate-400">1.0 多样</span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-4">
         <button onClick={() => { setIsCompositeMode(false); setLockSource(null); }} className={`flex-1 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all ${!isCompositeMode ? `bg-${themeColor}-600 text-white shadow-xl translate-x-1` : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>常规创作模式</button>
         <button onClick={() => { setIsCompositeMode(true); setLockedIndices([]); }} className={`flex-1 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all ${isCompositeMode ? `bg-${themeColor}-600 text-white shadow-xl translate-x-1` : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>资产基因重组 A→B</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {isCompositeMode ? (
          <>
            <SlotFrame title="Slot A 供体资产" badge="MORPHOLOGY" subtitle="提取形态、材质、颜色" single values={slotARefs} onUpload={() => openUpload('SLOT_A')} onRemove={() => { setSlotARefs([]); setMaskRefA(null); setStrokesMap(p => ({...p, A: []})); if(lockSource==='A') setLockSource(null); }} showBrush locked={lockSource === 'A'} onToggleLock={() => { if(slotARefs[0]) { setLockSource(lockSource==='A' ? null : 'A'); if(lockSource!=='A') syncRatioFromImage(slotARefs[0]); } }} />
            <SlotFrame title="Slot B 受体基底" badge="CONTEXT" subtitle="确定合成的环境与边界" single values={slotBRefs} onUpload={() => openUpload('SLOT_B')} onRemove={() => { setSlotBRefs([]); setMaskRefB(null); setStrokesMap(p => ({...p, B: []})); if(lockSource==='B') setLockSource(null); }} showBrush locked={lockSource === 'B'} onToggleLock={() => { if(slotBRefs[0]) { setLockSource(lockSource==='B' ? null : 'B'); if(lockSource!=='B') syncRatioFromImage(slotBRefs[0]); } }} />
            <SlotFrame title="Slot C 视觉基因" badge="STYLE DNA" subtitle="覆盖光影、天气、氛围" values={styleRefs} onUpload={() => openUpload('SLOT_C')} onRemove={(i: number) => setStyleRefs(p => p.filter((_, idx) => idx !== i))} />
          </>
        ) : (
          <div className="col-span-3">
             <SlotFrame title="Base References" badge="Normal Mode" values={baseRefs} allowMultiLock lockedIndices={lockedIndices} onUpload={() => openUpload('BASE')} onRemove={(i: number) => { setBaseRefs(prev => prev.filter((_, idx) => idx !== i)); setBaseRefsOriginalSizes(prev => prev.filter((_, idx) => idx !== i)); setLockedIndices(prev => prev.filter(idx => idx !== i)); if(i === 0) { setMaskRefB(null); setStrokesMap(p => ({...p, INPAINT: []})); } }} onToggleLock={(i: number) => { setLockedIndices(prev => { const exists = prev.includes(i); const next = exists ? prev.filter(idx => idx !== i) : [...prev, i].sort(); if (!exists && next.length > 0) syncRatioFromImage(baseRefs[next[0]]); return next; }); }} showBrush={baseRefs.length > 0} onUpscale={(i: number) => triggerUpscale(baseRefs[i])} originalSizes={baseRefsOriginalSizes} />
          </div>
        )}
      </div>

      <input type="file" ref={uploadInputRef} className="hidden" multiple={uploadTarget === 'SLOT_C' || uploadTarget === 'BASE'} onChange={(e) => {
        const files = Array.from(e.target.files || []) as File[];
        if(files.length === 0) return;
        const loadImages = async (fileList: File[]) => {
          const results: { dataUrl: string, originalWidth: number, originalHeight: number }[] = [];
          for (const file of fileList) {
            let data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
            
            // 在压缩之前获取原始图像尺寸
            let originalWidth = 1024;
            let originalHeight = 1024;
            try {
              const img = new Image();
              await new Promise<void>((resolve) => {
                img.onload = () => {
                  originalWidth = img.width;
                  originalHeight = img.height;
                  console.log(`原始图像尺寸: ${originalWidth}x${originalHeight}`);
                  resolve();
                };
                img.onerror = () => resolve();
                img.src = data;
              });
            } catch (e) {
              console.warn("获取原始图像尺寸失败", e);
            }
            
            try { data = await GeminiService.compressImage(data); } catch (err) { console.warn("Compression skip", err); }
            results.push({ dataUrl: data, originalWidth, originalHeight });
          }
          return results;
        };
        loadImages(files).then(dataUrls => {
          if (uploadTarget === 'BASE') { 
            setInpaintPrompt(''); 
            setStrokesMap(prev => ({ ...prev, INPAINT: [] })); 
            setMaskRefB(null); 
            setBaseRefs(p => [...p, ...dataUrls.map(d => d.dataUrl)]); 
            setBaseRefsOriginalSizes(p => [...p, ...dataUrls.map(d => ({ width: d.originalWidth, height: d.originalHeight }))]);
            if (baseRefs.length === 0 && dataUrls.length > 0) { 
              syncRatioFromImage(dataUrls[0].dataUrl); 
              setLockedIndices([0]); 
            } 
          }
          else if (uploadTarget === 'SLOT_A') { setSlotARefs([dataUrls[0].dataUrl]); if(lockSource==='A') syncRatioFromImage(dataUrls[0].dataUrl); }
          else if (uploadTarget === 'SLOT_B') { setSlotBRefs([dataUrls[0].dataUrl]); if(lockSource==='B') syncRatioFromImage(dataUrls[0].dataUrl); }
          else setStyleRefs(p => [...p, ...dataUrls.map(d => d.dataUrl)]);
        });
        e.target.value = '';
      }} />

      <div className="flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-4">
          <button onClick={handleGenerate} className={`px-20 py-4 rounded-2xl text-base font-semibold tracking-wide shadow-xl transition-all active:scale-95 cursor-pointer ${isGenerating ? `bg-white hover:bg-slate-50 text-rose-600 border border-rose-300 dark:bg-white dark:hover:bg-slate-50 dark:text-rose-600 dark:border-rose-300` : `bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 dark:bg-${themeColor}-600 dark:hover:bg-${themeColor}-700 dark:text-white dark:border-transparent`}`}>
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                停止生成
              </span>
            ) : (isCompositeMode ? "执行基因重组" : "执行渲染")}
          </button>
        </div>
        <div className="w-full min-h-[600px] bg-[#111111] rounded-2xl border border-white/[0.06] flex items-center justify-center p-10 relative overflow-visible">
           {isGenerating && <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-3xl z-[50] flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300"><div className={`w-16 h-16 border-4 border-${themeColor}-500 border-t-transparent rounded-full animate-spin`} /><p className="text-white font-black uppercase tracking-widest">Synthesis Progressing...</p></div>}
           {generatedImages.length > 0 ? (() => {
             const activeIdx = hoveredImageIndex ?? 0;
             return (
               <div className="flex flex-col items-center gap-4 w-full">
                 {/* 层1：主图区 */}
                 <div className="relative cursor-zoom-in group w-full flex justify-center" onMouseEnter={() => setIsMainImageHovered(true)} onMouseLeave={() => setIsMainImageHovered(false)} onClick={() => { setFullscreenImageIndex(activeIdx); setIsPreviewFullscreen(true); }}>
                   <img ref={mainImageRef} src={watermarkedImages[activeIdx] || generatedImages[activeIdx]} className="max-h-[60vh] rounded-xl shadow-2xl border border-white/10 transition-transform duration-300 origin-center" style={{ transform: isMainImageHovered ? 'scale(1.02)' : 'scale(1)' }} alt="Result" />
                   {imgNaturalSize && <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-white font-mono text-[10px] font-black tracking-widest pointer-events-none">{imgNaturalSize.w} × {imgNaturalSize.h}</div>}
                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                     <div className="bg-black/50 backdrop-blur-sm rounded-full p-3"><svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></div>
                   </div>
                   <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[9px] text-white/50 pointer-events-none whitespace-nowrap">© AI Generated | 预览已添加溯源水印</div>
                 </div>
                 {/* 层2：操作栏 */}
                 <div className="flex flex-col items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 pt-2 pb-2.5 shadow-lg">
                   <div className={`text-[9px] font-black uppercase tracking-widest text-${themeColor}-500 pb-1 border-b border-slate-100 dark:border-slate-800 w-full text-center`}>
                     当前操作：图 {activeIdx + 1}{generatedImages.length > 1 ? ` / 共 ${generatedImages.length} 张` : ''}
                   </div>
                   <div className="flex items-center gap-2">
                     <button onClick={() => { setFullscreenImageIndex(activeIdx); setIsPreviewFullscreen(true); }} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all" title="全屏查看">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                       <span className="text-[9px] font-medium">全屏</span>
                     </button>
                     <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                     <button onClick={(e) => handleDownload(e, false)} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all" title="带水印下载">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                       <span className="text-[9px] font-medium">标准下载</span>
                     </button>
                     <button onClick={(e) => handleDownload(e, true)} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${isDeveloper ? `hover:bg-${themeColor}-50 dark:hover:bg-${themeColor}-900/30 text-${themeColor}-600 dark:text-${themeColor}-400` : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'}`} title={isDeveloper ? '无水印原图下载' : '升级 PRO/PLUS 解锁无水印下载'}>
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                       <span className="text-[9px] font-medium">{isDeveloper ? '原图下载' : '🔒 原图'}</span>
                     </button>
                     <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                     <button onClick={(e) => { e.stopPropagation(); if (!window.confirm(`将对图 ${activeIdx + 1} 进行局部修改，确认继续？`)) return; openMarkingMode('INPAINT'); }} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all" title="局部修改">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                       <span className="text-[9px] font-medium">{t.parameters.inpaintEdit}</span>
                     </button>
                     <div className="flex flex-col items-center gap-1">
                       <div className="flex gap-1">
                         <button onClick={(e) => { e.stopPropagation(); const img = generatedImages[activeIdx]; if (!img) return; const i = new Image(); i.onload = () => { const max = Math.max(i.naturalWidth, i.naturalHeight); if (max >= 2048) { alert(t.parameters.alreadyMax2K); return; } setUpscaleDialog({ show: true, image: img, width: i.naturalWidth, height: i.naturalHeight, options: ['2K'], tier: 'FAST' }); }; i.src = img; }} className="px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all text-[10px] font-black border border-slate-200 dark:border-slate-700" title="快捷放大到2K">2K</button>
                         <button onClick={(e) => { e.stopPropagation(); const img = generatedImages[activeIdx]; if (!img) return; const i = new Image(); i.onload = () => { const max = Math.max(i.naturalWidth, i.naturalHeight); if (max >= 4096) { alert(t.parameters.alreadyMax4K); return; } setUpscaleDialog({ show: true, image: img, width: i.naturalWidth, height: i.naturalHeight, options: ['4K'], tier: 'FAST' }); }; i.src = img; }} className="px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all text-[10px] font-black border border-slate-200 dark:border-slate-700" title="快捷放大到4K">4K</button>
                       </div>
                       <span className="text-[9px] font-medium text-slate-500">{t.parameters.hdUpscale}</span>
                     </div>
                     {previousImages.length > 0 && <>
                       <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                       <button onClick={handleUndo} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all" title="回退上一版本">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                         <span className="text-[9px] font-medium">回退</span>
                       </button>
                     </>}
                   </div>
                 </div>
                 {/* 层3：缩略图条（多图时显示） */}
                 {generatedImages.length > 1 && (
                   <div className="flex gap-3 flex-wrap justify-center">
                     {generatedImages.map((img, idx) => (
                       <div key={idx} onClick={() => setHoveredImageIndex(idx)}
                         className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200 ${activeIdx === idx ? `ring-2 ring-${themeColor}-400 scale-110 shadow-lg` : 'ring-1 ring-white/20 opacity-60 hover:opacity-100 hover:ring-white/40'}`}>
                         <img src={watermarkedImages[idx] || img} className="w-20 h-20 object-cover" alt={`${idx + 1}`} />
                         <div className={`absolute bottom-0 inset-x-0 py-0.5 text-center text-[9px] font-bold ${activeIdx === idx ? `bg-${themeColor}-600 text-white` : 'bg-black/60 text-white/70'}`}>
                           {activeIdx === idx ? `▶ ${idx + 1}` : idx + 1}
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             );
           })() : (<div className="opacity-5 select-none grayscale flex flex-col items-center"><svg className="w-40 h-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={0.2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg><span className="text-4xl font-black uppercase tracking-[0.8em] italic">Engine Idle</span></div>)}
        </div>
        <button onClick={() => { if(window.confirm("确定重置工坊吗？")) onReset?.(); }} className="px-10 py-3 bg-white/5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.06] rounded-xl text-[11px] font-medium tracking-wide shadow-sm flex items-center gap-2 group transition-all"><svg className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>重置工坊</button>
      </div>

      {isPreviewFullscreen && fullscreenImageIndex !== null && generatedImages[fullscreenImageIndex] && (
        <div className="fixed inset-0 z-[400] bg-slate-950 flex flex-col animate-in fade-in duration-300" onClick={() => { setIsPreviewFullscreen(false); setFullscreenImageIndex(null); }}>
          {/* 层1：主图区 */}
          <div className="flex-1 flex items-center justify-center p-6 min-h-0 cursor-zoom-out">
            <img
              src={watermarkedImages[fullscreenImageIndex] || generatedImages[fullscreenImageIndex]}
              className="max-h-full max-w-full rounded-xl shadow-2xl object-contain"
              alt="Fullscreen"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {/* 层2：操作栏 */}
          <div className="flex-shrink-0 flex justify-center pb-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-1.5 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 pt-2 pb-2.5 shadow-2xl">
              <div className={`text-[9px] font-black uppercase tracking-widest text-${themeColor}-400 pb-1 border-b border-white/10 w-full text-center`}>
                当前操作：图 {fullscreenImageIndex + 1}{generatedImages.length > 1 ? ` / 共 ${generatedImages.length} 张` : ''}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setIsPreviewFullscreen(false); setFullscreenImageIndex(null); }} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all" title="退出全屏">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  <span className="text-[9px] font-medium">关闭</span>
                </button>
                <div className="w-px h-8 bg-white/10" />
                <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = watermarkedImages[fullscreenImageIndex] || generatedImages[fullscreenImageIndex]; a.download = `Creative_STD_${Date.now()}.png`; a.click(); }} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all" title="标准下载">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="text-[9px] font-medium">标准下载</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); if (!isDeveloper) { alert('升级 PRO/PLUS 解锁无水印下载'); return; } const a = document.createElement('a'); a.href = generatedImages[fullscreenImageIndex]; a.download = `Creative_PRO_${Date.now()}.png`; a.click(); }} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${isDeveloper ? `hover:bg-${themeColor}-900/40 text-${themeColor}-400 hover:text-${themeColor}-300` : 'text-white/30 hover:bg-white/5'}`} title={isDeveloper ? '无水印原图' : '升级解锁'}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span className="text-[9px] font-medium">{isDeveloper ? '原图下载' : '🔒 原图'}</span>
                </button>
                <div className="w-px h-8 bg-white/10" />
                <button onClick={(e) => { e.stopPropagation(); setHoveredImageIndex(fullscreenImageIndex); setIsPreviewFullscreen(false); setFullscreenImageIndex(null); setTimeout(() => openMarkingMode('INPAINT'), 100); }} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all" title="局部修改">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  <span className="text-[9px] font-medium">{t.parameters.inpaintEdit}</span>
                </button>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); const img = generatedImages[fullscreenImageIndex]; if (!img) return; const im = new Image(); im.onload = () => { const max = Math.max(im.naturalWidth, im.naturalHeight); if (max >= 2048) { alert(t.parameters.alreadyMax2K); return; } setIsPreviewFullscreen(false); setFullscreenImageIndex(null); setTimeout(() => setUpscaleDialog({ show: true, image: img, width: im.naturalWidth, height: im.naturalHeight, options: ['2K'], tier: 'FAST' }), 100); }; im.src = img; }} className="px-2 py-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all text-[10px] font-black border border-white/20" title="快捷放大到2K">2K</button>
                    <button onClick={(e) => { e.stopPropagation(); const img = generatedImages[fullscreenImageIndex]; if (!img) return; const im = new Image(); im.onload = () => { const max = Math.max(im.naturalWidth, im.naturalHeight); if (max >= 4096) { alert(t.parameters.alreadyMax4K); return; } setIsPreviewFullscreen(false); setFullscreenImageIndex(null); setTimeout(() => setUpscaleDialog({ show: true, image: img, width: im.naturalWidth, height: im.naturalHeight, options: ['4K'], tier: 'FAST' }), 100); }; im.src = img; }} className="px-2 py-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all text-[10px] font-black border border-white/20" title="快捷放大到4K">4K</button>
                  </div>
                  <span className="text-[9px] font-medium text-white/50">{t.parameters.hdUpscale}</span>
                </div>
              </div>
            </div>
          </div>
          {/* 层3：缩略图条 */}
          {generatedImages.length > 1 && (
            <div className="flex-shrink-0 flex gap-2 justify-center pb-4 px-4 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
              {generatedImages.map((img, idx) => (
                <div key={idx} onClick={(e) => { e.stopPropagation(); setFullscreenImageIndex(idx); }}
                  className={`relative flex-shrink-0 cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${fullscreenImageIndex === idx ? `ring-2 ring-${themeColor}-400 scale-110` : 'ring-1 ring-white/20 opacity-50 hover:opacity-90'}`}>
                  <img src={watermarkedImages[idx] || img} className="w-16 h-16 object-cover" alt={`${idx + 1}`} />
                  <div className={`absolute bottom-0 inset-x-0 py-0.5 text-center text-[8px] font-bold ${fullscreenImageIndex === idx ? `bg-${themeColor}-600 text-white` : 'bg-black/60 text-white/60'}`}>
                    {fullscreenImageIndex === idx ? `▶ ${idx + 1}` : idx + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isMarkingMode && (
        <div ref={containerRef} className="fixed inset-0 z-[300] bg-slate-950 flex flex-col p-8 animate-in fade-in duration-300" onWheel={handleWheel} onContextMenu={(e) => e.preventDefault()}>
          <div className="flex-1 relative flex items-center justify-center overflow-hidden cursor-crosshair">
            <div style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }} className="relative rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onDoubleClick={handleDoubleClick}>
              <img ref={markImageRef} src={markingTarget === 'A' ? (slotARefs[0] || "") : (markingTarget === 'INPAINT' ? (generatedImages[0] || baseRefs[0] || "") : (slotBRefs[0] || baseRefs[0] || ""))} className="block opacity-40 grayscale pointer-events-none max-h-[70vh] object-contain" />
              <canvas ref={markCanvasRef} className="absolute inset-0 mix-blend-screen opacity-100" />
            </div>
          </div>
          <div className="mt-4 bg-[#111111]/95 p-6 rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col items-center gap-5 backdrop-blur-xl max-h-[45vh] overflow-y-auto custom-scrollbar">
             <div className="w-full max-w-6xl flex flex-col gap-6">
                <div className="flex items-start gap-10">
                   <div className="flex flex-col gap-4">
                     <div className="flex items-center gap-3"><span className="text-[10px] font-medium uppercase text-white/30 tracking-widest">选取工具:</span><div className="flex gap-1">{['brush', 'rect', 'poly'].map(t => (<button key={t} onClick={() => { setMarkingTool(t as any); setIsMidStroke(false); setIsRightDragging(false); setCurrentStroke(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase transition-all ${markingTool === t ? `bg-blue-500/20 text-blue-400 border border-blue-500/30` : 'bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70'}`}>{t === 'brush' ? '画笔' : t === 'rect' ? '矩形' : '多边形'}</button>))}</div></div>
                     {/* 差异化分流：资产重组模式（Slot A/B）强制隐藏彩色面板，仅保留白色遮罩 */}
                     <div className="flex items-center gap-3"><span className="text-[10px] font-medium uppercase text-white/30 tracking-widest">材质颜色:</span><div className="flex gap-2">{(markingTarget === 'INPAINT' ? PRESET_COLORS : [PRESET_COLORS[0]]).map(c => (<button key={c.value} onClick={() => setActiveColor(c.value)} className={`w-10 h-10 rounded-xl border-2 transition-all ${activeColor === c.value ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`} style={{ backgroundColor: c.value }} />))}</div></div>
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between mb-2"><span className="text-[10px] font-medium uppercase text-white/30 tracking-widest">标记参数: (1-300 | 滾轮缩放 / 中键平移 / 左键点击连线 / 双击结束 / 右键涂鸦)</span><button onClick={() => { if (polyPoints.length > 0) setPolyPoints([]); else setStrokesMap(p => ({...p, [markingTarget]: p[markingTarget].slice(0,-1)})); }} className={`text-[10px] font-medium text-white/30 hover:text-white/60 uppercase tracking-tighter`}>撤销上一笔 / 清空点位</button></div>
                      <div className="flex items-center gap-6"><input type="range" min="1" max="300" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className={`flex-1 h-2 bg-white/5 rounded-full appearance-none accent-${themeColor}-500 cursor-pointer`} /><input type="number" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value) || 1)} className="w-24 bg-white/5 border border-white/10 rounded-xl text-white text-[15px] font-mono text-center outline-none py-2.5" /></div>
                   </div>
                </div>

                {/* 差异化分流：仅常规重绘模式显示提示词框，字号样式由 Preferences (fontSize prop) 动态控制 */}
                {markingTarget === 'INPAINT' && (
                  <div className="w-full space-y-3 pt-2 border-t border-white/5 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black text-theme uppercase tracking-widest">局部语义重绘指令 (Inpaint Semantic Directive)</label>
                      <span className="text-[9px] font-bold text-emerald-400 uppercase italic">仅修改遮罩区域，其余保持不变</span>
                    </div>
                    <textarea 
                      value={inpaintPrompt} 
                      onChange={(e) => setInpaintPrompt(e.target.value)}
                      style={{ fontSize: `${fontSize}px` }}
                      placeholder="根据涂抹颜色描述修改意图（例如：‘将红色区域改为拉丝金属，白色区域改为磨砂玻璃，整体增加科幻氛围’）..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:ring-2 focus:ring-theme/30 min-h-[120px] resize-none font-medium leading-relaxed custom-scrollbar"
                    />
                  </div>
                )}
             </div>
             <div className="flex gap-4 pt-2"><button onClick={discardMarking} className="px-10 py-3 bg-white/[0.04] border border-white/[0.06] text-white/40 rounded-xl text-[11px] font-medium uppercase tracking-widest hover:text-rose-400 hover:border-rose-500/30 transition-all">放弃</button><button onClick={saveAndExit} className={`px-20 py-3 bg-blue-500/80 text-white rounded-xl text-[11px] font-medium uppercase tracking-widest hover:bg-blue-500 transition-all`}>确认标记</button></div>
          </div>
        </div>
      )}

      {upscaleDialog.show && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white/80 mb-5">{t.parameters.selectUpscaleOption}</h3>
            <div className="mb-5">
              <p className="text-white/40 text-sm mb-1">{t.parameters.currentSize}<span className="text-white/70 font-medium">{upscaleDialog.width} × {upscaleDialog.height}</span> px</p>
              <p className="text-white/25 text-xs">{t.parameters.upscaleHint}</p>
            </div>

            {/* 解算引擎选择 */}
            <div className="mb-4">
              <p className="text-white/30 text-xs font-medium mb-2">{t.parameters.engineLabel}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setUpscaleDialog(prev => ({ ...prev, tier: 'FAST' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${upscaleDialog.tier === 'FAST' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70'}`}
                >
                  FAST 极速
                </button>
                <button
                  onClick={() => setUpscaleDialog(prev => ({ ...prev, tier: 'QUALITY' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${upscaleDialog.tier === 'QUALITY' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70'}`}
                >
                  QUALITY 质量
                </button>
              </div>
            </div>

            {/* 分辨率选择 */}
            <div className="mb-5">
              <p className="text-white/30 text-xs font-medium mb-2">{t.parameters.targetRes}</p>
              <div className="flex gap-3">
                {upscaleDialog.options.includes('2K') && (
                  <button
                    onClick={() => executeUpscale('2K', upscaleDialog.tier)}
                    className="flex-1 py-5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/8 transition-all"
                  >
                    <div className="text-xl font-semibold">2K</div>
                    <div className="text-xs text-white/30 mt-1">2048px</div>
                  </button>
                )}
                {upscaleDialog.options.includes('4K') && (
                  <button
                    onClick={() => executeUpscale('4K', upscaleDialog.tier)}
                    className="flex-1 py-5 bg-blue-500/20 border border-blue-500/30 rounded-xl text-white hover:bg-blue-500/30 transition-all relative"
                  >
                    <div className="text-xl font-semibold">4K</div>
                    <div className="text-xs text-white/50 mt-1">4096px</div>
                    <span className="absolute -top-2 -right-2 bg-amber-400 text-black text-[8px] font-bold px-2 py-0.5 rounded-full">{t.parameters.recommended}</span>
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setUpscaleDialog(prev => ({ ...prev, show: false }))}
              className="w-full py-2.5 bg-white/[0.04] border border-white/[0.06] text-white/40 rounded-xl text-sm font-medium hover:text-white/70 transition-all"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGenerator;
