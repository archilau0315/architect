import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { ContentIdService } from './contentIdService';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;
let logoCache: Uint8Array | null = null;

export const VideoWatermarkUtils = {
  generateContentId(): string {
    return ContentIdService.generateId();
  },

  async addWatermark(
    videoUrl: string, 
    logoUrl: string = '/LOGOkbitwater.png',
    onProgress?: (progress: number) => void
  ): Promise<{ objectUrl: string; contentId: string }> {
    const contentId = this.generateContentId();
    
    try {
      if (!ffmpegLoaded || !ffmpeg) {
        onProgress?.(5);
        ffmpeg = new FFmpeg();
        
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegLoaded = true;
      }
      
      onProgress?.(15);
      
      const videoData = await fetchFile(videoUrl);
      
      if (videoData.byteLength === 0) {
        throw new Error('视频下载失败，文件为空');
      }
      
      const videoSizeMB = videoData.byteLength / (1024 * 1024);
      if (videoSizeMB > 100) {
        throw new Error(`视频文件过大 (${videoSizeMB.toFixed(1)}MB)，浏览器水印处理限制为100MB以内`);
      }
      
      await ffmpeg.writeFile('input.mp4', videoData);
      onProgress?.(25);
      
      if (!logoCache) {
        const logoData = await fetchFile(logoUrl);
        if (logoData.byteLength > 0) {
          logoCache = logoData as Uint8Array;
        }
      }
      
      if (logoCache) {
        await ffmpeg.writeFile('logo.png', logoCache);
        onProgress?.(35);
        
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-i', 'logo.png',
          '-filter_complex',
          '[1:v]scale=iw*0.40:-1,format=rgba,lutrgb=r=255:g=255:b=255,lut=a=val*0.5[logo];[0:v][logo]overlay=W-w-20:H-h-20',
          '-metadata', 'title=AI Generated Content',
          '-metadata', `comment=Platform:KBITAI|ID:${contentId}`,
          '-metadata', 'software=KBITAI AI Image Architect',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-c:a', 'copy',
          '-y',
          'output.mp4'
        ]);
      } else {
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-vf', `drawtext=text='AI Generated | KbitAI':fontcolor=white:fontsize=20:box=1:boxcolor=black@0.5:boxborderw=3:x=W-tw-15:y=H-th-15`,
          '-metadata', 'title=AI Generated Content',
          '-metadata', `comment=Platform:KBITAI|ID:${contentId}`,
          '-metadata', 'software=KBITAI AI Image Architect',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-c:a', 'copy',
          '-y',
          'output.mp4'
        ]);
      }
      
      onProgress?.(90);
      
      const data = await ffmpeg.readFile('output.mp4');
      
      const blob = new Blob([data], { type: 'video/mp4' });
      const objectUrl = URL.createObjectURL(blob);
      
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.mp4');
      try { await ffmpeg.deleteFile('logo.png'); } catch (e) {}
      
      onProgress?.(100);
      
      return { objectUrl, contentId };
    } catch (error: any) {
      console.error('[Video Watermark] Error:', error);
      if (error.message?.includes('FS error') || error.name === 'ErrnoError') {
        throw new Error('浏览器内存不足，无法处理此视频。');
      }
      throw error;
    }
  },
  
  isFFmpegLoaded(): boolean {
    return ffmpegLoaded;
  },
  
  async loadFFmpeg(onProgress?: () => void): Promise<void> {
    if (!ffmpegLoaded) {
      ffmpeg = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegLoaded = true;
      onProgress?.();
    }
  },
  
  async preloadLogo(logoUrl: string = '/LOGOkbitwater.png'): Promise<void> {
    try {
      const logoData = await fetchFile(logoUrl);
      if (logoData.byteLength > 0) {
        logoCache = logoData as Uint8Array;
        console.log('[Logo] 预加载完成');
      }
    } catch (e) {
      console.warn('[Logo] 预加载失败:', e);
    }
  }
};
