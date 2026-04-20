import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Maximize2, Minimize2, Volume2, VolumeX, Pause, Play, SkipBack, SkipForward, Info } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  watermarkedVideoUrl?: string;
  isDeveloper: boolean;
  onRerun?: () => void;
  t: {
    buttons: {
      stdDownload: string;
      originalDownload: string;
      unlockOriginal: string;
      rerender: string;
      pictureInPicture: string;
      fullscreen: string;
      normalSpeed: string;
      slowSpeed: string;
      fastSpeed: string;
    };
  };
}

const PLAYBACK_SPEEDS = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
];

export const VideoPlayer = ({ 
  videoUrl, 
  watermarkedVideoUrl, 
  isDeveloper, 
  onRerun, 
  t
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState<number | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const checkLightMode = () => {
      setIsLightMode(document.documentElement.classList.contains('light-mode'));
    };
    checkLightMode();
    const observer = new MutationObserver(checkLightMode);
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const savedPosition = localStorage.getItem(`videoPosition_${videoUrl}`);
    if (savedPosition) {
      setPlaybackPosition(parseFloat(savedPosition));
    }
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      localStorage.setItem(`videoPosition_${videoUrl}`, video.currentTime.toString());
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (playbackPosition !== null && playbackPosition > 0) {
        video.currentTime = playbackPosition;
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleEnterPictureInPicture = () => setIsPictureInPicture(true);
    const handleLeavePictureInPicture = () => setIsPictureInPicture(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('enterpictureinpicture', handleEnterPictureInPicture);
    video.addEventListener('leavepictureinpicture', handleLeavePictureInPicture);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('enterpictureinpicture', handleEnterPictureInPicture);
      video.removeEventListener('leavepictureinpicture', handleLeavePictureInPicture);
    };
  }, [videoUrl, playbackPosition]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    const container = document.querySelector('.video-container');
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.speed-control') && !target.closest('.model-info-button')) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = document.querySelector('.video-container');
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.pictureInPictureElement) {
      await video.requestPictureInPicture();
    } else {
      await document.exitPictureInPicture();
    }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = e.clientX / rect.width;
    video.currentTime = percent * duration;
  }, [duration]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = useCallback(async (withWatermark: boolean) => {
    if (!withWatermark && !isDeveloper) {
      alert(t.buttons.unlockOriginal);
      return;
    }

    let url = videoUrl;
    
    if (withWatermark) {
      // 普通下载：添加水印
      if (watermarkedVideoUrl) {
        url = watermarkedVideoUrl;
      } else {
        // 如果没有预先生成的水印视频，动态添加水印
        try {
          const { VideoWatermarkUtils } = await import('../services/videoWatermarkService');
          const result = await VideoWatermarkUtils.addWatermark(videoUrl);
          url = result.objectUrl;
        } catch (error) {
          console.error('添加水印失败:', error);
          // 如果水印添加失败，仍然允许下载原始视频
        }
      }
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `video_${withWatermark ? 'wm' : 'pro'}_${Date.now()}.mp4`;
    a.click();
  }, [videoUrl, watermarkedVideoUrl, isDeveloper, t.buttons.unlockOriginal]);

  return (
    <div className="video-container relative rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        poster=""
        disablePictureInPicture={false}
        playsInline
      >
        <source src={videoUrl} type="video/mp4" />
      </video>

      {/* 全屏模式下水印 */}
      {isFullscreen && (
        <div 
          className="absolute bottom-4 right-4 w-28 h-auto opacity-60 pointer-events-none z-10"
        >
          <img src="/public/LOGOkbitwater.png" className="w-full h-full object-contain" />
        </div>
      )}

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/60">加载中...</span>
          </div>
        </div>
      )}

      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex items-center gap-3">
          {/* 整合播放控制长条按钮 */}
          <div className="flex items-center bg-white/10 rounded-lg overflow-hidden">
            {/* 后退10秒 */}
            <button
              onClick={() => {
                const video = videoRef.current;
                if (video) video.currentTime = Math.max(0, video.currentTime - 10);
              }}
              className="flex items-center justify-center w-12 h-10 hover:bg-white/10 text-white/70 hover:text-white transition-all"
              title="后退10秒"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            
            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/20" />
            
            {/* 播放/暂停 */}
            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-14 h-10 hover:bg-white/10 text-white transition-all"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            
            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/20" />
            
            {/* 前进10秒 */}
            <button
              onClick={() => {
                const video = videoRef.current;
                if (video) video.currentTime = Math.min(duration, video.currentTime + 10);
              }}
              className="flex items-center justify-center w-12 h-10 hover:bg-white/10 text-white/70 hover:text-white transition-all"
              title="前进10秒"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 mx-3">
            <div 
              className="relative h-1.5 rounded-full cursor-pointer group seek-bar"
              onClick={handleSeek}
              style={{ 
                backgroundColor: isLightMode 
                  ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)' 
                  : 'color-mix(in srgb, var(--theme-primary) 20%, transparent)'
              }}
            >
              <div 
                className="absolute left-0 top-0 h-full rounded-full transition-all seek-bar-fill"
                style={{ 
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  backgroundColor: 'var(--theme-primary)',
                  boxShadow: '0 0 8px var(--theme-primary)'
                }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg slider-thumb"
                style={{ 
                  left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, 
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#ffffff',
                  boxShadow: `0 0 12px var(--theme-primary), 0 0 4px var(--theme-primary)`
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs" style={{ 
              color: isLightMode 
                ? 'color-mix(in srgb, var(--theme-primary) 70%, #64748b)' 
                : 'rgba(255, 255, 255, 0.6)' 
            }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <button
            onClick={toggleMute}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
            title={isMuted ? '取消静音' : '静音'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="relative speed-control">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center justify-center w-14 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all text-sm font-medium"
              title={t.buttons.normalSpeed}
            >
              {playbackSpeed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-28 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in duration-150">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed.value}
                    onClick={() => {
                      setPlaybackSpeed(speed.value);
                      setShowSpeedMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-all ${
                      playbackSpeed === speed.value 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={togglePictureInPicture}
            disabled={!document.pictureInPictureEnabled}
            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
              document.pictureInPictureEnabled
                ? 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
            title={t.buttons.pictureInPicture}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <div className="w-3 h-3 border border-current rounded" />
              <div className="w-2 h-2 border border-current rounded -ml-1 -mt-1" />
            </div>
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
            title={isFullscreen ? t.buttons.normalSpeed : t.buttons.fullscreen}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* 分隔线 */}
          <div className="w-px h-6 mx-1 bg-white/20" />

          {/* 下载按钮 - 下拉菜单 */}
          <div className="relative download-dropdown" style={{ zIndex: 100 }}>
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
              title={t.buttons.stdDownload}
            >
              <Download className="w-4 h-4" />
            </button>
            
            {/* 下拉菜单 - 向上展开 */}
            {showDownloadMenu && (
              <>
                <div className="absolute bottom-full right-0 mb-1 w-44 bg-gray-900/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden" style={{ zIndex: 200 }}>
                  {/* 带水印下载 */}
                  <button
                    onClick={() => { 
                      handleDownload(true);
                      setShowDownloadMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.buttons.stdDownload}</span>
                  </button>
                  
                  {/* 无水印下载（根据权限显示） */}
                  {isDeveloper ? (
                    <button
                      onClick={() => { 
                        handleDownload(false);
                        setShowDownloadMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/10 transition-colors text-emerald-400 hover:text-emerald-300"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t.buttons.originalDownload}</span>
                    </button>
                  ) : (
                    <div className="w-full flex items-center gap-3 px-4 py-3 text-sm opacity-50 cursor-not-allowed text-white/40">
                      <Download className="w-4 h-4" />
                      <span>{t.buttons.unlockOriginal}</span>
                    </div>
                  )}
                </div>
                {/* 点击外部关闭菜单 */}
                <div className="fixed inset-0" onClick={() => setShowDownloadMenu(false)} style={{ zIndex: 150 }} />
              </>
            )}
          </div>

          {/* 重新生成 - 图标按钮 */}
          {onRerun && (
            <button
              onClick={onRerun}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 transition-all"
              title={t.buttons.rerender}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
