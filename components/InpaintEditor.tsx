import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getTranslation } from '../i18n/locales.ts';
import type { Language } from '../i18n/locales.ts';

interface InpaintEditorProps {
  imageUrl: string;
  onSaveMask: (maskDataUrl: string, role: 'donor' | 'recipient') => void;
  onSubmit: (maskDataUrl: string, prompt: string, role: 'donor' | 'recipient') => void;
  onClose: () => void;
  language?: Language;
}

type Tool = 'brush' | 'rect' | 'ellipse' | 'lasso';

const COLORS = [
  { label: '白', value: 'white' },
  { label: '红', value: '#ef4444' },
  { label: '蓝', value: '#3b82f6' },
  { label: '绿', value: '#22c55e' },
  { label: '黄', value: '#eab308' },
  { label: '紫', value: '#a855f7' },
];

interface Point {
  x: number;
  y: number;
  timestamp: number;
}

const InpaintEditor: React.FC<InpaintEditorProps> = ({ imageUrl, onSaveMask, onSubmit, onClose, language = 'zh-CN' }) => {
  const t = getTranslation(language);
  const [brushSize, setBrushSize] = useState(40);
  const [color, setColor] = useState('white');
  const [tool, setTool] = useState<Tool>('brush');
  const [role, setRole] = useState<'donor' | 'recipient' | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const lassoPoints = useRef<{ x: number; y: number }[]>([]);
  const snapshotRef = useRef<ImageData | null>(null);
  
  const strokePoints = useRef<Point[]>([]);
  const lastPoint = useRef<Point | null>(null);
  const velocity = useRef<number>(0);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  
  const MIN_SAMPLE_DISTANCE = 2;
  const MAX_SAMPLE_DISTANCE = 20;
  const VELOCITY_THRESHOLD = 50;

  useEffect(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = maskCanvas.width = img.width;
      canvas.height = maskCanvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      const mCtx = maskCanvas.getContext('2d')!;
      mCtx.fillStyle = 'black';
      mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      setOriginalImageSize({ width: img.width, height: img.height });
      setImageLoaded(true);
      resetView();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent) => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height),
      };
    }
    
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const drawLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 1) return;
    
    const steps = Math.max(2, Math.ceil(distance / 3));
    const stepX = dx / steps;
    const stepY = dy / steps;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    for (let i = 1; i <= steps; i++) {
      const x = x1 + stepX * i;
      const y = y1 + stepY * i;
      ctx.lineTo(x, y);
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.stroke();
  };

  const drawSmoothStroke = (ctx: CanvasRenderingContext2D, points: Point[], size: number) => {
    if (points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.stroke();
    
    ctx.beginPath();
    for (const point of points) {
      ctx.moveTo(point.x, point.y);
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    }
    ctx.fill();
  };

  const getAdaptiveSampleDistance = (vel: number): number => {
    const normalizedVel = Math.min(vel / 200, 1);
    return MIN_SAMPLE_DISTANCE + (MAX_SAMPLE_DISTANCE - MIN_SAMPLE_DISTANCE) * normalizedVel;
  };

  const handleBrushStroke = (ctx: CanvasRenderingContext2D, newPoint: Point) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    
    if (lastPoint.current) {
      const dx = newPoint.x - lastPoint.current.x;
      const dy = newPoint.y - lastPoint.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const timeDelta = newPoint.timestamp - lastPoint.current.timestamp;
      
      velocity.current = timeDelta > 0 ? (distance / timeDelta) * 1000 : 0;
      
      const sampleDistance = getAdaptiveSampleDistance(velocity.current);
      
      if (distance > sampleDistance) {
        const steps = Math.ceil(distance / sampleDistance);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const interpolatedX = lastPoint.current.x + dx * t;
          const interpolatedY = lastPoint.current.y + dy * t;
          strokePoints.current.push({ x: interpolatedX, y: interpolatedY, timestamp: newPoint.timestamp });
        }
      } else {
        strokePoints.current.push(newPoint);
      }
      
      drawLine(ctx, lastPoint.current.x, lastPoint.current.y, newPoint.x, newPoint.y, brushSize);
    }
    
    ctx.beginPath();
    ctx.arc(newPoint.x, newPoint.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    lastPoint.current = newPoint;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (zoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const pos = getPos(e);
    setIsDrawing(true);
    startPos.current = pos;
    
    const mCtx = maskCanvasRef.current!.getContext('2d')!;
    
    if (tool === 'brush') {
      strokePoints.current = [{ x: pos.x, y: pos.y, timestamp: Date.now() }];
      lastPoint.current = { x: pos.x, y: pos.y, timestamp: Date.now() };
      velocity.current = 0;
      
      mCtx.fillStyle = color;
      mCtx.beginPath();
      mCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      mCtx.fill();
    } else if (tool === 'lasso') {
      snapshotRef.current = mCtx.getImageData(0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height);
      lassoPoints.current = [pos];
    } else {
      snapshotRef.current = mCtx.getImageData(0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      setPan({ x: newX, y: newY });
      return;
    }

    if (!isDrawing) return;
    const pos = getPos(e);
    const mCtx = maskCanvasRef.current!.getContext('2d')!;
    const start = startPos.current!;

    if (tool === 'brush') {
      const newPoint = { x: pos.x, y: pos.y, timestamp: Date.now() };
      handleBrushStroke(mCtx, newPoint);
    } else if (tool === 'lasso') {
      lassoPoints.current.push(pos);
      mCtx.putImageData(snapshotRef.current!, 0, 0);
      mCtx.strokeStyle = color;
      mCtx.lineWidth = 2;
      mCtx.beginPath();
      lassoPoints.current.forEach((p, i) => i === 0 ? mCtx.moveTo(p.x, p.y) : mCtx.lineTo(p.x, p.y));
      mCtx.stroke();
    } else {
      mCtx.putImageData(snapshotRef.current!, 0, 0);
      mCtx.fillStyle = color;
      if (tool === 'rect') {
        mCtx.fillRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      } else {
        mCtx.beginPath();
        mCtx.ellipse(
          (start.x + pos.x) / 2, (start.y + pos.y) / 2,
          Math.abs(pos.x - start.x) / 2, Math.abs(pos.y - start.y) / 2,
          0, 0, Math.PI * 2
        );
        mCtx.fill();
      }
    }
  };

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (tool === 'brush') {
      strokePoints.current = [];
      lastPoint.current = null;
      velocity.current = 0;
    }
    
    if (tool === 'lasso' && lassoPoints.current.length > 2) {
      const mCtx = maskCanvasRef.current!.getContext('2d')!;
      if (snapshotRef.current) mCtx.putImageData(snapshotRef.current, 0, 0);
      mCtx.fillStyle = color;
      mCtx.beginPath();
      lassoPoints.current.forEach((p, i) => i === 0 ? mCtx.moveTo(p.x, p.y) : mCtx.lineTo(p.x, p.y));
      mCtx.closePath();
      mCtx.fill();
      lassoPoints.current = [];
    }
    snapshotRef.current = null;
  }, [isPanning, isDrawing, tool, color]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    setZoom(newZoom);
  }, [zoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if (zoom > 1) {
        setIsPanning(true);
        setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
      } else {
        const pos = getPos(e);
        setIsDrawing(true);
        startPos.current = pos;
        const mCtx = maskCanvasRef.current!.getContext('2d')!;
        
        if (tool === 'brush') {
          strokePoints.current = [{ x: pos.x, y: pos.y, timestamp: Date.now() }];
          lastPoint.current = { x: pos.x, y: pos.y, timestamp: Date.now() };
          velocity.current = 0;
          
          mCtx.fillStyle = color;
          mCtx.beginPath();
          mCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
          mCtx.fill();
        } else if (tool === 'lasso') {
          snapshotRef.current = mCtx.getImageData(0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height);
          lassoPoints.current = [pos];
        } else {
          snapshotRef.current = mCtx.getImageData(0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height);
        }
      }
    }
  }, [zoom, pan.x, pan.y, tool, color, brushSize]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      if (isPanning) {
        const newX = e.touches[0].clientX - panStart.x;
        const newY = e.touches[0].clientY - panStart.y;
        setPan({ x: newX, y: newY });
      } else if (isDrawing) {
        const pos = getPos(e);
        const mCtx = maskCanvasRef.current!.getContext('2d')!;
        const start = startPos.current!;

        if (tool === 'brush') {
          const newPoint = { x: pos.x, y: pos.y, timestamp: Date.now() };
          handleBrushStroke(mCtx, newPoint);
        } else if (tool === 'lasso') {
          lassoPoints.current.push(pos);
          mCtx.putImageData(snapshotRef.current!, 0, 0);
          mCtx.strokeStyle = color;
          mCtx.lineWidth = 2;
          mCtx.beginPath();
          lassoPoints.current.forEach((p, i) => i === 0 ? mCtx.moveTo(p.x, p.y) : mCtx.lineTo(p.x, p.y));
          mCtx.stroke();
        } else {
          mCtx.putImageData(snapshotRef.current!, 0, 0);
          mCtx.fillStyle = color;
          if (tool === 'rect') {
            mCtx.fillRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
          } else {
            mCtx.beginPath();
            mCtx.ellipse(
              (start.x + pos.x) / 2, (start.y + pos.y) / 2,
              Math.abs(pos.x - start.x) / 2, Math.abs(pos.y - start.y) / 2,
              0, 0, Math.PI * 2
            );
            mCtx.fill();
          }
        }
      }
    }
  }, [isPanning, isDrawing, panStart, tool, color, brushSize]);

  const handleTouchEnd = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    } else if (isDrawing) {
      handleMouseUp();
    }
  }, [isPanning, isDrawing, handleMouseUp]);

  const handleClear = () => {
    const mCtx = maskCanvasRef.current!.getContext('2d')!;
    mCtx.fillStyle = 'black';
    mCtx.fillRect(0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height);
  };

  const handleClose = () => {
    if (role !== null) {
      const mask = maskCanvasRef.current?.toDataURL('image/png');
      if (mask) onSaveMask(mask, role);
    }
    onClose();
  };

  const handleSubmit = () => {
    if (!imageLoaded) return;
    const mask = maskCanvasRef.current!.toDataURL('image/png');
    if (role !== null) onSaveMask(mask, role);
    onSubmit(mask, prompt.trim(), role ?? 'donor');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      canvasContainerRef.current?.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.error(err));
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toolBtn = (t: Tool, label: string) => (
    <button key={t} onClick={() => setTool(t)}
      className={`min-h-[36px] px-3 py-1 rounded-lg text-[12px] font-medium transition-all active:scale-95 ${tool === t ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/[0.04] border border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70'}`}>
      {label}
    </button>
  );

  const toolLabels = language === 'zh-CN'
    ? { brush: '画笔', rect: '矩形', ellipse: '椭圆', lasso: '套索' }
    : { brush: 'Brush', rect: 'Rect', ellipse: 'Ellipse', lasso: 'Lasso' };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111111] rounded-2xl shadow-2xl border border-white/[0.08] max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-semibold text-white/80">{language === 'zh-CN' ? '局部修改 Inpaint' : 'Inpaint Editor'}</h3>
            <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-1">
              <span className="text-[11px] text-white/40">{Math.round(zoom * 100)}%</span>
              <button onClick={resetView} className="text-[11px] text-white/40 hover:text-white/70 transition-colors">
                {language === 'zh-CN' ? '重置' : 'Reset'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleFullscreen} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all active:scale-95">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isFullscreen ? "M6 18L18 6M6 6l12 12" : "M4 8V4m0 0h4m-4 0l5 5m1-5V4m0 0h4m-4 0L10 9M8 16H4m0 0v4m0-4l5-5M18 8h4m0 0v-4m0 4l-5-5M16 16h4m0 0v4m0-4l-5 5"} />
              </svg>
            </button>
            <button onClick={handleClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all active:scale-95">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-hidden p-6 flex items-center justify-center bg-black/20 cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
        >
          <div
            className="relative transition-transform duration-150 ease-out"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            <canvas ref={canvasRef} className="absolute inset-0" />
            <canvas
              ref={maskCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="relative opacity-50 hover:opacity-60 transition-opacity"
              style={{
                cursor: zoom > 1 ? 'grab' : (tool === 'brush' ? 'crosshair' : 'default'),
                maxWidth: '100%',
                maxHeight: isFullscreen ? '85vh' : '55vh',
              }}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] space-y-3">

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wide w-12">{language === 'zh-CN' ? '缩放' : 'Zoom'}</span>
            <button onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - 0.1))} className="min-h-[36px] px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70 transition-all active:scale-95">-</button>
            <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.1} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-32 h-1.5 accent-blue-500" />
            <button onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + 0.1))} className="min-h-[36px] px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70 transition-all active:scale-95">+</button>
            <button onClick={resetView} className="min-h-[36px] px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70 transition-all active:scale-95">
              {language === 'zh-CN' ? '100%' : '100%'}
            </button>
            <span className="text-[11px] font-mono text-white/30 w-16 ml-2">{Math.round(zoom * 100)}%</span>
            <span className="text-[11px] text-white/25 ml-auto">
              {language === 'zh-CN' ? '滚轮缩放，拖拽平移' : 'Wheel to zoom, drag to pan'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wide w-12">{language === 'zh-CN' ? '角色' : 'Role'}</span>
            {(['donor', 'recipient'] as const).map(r => (
              <button key={r} onClick={() => setRole(prev => prev === r ? null : r)}
                className={`min-h-[36px] px-4 rounded-lg text-[12px] font-medium transition-all active:scale-95 ${role === r ? (r === 'donor' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30') : 'bg-white/[0.04] border border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70'}`}>
                {language === 'zh-CN'
                  ? (r === 'donor' ? '供体 · 提取' : '受体 · 融合')
                  : (r === 'donor' ? 'Donor' : 'Recipient')}
              </button>
            ))}
            <span className="text-[11px] text-white/25 ml-1">
              {language === 'zh-CN'
                ? (role === 'donor' ? '提取此图遮罩区域内容' : role === 'recipient' ? '将供体融合到此图遮罩区域' : '点亮角色即自动保存遮罩')
                : (role === 'donor' ? 'Extract from this mask' : role === 'recipient' ? 'Blend donor into this mask' : 'Select role to save mask')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wide w-12">{language === 'zh-CN' ? '工具' : 'Tool'}</span>
            {toolBtn('brush', toolLabels.brush)}
            {toolBtn('rect', toolLabels.rect)}
            {toolBtn('ellipse', toolLabels.ellipse)}
            {toolBtn('lasso', toolLabels.lasso)}
            <div className="w-px h-5 bg-white/10 mx-1" />
            {COLORS.map(c => (
              <button key={c.value} onClick={() => setColor(c.value)} title={c.label}
                className={`w-6 h-6 rounded-full border-2 transition-all active:scale-95 ${color === c.value ? 'border-white/60 scale-110' : 'border-white/20'}`}
                style={{ background: c.value }} />
            ))}
            {tool === 'brush' && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <input type="range" min="10" max="100" value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="w-24 h-1.5 accent-white" />
                <span className="text-[11px] font-mono text-white/30 w-8">{brushSize}px</span>
              </>
            )}
          </div>

          <div className="flex items-start gap-2">
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder={language === 'zh-CN' ? '描述遮罩区域要生成的内容（可选）… Shift+Enter 换行' : 'Describe what to generate (optional)... Shift+Enter for new line'}
              rows={2}
              className="flex-1 min-h-[64px] max-h-[140px] px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 text-sm outline-none focus:border-white/20 transition-all resize-y leading-relaxed custom-scrollbar" />
            <button onClick={handleClear}
              className="self-end min-h-[40px] px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-sm font-medium hover:bg-white/8 hover:text-white/70 transition-all active:scale-95 whitespace-nowrap">
              {t.common.clear || (language === 'zh-CN' ? '清除' : 'Clear')}
            </button>
            <button onClick={handleClose}
              className="self-end min-h-[40px] px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-sm font-medium hover:bg-white/8 hover:text-white/70 transition-all active:scale-95">
              {t.common.close}
            </button>
            <button onClick={handleSubmit} disabled={!imageLoaded}
              className="self-end min-h-[40px] px-5 rounded-lg bg-blue-500/80 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 whitespace-nowrap">
              {t.buttons.generate}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default InpaintEditor;
