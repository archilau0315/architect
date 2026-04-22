
import piexif from 'piexifjs';
import { ContentIdService } from './contentIdService';

// 将字符串编码为二进制位数组
function strToBits(str: string): number[] {
  const bits: number[] = [];
  const len = str.length;
  for (let i = 24; i >= 0; i -= 8) bits.push(...Array.from({length: 8}, (_, b) => (len >> (i - b)) & 1));
  for (const c of str) {
    const code = c.charCodeAt(0);
    for (let b = 7; b >= 0; b--) bits.push((code >> b) & 1);
  }
  return bits;
}

// LSB 隐写：将标识信息写入图片像素 R 通道最低位
function embedLSB(ctx: CanvasRenderingContext2D, w: number, h: number, payload: string): void {
  const bits = strToBits(payload);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < bits.length && i * 4 < data.length; i++) {
    data[i * 4] = (data[i * 4] & 0xFE) | bits[i];
  }
  ctx.putImageData(imageData, 0, 0);
}

// ========== 预加载并缓存Logo（只加载一次） ==========
let _cachedLogo: HTMLImageElement | null = null;
let _logoLoadPromise: Promise<HTMLImageElement> | null = null;

function preloadLogoOnce(): Promise<HTMLImageElement> {
  if (_cachedLogo) return Promise.resolve(_cachedLogo);
  if (_logoLoadPromise) return _logoLoadPromise;

  _logoLoadPromise = new Promise((resolve, reject) => {
    // 候选路径（按优先级排序）：
    // 1. /public/LOGOkbitwater.png    → Nginx alias 直通 /www/wwwroot/kbitai.com.cn/public/ （首选，1步直达）
    // 2. /architect/LOGOkbitwater.png → Nginx rewrite ^/architect/(LOGOkbitwater) → /public/$1   （备用）
    const candidates = [
      '/public/LOGOkbitwater.png',
      '/architect/LOGOkbitwater.png',
    ];
    let idx = 0;

    function tryNext(): void {
      if (idx >= candidates.length) {
        const err = new Error(`[水印] ❌ Logo加载失败: ${candidates.join(', ')}`);
        console.error(err.message);
        reject(err);
        return;
      }
      const img = new Image();
      // 【关键】同域请求不要设置 crossOrigin！
      // 设置 crossOrigin='anonymous' 会要求服务器返回 CORS 头，
      // 但 Nginx 给 /public/ 的静态文件没加 CORS 头，会导致 canvas 被污染无法绘制。
      // 同域图片天然可以绘制到 canvas，不需要 CORS 声明。
      img.onload = () => {
        _cachedLogo = img;
        console.log(`[水印] ✅ Logo预加载成功: ${candidates[idx - 1]} (${img.width}×${img.height})`);
        resolve(img);
      };
      img.onerror = () => { idx++; tryNext(); };
      img.src = candidates[idx++];
    }
    tryNext();
  });

  return _logoLoadPromise;
}

