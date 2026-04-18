import React, { useRef, useState, useEffect } from 'react';

interface Props {
  imageDataUrl: string;
  onCrop: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function ScreenshotCropper({ imageDataUrl, onCrop, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      draw(null);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const draw = (r: { x: number; y: number; w: number; h: number } | null) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (r && r.w !== 0 && r.h !== 0) {
      const x = r.w < 0 ? r.x + r.w : r.x;
      const y = r.h < 0 ? r.y + r.h : r.y;
      const w = Math.abs(r.w);
      const h = Math.abs(r.h);
      ctx.clearRect(x, y, w, h);
      ctx.drawImage(img, x * (img.width / canvas.width), y * (img.height / canvas.height),
        w * (img.width / canvas.width), h * (img.height / canvas.height), x, y, w, h);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  };

  const toCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (e.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const pos = toCanvasPos(e);
    setStart(pos);
    setRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !start) return;
    const pos = toCanvasPos(e);
    const r = { x: start.x, y: start.y, w: pos.x - start.x, h: pos.y - start.y };
    setRect(r);
    draw(r);
  };

  const onMouseUp = () => {
    setDragging(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !rect) return;
    const x = rect.w < 0 ? rect.x + rect.w : rect.x;
    const y = rect.h < 0 ? rect.y + rect.h : rect.y;
    const w = Math.abs(rect.w);
    const h = Math.abs(rect.h);
    if (w < 4 || h < 4) return;
    const scaleX = img.width / canvas.width;
    const scaleY = img.height / canvas.height;
    const out = document.createElement('canvas');
    out.width = Math.round(w * scaleX);
    out.height = Math.round(h * scaleY);
    out.getContext('2d')!.drawImage(img,
      x * scaleX, y * scaleY, out.width, out.height,
      0, 0, out.width, out.height);
    onCrop(out.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 bg-black/80 z-10 shrink-0">
        <span className="text-white text-sm">拖拽选择区域</span>
        <button onClick={handleConfirm} disabled={!rect || Math.abs(rect.w) < 4}
          className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          确认截取
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">
          取消
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1920} height={1080}
          className="cursor-crosshair"
          style={{ userSelect: 'none', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        />
      </div>
    </div>
  );
}
