
import piexif from 'piexifjs';
import { ContentIdService } from './contentIdService';

// 将字符串编码为二进制位数组
function strToBits(str: string): number[] {
  const bits: number[] = [];
  // 4字节长度头 + 内容
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
    data[i * 4] = (data[i * 4] & 0xFE) | bits[i]; // R 通道最低位
  }
  ctx.putImageData(imageData, 0, 0);
}

export const WatermarkUtils = {
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

  async addWatermark(imageSrc: string, logoSrc: string = '/LOGOkbitwater.png', userId?: string): Promise<{ dataUrl: string; contentId: string }> {
    const contentId = this.generateContentId();
    const generatedAt = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const watermarkWidth = canvas.width * 0.15;
        const margin = canvas.width * 0.03;

        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.onload = () => {
          const logoWidth = watermarkWidth;
          const logoHeight = (logo.height / logo.width) * logoWidth;
          
          const watermarkX = canvas.width - watermarkWidth - margin;
          const watermarkY = canvas.height - logoHeight - margin;
          
          ctx.globalAlpha = 0.5;
          
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCanvas.width = logo.width;
            tempCanvas.height = logo.height;
            tempCtx.drawImage(logo, 0, 0);
            tempCtx.globalCompositeOperation = 'source-in';
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          }
          
          if (tempCtx) {
            ctx.drawImage(tempCanvas, watermarkX, watermarkY, logoWidth, logoHeight);
          }

          // 隐式标识：LSB 隐写
          ctx.globalAlpha = 1.0;
          const payload = `v=1;type=image;platform=KBITAI;id=${contentId};ts=${new Date().toISOString()}`;
          embedLSB(ctx, canvas.width, canvas.height, payload);

          const dataUrl = canvas.toDataURL('image/png');
          resolve({ dataUrl, contentId });
          // 异步注册到服务器，不阻塞返回
          fetch('/api/content/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentId, contentType: 'image', userId, metadata: { generatedAt, platform: 'KBITAI' } })
          }).catch(() => {});
        };
        logo.onerror = () => {
          // 添加文字水印
          ctx.globalAlpha = 0.5;
          const fontSize = Math.max(12, canvas.width * 0.02);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = "white";
          ctx.textAlign = "right";
          const timestamp = new Date().toISOString().split('T')[0];
          const text = `AI Generated | Chief Image Architect | ${timestamp}`;
          ctx.fillText(text, canvas.width - 20, canvas.height - 20);
          
          // 隐式标识：LSB 隐写
          ctx.globalAlpha = 1.0;
          const payload = `v=1;type=image;platform=KBITAI;id=${contentId};ts=${new Date().toISOString()}`;
          embedLSB(ctx, canvas.width, canvas.height, payload);
          
          const dataUrl = canvas.toDataURL('image/png');
          resolve({ dataUrl, contentId });
          fetch('/api/content/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentId, contentType: 'image', userId, metadata: { generatedAt, platform: 'KBITAI' } })
          }).catch(() => {});
        };
        logo.src = logoSrc;
      };
      img.onerror = reject;
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
