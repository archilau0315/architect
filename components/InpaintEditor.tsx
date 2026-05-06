import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getTranslation } from '../i18n/locales.ts';
import type { Language } from '../i18n/locales.ts';

interface InpaintEditorProps {
  imageUrl: string;
  onSaveMask: (maskDataUrl: string, role: 'donor' | 'recipient') => void;
  onSubmit: (maskDataUrl: string, prompt: string, role: 'donor' | 'recipient' | null) => void;
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
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const lastClickTime = useRef<number>(0);
  const DOUBLE_CLICK_MS = 350;
  const undoStack = useRef<ImageData[]>([]);
  const MAX_UNDO = 30;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const lassoPoints = useRef<{ x: number; y: number }[]>([]);
  const snapshotRef = useRef<ImageData | null>(null);
  
  const strokePoints = useRef<Point[]>([]);
  const lastPoint = useRef<Point | null>(null);
  const velocity = useRef<number>(0);

  const MIN_ZOOM = 0.5;
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
      setOriginalImageSize({ width: img.width, height: img.height });
      setImageLoaded(true);
      resetView();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const saveToUndoStack = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const mCtx = maskCanvas.getContext('2d')!;
    const imgData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    undoStack.current.push(imgData);
    if (undoStack.current.length > MAX_UNDO) {
      undoStack.current.shift();
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prevData = undoStack.current.pop();
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !prevData) return;
    const mCtx = maskCanvas.getContext('2d')!;
    mCtx.putImageData(prevData, 0, 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const canvasRect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      const touch = e.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rectLeft = canvasRect.left;
    const rectTop = canvasRect.top;

    const scaleX = canvas.width / (canvasRect.width || 1);
    const scaleY = canvas.height / (canvasRect.height || 1);
    
    const imageX = (clientX - rectLeft) * scaleX;
    const imageY = (clientY - rectTop) * scaleY;
    
    const clampedX = Math.max(0, Math.min(canvas.width, imageX));
    const clampedY = Math.max(0, Math.min(canvas.height, imageY));
    
    setCursorPos({ x: clampedX, y: clampedY });
    
    return {
      x: clampedX,
      y: clampedY,
    };
  }, [pan]);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number) => {
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
  }, []);

  const drawSmoothStroke = useCallback((ctx: CanvasRenderingContext2D, points: Point[], size: number) => {
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
  }, []);

  const getAdaptiveSampleDistance = useCallback((vel: number): number => {
    const normalizedVel = Math.min(vel / 200, 1);
    return MIN_SAMPLE_DISTANCE + (MAX_SAMPLE_DISTANCE - MIN_SAMPLE_DISTANCE) * normalizedVel;
  }, []);

  const handleBrushStroke = useCallback((ctx: CanvasRenderingContext2D, newPoint: Point) => {
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
  }, [color, brushSize, getAdaptiveSampleDistance, drawLine]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    try {
      e.preventDefault();
    } catch (err) {}

    const now = Date.now();
    if (now - lastClickTime.current < DOUBLE_CLICK_MS && isDrawing) {
      lastClickTime.current = 0;
      setIsDrawing(false);
      if (tool === 'brush') {
        strokePoints.current = [];
        lastPoint.current = null;
        velocity.current = 0;
      }
      snapshotRef.current = null;
      return;
    }
    lastClickTime.current = now;

    saveToUndoStack();

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
  }, [getPos, tool, color, brushSize, isDrawing, saveToUndoStack]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    try {
      e.preventDefault();
    } catch (err) {
      // 被动事件监听器中无法调用 preventDefault，忽略此错误
    }
    
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
      if (snapshotRef.current) {
        mCtx.putImageData(snapshotRef.current, 0, 0);
      }
      mCtx.strokeStyle = color;
      mCtx.lineWidth = 2;
      mCtx.beginPath();
      lassoPoints.current.forEach((p, i) => i === 0 ? mCtx.moveTo(p.x, p.y) : mCtx.lineTo(p.x, p.y));
      mCtx.stroke();
    } else {
      if (snapshotRef.current) {
        mCtx.putImageData(snapshotRef.current, 0, 0);
      }
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
  }, [isPanning, panStart, isDrawing, getPos, tool, color, brushSize, handleBrushStroke]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing) return;
    
    if (tool === 'rect' || tool === 'ellipse') {
      setIsDrawing(false);
      snapshotRef.current = null;
    } else if (tool === 'lasso' && lassoPoints.current.length > 2) {
      const mCtx = maskCanvasRef.current!.getContext('2d')!;
      if (snapshotRef.current) mCtx.putImageData(snapshotRef.current, 0, 0);
      mCtx.fillStyle = color;
      mCtx.beginPath();
      lassoPoints.current.forEach((p, i) => i === 0 ? mCtx.moveTo(p.x, p.y) : mCtx.lineTo(p.x, p.y));
      mCtx.closePath();
      mCtx.fill();
      lassoPoints.current = [];
    }
  }, [isDrawing, tool, color]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    setZoom(newZoom);
  }, [zoom]);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleContainerMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2 && isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

  const handleContainerMouseLeave = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isDrawing) {
      setIsDrawing(false);
      if (tool === 'brush') {
        strokePoints.current = [];
        lastPoint.current = null;
        velocity.current = 0;
      }
      snapshotRef.current = null;
    }
  }, [isPanning, isDrawing, tool]);

  const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    if ('preventDefault' in e) {
      try { (e as Event).preventDefault(); } catch(_) {}
    }
    
    const touchE = 'touches' in e ? e : (e as React.TouchEvent);
    if (touchE.touches.length === 1) {
      const now = Date.now();
      if (now - lastClickTime.current < DOUBLE_CLICK_MS && isDrawing) {
        lastClickTime.current = 0;
        setIsDrawing(false);
        if (tool === 'brush') {
          strokePoints.current = [];
          lastPoint.current = null;
          velocity.current = 0;
        }
        snapshotRef.current = null;
        return;
      }
      lastClickTime.current = now;

      saveToUndoStack();

      const pos = getPos(touchE);
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
    } else if (touchE.touches.length === 2) {
      const touch1 = touchE.touches[0];
      const touch2 = touchE.touches[1];
      const initialDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      const initialZoom = zoom;
      const handlePinch = (evt: TouchEvent) => {
        if (evt.touches.length !== 2) return;
        const t1 = evt.touches[0];
        const t2 = evt.touches[1];
        const distance = Math.sqrt(
          Math.pow(t2.clientX - t1.clientX, 2) + 
          Math.pow(t2.clientY - t1.clientY, 2)
        );
        const scale = distance / initialDistance;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom * scale));
        setZoom(newZoom);
      };
      document.addEventListener('touchmove', handlePinch, { passive: false });
      document.addEventListener('touchend', () => {
        document.removeEventListener('touchmove', handlePinch);
      }, { once: true });
    }
  }, [zoom, pan.x, pan.y, tool, color, brushSize, getPos, isDrawing, saveToUndoStack]);

  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if ('preventDefault' in e) {
      try { (e as Event).preventDefault(); } catch(_) {}
    }
    if (e.touches.length === 1 && isDrawing) {
      const pos = getPos(e);
      const mCtx = maskCanvasRef.current!.getContext('2d')!;
      const start = startPos.current!;

      if (tool === 'brush') {
        const newPoint = { x: pos.x, y: pos.y, timestamp: Date.now() };
        handleBrushStroke(mCtx, newPoint);
      } else if (tool === 'lasso') {
        lassoPoints.current.push(pos);
        if (snapshotRef.current) {
          mCtx.putImageData(snapshotRef.current, 0, 0);
        }
        mCtx.strokeStyle = color;
        mCtx.lineWidth = 2;
        mCtx.beginPath();
        lassoPoints.current.forEach((p, i) => i === 0 ? mCtx.moveTo(p.x, p.y) : mCtx.lineTo(p.x, p.y));
        mCtx.stroke();
      } else {
        if (snapshotRef.current) {
          mCtx.putImageData(snapshotRef.current, 0, 0);
        }
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
  }, [isDrawing, getPos, tool, color, brushSize, handleBrushStroke]);

  useEffect(() => {
    const canvas = maskCanvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;

    const onWheel = (e: WheelEvent) => { e.preventDefault(); handleWheel(e as unknown as React.WheelEvent); };
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); handleTouchStart(e as unknown as React.TouchEvent); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); handleTouchMove(e as unknown as React.TouchEvent); };

    container.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      container.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove]);

  const handleTouchEnd = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    }
    
    if (!isDrawing) return;
    
    if (tool === 'rect' || tool === 'ellipse') {
      setIsDrawing(false);
      snapshotRef.current = null;
    } else if (tool === 'lasso' && lassoPoints.current.length > 2) {
      const mCtx = maskCanvasRef.current!.getContext('2d')!;
      if (snapshotRef.current) mCtx.putImageData(snapshotRef.current, 0, 0);
      mCtx.fillStyle = color;
      mCtx.beginPath();
      lassoPoints.current.forEach((p, i) => i === 0 ? mCtx.moveTo(p.x, p.y) : mCtx.lineTo(p.x, p.y));
      mCtx.closePath();
      mCtx.fill();
      lassoPoints.current = [];
    }
  }, [isPanning, isDrawing, tool, color]);

  const handleSaveMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !role) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskCanvas.width;
    tempCanvas.height = maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    tempCtx.drawImage(maskCanvas, 0, 0);
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    const maskDataUrl = tempCanvas.toDataURL('image/png');
    
    onSaveMask(maskDataUrl, role);
  }, [role, onSaveMask]);

  useEffect(() => {
    handleSaveMask();
  }, [role, handleSaveMask]);

  const handleSubmit = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskCanvas.width;
    tempCanvas.height = maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    tempCtx.drawImage(maskCanvas, 0, 0);
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    const maskDataUrl = tempCanvas.toDataURL('image/png');
    
    onSubmit(maskDataUrl, prompt, role);
  }, [prompt, role, onSubmit]);

  const handleClear = useCallback(() => {
    saveToUndoStack();
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const mCtx = maskCanvas.getContext('2d')!;
    mCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, [saveToUndoStack]);

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
            <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all active:scale-95">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-hidden p-6 flex items-center justify-center bg-black/20"
          onMouseDown={handleContainerMouseDown}
          onMouseUp={handleContainerMouseUp}
          onMouseLeave={handleContainerMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: isPanning ? 'grabbing' : tool === 'brush' ? 'crosshair' : 'default' }}
        >
          <div
            className="relative transition-transform duration-100 ease-out"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            <canvas 
              ref={canvasRef} 
              className="relative block"
              style={{
                maxWidth: '100%',
                maxHeight: isFullscreen ? '85vh' : '55vh',
              }}
            />
            <canvas
              ref={maskCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute top-0 left-0 cursor-crosshair"
              style={{
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

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wide w-12">{language === 'zh-CN' ? '工具' : 'Tool'}</span>
            {(Object.keys(toolLabels) as Tool[]).map(t => (
              <button key={t} onClick={() => setTool(t)}
                className={`min-h-[36px] px-4 rounded-lg text-[12px] font-medium transition-all active:scale-95 ${tool === t ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/[0.04] border border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70'}`}>
                {toolLabels[t]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wide w-12">{language === 'zh-CN' ? '颜色' : 'Color'}</span>
            {COLORS.map(c => (
              <button key={c.value} onClick={() => setColor(c.value)}
                className={`w-8 h-8 rounded-full transition-all active:scale-95 ${color === c.value ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-black/50' : ''}`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wide w-12 ml-4">{language === 'zh-CN' ? '大小' : 'Size'}</span>
            <input type="range" min={1} max={100} value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              className="w-24 h-1.5 accent-blue-500" />
            <span className="text-[11px] font-mono text-white/30 w-8">{brushSize}px</span>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleUndo} className="min-h-[36px] px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70 transition-all active:scale-95 text-[12px] font-medium" title={language === 'zh-CN' ? '回退 (Ctrl+Z)' : 'Undo (Ctrl+Z)'}>
              ↩ {language === 'zh-CN' ? '回退' : 'Undo'}
            </button>
            <button onClick={handleClear} className="min-h-[36px] px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:bg-white/8 hover:text-white/70 transition-all active:scale-95 text-[12px] font-medium">
              {language === 'zh-CN' ? '清除' : 'Clear'}
            </button>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={language === 'zh-CN' ? '描述您想要修改的内容（可选）\n支持多行输入...' : 'Describe what you want to modify (optional)\nMulti-line supported...'}
              rows={2}
              className="flex-1 min-h-[36px] max-h-[80px] px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/80 placeholder-white/25 text-[12px] focus:outline-none focus:border-blue-500/50 resize-y"
            />
            <button onClick={handleSubmit}
              className="min-h-[36px] px-6 rounded-lg text-[12px] font-medium transition-all active:scale-95 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600">
              {language === 'zh-CN' ? '提交修改' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InpaintEditor;