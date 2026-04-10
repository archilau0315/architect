import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { ContentIdService } from './contentIdService';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;

export const VideoWatermarkUtils = {
  generateContentId(): string {
    return ContentIdService.generateId();
  },

  async addWatermark(
    videoUrl: string, 
    logoUrl: string = '/architect/Com_Logo.png',
    onProgress?: (progress: number) => void
  ): Promise<{ objectUrl: string; contentId: string }> {
    const contentId = this.generateContentId();
    
    try {
      if (!ffmpegLoaded || !ffmpeg) {
        onProgress?.(5);
        ffmpeg = new FFmpeg();
        
        ffmpeg.on('log', ({ message }) => {
          console.log('[FFmpeg]', message);
        });
        
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegLoaded = true;
      }
      
      onProgress?.(10);
      
      console.log('[Video Watermark] 开始下载视频:', videoUrl.substring(0, 100) + '...');
      
      const videoData = await fetchFile(videoUrl);
      console.log('[Video Watermark] 视频下载完成, 大小:', videoData.byteLength, 'bytes');
      
      if (videoData.byteLength === 0) {
        throw new Error('视频下载失败，文件为空');
      }
      
      const videoSizeMB = videoData.byteLength / (1024 * 1024);
      if (videoSizeMB > 100) {
        throw new Error(`视频文件过大 (${videoSizeMB.toFixed(1)}MB)，浏览器水印处理限制为100MB以内`);
      }
      
      await ffmpeg.writeFile('input.mp4', videoData);
      onProgress?.(20);
      console.log('[Video Watermark] 视频已写入 FFmpeg 文件系统');
      
      try {
        console.log('[Video Watermark] 尝试加载 Logo:', logoUrl);
        const logoData = await fetchFile(logoUrl);
        console.log('[Video Watermark] Logo 下载完成, 大小:', logoData.byteLength, 'bytes');
        
        if (logoData.byteLength === 0) {
          throw new Error('Logo 下载失败，文件为空');
        }
        
        await ffmpeg.writeFile('logo.png', logoData);
        console.log('[Video Watermark] Logo 已写入文件系统');
        
        onProgress?.(30);
        
        console.log('[Video Watermark] 开始执行 FFmpeg 命令 (带 Logo + 元数据)...');
        
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-i', 'logo.png',
          '-filter_complex',
          '[1:v]scale=iw*0.30:-1,format=rgba,lutrgb=r=255:g=255:b=255,lut=a=val*0.5[logo];[0:v][logo]overlay=W-w-20:H-h-20',
          '-metadata', 'title=AI Generated Content',
          '-metadata', `comment=Platform:KBITAI|ID:${contentId}`,
          '-metadata', 'software=KBITAI AI Image Architect',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-c:a', 'copy',
          '-y',
          'output.mp4'
        ]);
        console.log('[Video Watermark] FFmpeg 命令执行完成');
      } catch (logoError) {
        console.log('[Video Watermark] Logo not found, copying video without watermark');
        
        onProgress?.(30);
        
        console.log('[Video Watermark] 开始执行 FFmpeg 命令 (复制视频 + 元数据)...');
        
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-metadata', 'title=AI Generated Content',
          '-metadata', `comment=Platform:KBITAI|ID:${contentId}`,
          '-metadata', 'software=KBITAI AI Image Architect',
          '-c', 'copy',
          '-y',
          'output.mp4'
        ]);
        console.log('[Video Watermark] FFmpeg 命令执行完成');
      }
      
      onProgress?.(90);
      
      console.log('[Video Watermark] 读取输出文件...');
      const data = await ffmpeg.readFile('output.mp4');
      console.log('[Video Watermark] 输出文件大小:', (data as Uint8Array).byteLength, 'bytes');
      
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
  }
};
