import { CustomModel, CreativeDomain } from "../types.ts";

// 多颜色遮罩定义
export const MASK_COLORS = [
  { name: 'white', rgb: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF' },
  { name: 'red', rgb: { r: 255, g: 0, b: 0 }, hex: '#FF0000' },
  { name: 'green', rgb: { r: 0, g: 255, b: 0 }, hex: '#00FF00' },
  { name: 'blue', rgb: { r: 0, g: 0, b: 255 }, hex: '#0000FF' },
  { name: 'yellow', rgb: { r: 255, g: 255, b: 0 }, hex: '#FFFF00' },
  { name: 'cyan', rgb: { r: 0, g: 255, b: 255 }, hex: '#00FFFF' },
];

// 检测遮罩中存在的颜色
export const detectMaskColors = async (maskDataUrl: string): Promise<typeof MASK_COLORS> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx!.drawImage(img, 0, 0);
      
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const detectedColors: typeof MASK_COLORS = [];
      const tolerance = 30;
      
      for (const colorDef of MASK_COLORS) {
        let found = false;
        for (let i = 0; i < data.length && !found; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          if (
            Math.abs(r - colorDef.rgb.r) <= tolerance &&
            Math.abs(g - colorDef.rgb.g) <= tolerance &&
            Math.abs(b - colorDef.rgb.b) <= tolerance
          ) {
            found = true;
          }
        }
        if (found) {
          detectedColors.push(colorDef);
        }
      }
      
      resolve(detectedColors);
    };
    
    img.src = maskDataUrl;
  });
};

// 把彩色遮罩叠加到底图上（半透明显示，用于语义遮盖方式）
export const overlayMaskOnBaseImage = async (baseImageDataUrl: string, maskDataUrl: string, opacity: number = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    const baseImg = new Image();
    baseImg.onload = () => {
      const maskImg = new Image();
      maskImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(baseImageDataUrl);
          return;
        }
        
        // 1. 先绘制底图
        ctx.drawImage(baseImg, 0, 0);
        
        // 2. 在底图上叠加遮罩（半透明）
        ctx.globalAlpha = opacity;
        ctx.drawImage(maskImg, 0, 0, baseImg.width, baseImg.height);
        ctx.globalAlpha = 1.0;
        
        // 3. 输出为 JPEG
        const resultDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        console.log(`[语义遮盖] 已将遮罩叠加到底图，尺寸: ${canvas.width}x${canvas.height}`);
        resolve(resultDataUrl);
      };
      maskImg.onerror = () => {
        console.error('[语义遮盖] 遮罩图片加载失败');
        resolve(baseImageDataUrl);
      };
      maskImg.src = maskDataUrl;
    };
    baseImg.onerror = () => {
      console.error('[语义遮盖] 底图加载失败');
      resolve(baseImageDataUrl);
    };
    baseImg.src = baseImageDataUrl;
  });
};

// 压缩图像
export const compressImage = async (dataUrl: string, maxSize: number = 1024, quality: number = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const max = maxSize;
      
      if (width > max || height > max) {
        if (width > height) {
          height = Math.round(height * (max / width));
          width = max;
        } else {
          width = Math.round(width * (max / height));
          height = max;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

// 添加水印
export const applyWatermark = async (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(base64);

      // 1. 绘制原图
      ctx.drawImage(img, 0, 0);

      // 2. 绘制 Logo 水印 (左下角)
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.onload = () => {
        const logoWidth = canvas.width * 0.15; // 占宽度的 15%
        const logoHeight = (logo.height / logo.width) * logoWidth;
        ctx.globalAlpha = 0.3; // 半透明
        ctx.drawImage(logo, 20, canvas.height - logoHeight - 20, logoWidth, logoHeight);
        
        // 3. 绘制文字水印 (右下角)
        ctx.globalAlpha = 0.5;
        const fontSize = Math.max(12, canvas.width * 0.02);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = "white";
        ctx.textAlign = "right";
        const timestamp = new Date().toISOString().split('T')[0];
        const text = `AI Generated | Chief Image Architect | ${timestamp}`;
        ctx.fillText(text, canvas.width - 20, canvas.height - 20);
        
        resolve(canvas.toDataURL("image/png"));
      };
      logo.onerror = () => {
        // 如果 Logo 加载失败，仅绘制文字
        ctx.globalAlpha = 0.5;
        const fontSize = Math.max(12, canvas.width * 0.02);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = "white";
        ctx.textAlign = "right";
        ctx.fillText("AI Generated | Chief Image Architect", canvas.width - 20, canvas.height - 20);
        resolve(canvas.toDataURL("image/png"));
      };
      logo.src = "/architect/Com_Logo.png";
    };
    img.src = base64;
  });
};

// 底图缓存管理
interface BaseImageCache {
  cacheId: string;
  base64: string;
  model: string;
  createdAt: number;
  ttl: number; // 有效期（毫秒）
}

const baseImageCaches: Map<string, BaseImageCache> = new Map();

// 生成底图缓存键
export const generateBaseImageCacheKey = (base64: string, model: string): string => {
  return `base_image:${model}:${btoa(base64.substring(0, 1000))}`;
};

// 检查底图缓存是否有效
export const getValidBaseImageCache = (base64: string, model: string): BaseImageCache | null => {
  const key = generateBaseImageCacheKey(base64, model);
  const cache = baseImageCaches.get(key);
  
  if (!cache) return null;
  
  const now = Date.now();
  if (now > cache.createdAt + cache.ttl) {
    baseImageCaches.delete(key);
    return null;
  }
  
  return cache;
};

// 设置底图缓存
export const setBaseImageCache = (base64: string, model: string, cacheId: string, ttl: number): void => {
  const key = generateBaseImageCacheKey(base64, model);
  baseImageCaches.set(key, {
    cacheId,
    base64,
    model,
    createdAt: Date.now(),
    ttl
  });
};