export const WatermarkUtils = {
  // 统一完成水印处理：LSB隐写 + 返回结果 + 静默注册
  finishWatermark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, contentId: string, generatedAt: string, userId: string | undefined, resolve: (value: { dataUrl: string; contentId: string }) => void) {
    ctx.globalAlpha = 1.0;
    // LSB隐式标识（不可见）
    const payload = `v=1;type=image;platform=KBITAI;id=${contentId};ts=${generatedAt}`;
    embedLSB(ctx, canvas.width, canvas.height, payload);

    const dataUrl = canvas.toDataURL('image/png');
    resolve({ dataUrl, contentId });

    // 异步注册到服务器 — 用 Image beacon 彻底静默，不触发控制台网络错误
    setTimeout(() => {
      try {
        const regPayload = JSON.stringify({ contentId, contentType: 'image', userId, metadata: { generatedAt, platform: 'KBITAI' } });
        const beacon = new Image();
        beacon.onload = beacon.onerror = () => {};
        const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? ''
          : 'https://api.kbitai.com.cn';
        beacon.src = `${apiBase}/api/content/register?d=${encodeURIComponent(regPayload.substring(0, 200))}`;
      } catch(_e) { /* 完全静默 */ }
    }, 100);
  },

  generateContentId(): string {
    return ContentIdService.generateId();
  },

  addAIMetadata(dataUrl: string, contentId: string): string {
    try {
      const exifObj: any = {
        '0th': {
          [piexif.ImageIFD.Software]: 'KBITAI AI Image Architect',
          [piexif.ImageIFD.ImageDescription]: 'AI Generated Content',
          [piexif.ImageIFD.Make]: 'KBITAI',
        },
        'Exif': {
          [piexif.ExifIFD.UserComment]: `AI Generated|Platform:KBITAI|ID:${contentId}|Time:${new Date().toISOString()}`,
        }
      };

      const exifStr = piexif.dump(exifObj);

      const base64Data = dataUrl.split(',')[1];
      const binaryData = atob(base64Data);

      const exifBytes = new Uint8Array(
        Array.from(exifStr).map((c: string) => c.charCodeAt(0))
      );

      const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      let insertPos = 8;

      for (let i = 0; i < binaryData.length - 8; i++) {
        if (
          binaryData.charCodeAt(i) === pngSignature[0] &&
          binaryData.charCodeAt(i+1) === pngSignature[1] &&
          binaryData.charCodeAt(i+2) === pngSignature[2] &&
          binaryData.charCodeAt(i+3) === pngSignature[3]
        ) {
          insertPos = i + 8;
          break;
        }
      }

      const binaryArray = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        binaryArray[i] = binaryData.charCodeAt(i);
      }

      const newData = new Uint8Array(binaryArray.length + exifBytes.length);
      newData.set(binaryArray.slice(0, insertPos));
      newData.set(exifBytes, insertPos);
      newData.set(binaryArray.slice(insertPos), insertPos + exifBytes.length);

      let base64 = '';
      const chunkSize = 8192;
      for (let i = 0; i < newData.length; i += chunkSize) {
        base64 += String.fromCharCode(...newData.subarray(i, i + chunkSize));
      }
      base64 = btoa(base64);
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('[Metadata] Failed to add EXIF:', error);
      return dataUrl;
    }
  },

  /**
   * 给图片添加可见的Logo水印（右下角）
   * 只使用 LOGOkbitwater.png 图片，绝不使用文字水印。
   * 如果Logo加载失败，抛出异常而不是降级到文字。
   */
  async addWatermark(imageSrc: string, _logoSrc?: string, userId?: string): Promise<{ dataUrl: string; contentId: string }> {
    const contentId = this.generateContentId();
    const generatedAt = new Date().toISOString();

    console.log(`[水印服务] 🚀 开始添加水印...`);

    // 预加载Logo图片（带缓存，只加载一次；所有路径都失败则reject）
    const logoImg = await preloadLogoOnce();

    return new Promise((resolve, reject) => {
      const img = new Image();
      // 原图是base64 data URL，同源不需要crossOrigin
      img.onload = () => {
        console.log(`[水印服务] 原图加载成功 ${img.width}×${img.height}`);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context failed')); return; }

        ctx.drawImage(img, 0, 0);

        // 绘制Logo可见水印（右下角）
        const logoW = Math.max(80, canvas.width * 0.15);
        const logoH = (logoImg.height / logoImg.width) * logoW;
        const margin = Math.max(10, canvas.width * 0.03);
        ctx.globalAlpha = 0.75;
        ctx.drawImage(
          logoImg,
          canvas.width - logoW - margin,
          canvas.height - logoH - margin,
          logoW,
          logoH
        );
        console.log(`[水印] ✅ Logo水印已添加 (${Math.round(logoW)}×${Math.round(logoH)})`);

        // 完成处理：LSB隐写 + 返回结果
        this.finishWatermark(ctx, canvas, contentId, generatedAt, userId, resolve);
      };
      img.onerror = (e) => {
        console.error('[水印服务] 原图加载失败', e);
        reject(e);
      };
      img.src = imageSrc;
    });
  },

  logDownload(data: { imageId: string, type: 'standard' | 'pro' | 'free_pro_quota', userId?: string, contentId?: string }) {
    const logEntry = {
      ...data,
      timestamp: new Date().toISOString(),
      ip: "127.0.0.1",
      userAgent: navigator.userAgent
    };

    const logs = JSON.parse(localStorage.getItem('download_audit_logs') || '[]');
    logs.push(logEntry);
    localStorage.setItem('download_audit_logs', JSON.stringify(logs.slice(-100)));
    console.log("[Audit Log] Download recorded:", logEntry);
  }
};
