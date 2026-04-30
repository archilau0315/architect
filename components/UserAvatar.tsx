import React, { useCallback, useRef, useState, useEffect } from 'react';
import { AvatarService } from '../services/avatarService';

interface UserAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  className?: string;
  onAvatarChange?: (avatar: string | null) => void;
}

const SIZE_CLASSES = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32'
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  size = 'md',
  editable = false,
  className = '',
  onAvatarChange
}) => {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedAvatar = AvatarService.loadAvatar();
    setAvatar(savedAvatar);

    const unsubscribe = AvatarService.listenAvatarChange((newAvatar) => {
      setAvatar(newAvatar);
      onAvatarChange?.(newAvatar);
    });

    return unsubscribe;
  }, [onAvatarChange]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const processedAvatar = await AvatarService.processAvatar(file);
      AvatarService.saveAvatar(processedAvatar);
      setAvatar(processedAvatar);
      onAvatarChange?.(processedAvatar);
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理头像失败');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onAvatarChange]);

  const handleRemove = useCallback(() => {
    AvatarService.removeAvatar();
    setAvatar(null);
    onAvatarChange?.(null);
  }, [onAvatarChange]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const renderPlaceholder = () => (
    <div className={`${SIZE_CLASSES[size]} bg-gradient-to-br from-theme to-theme-dark rounded-full flex items-center justify-center text-white font-black`}>
      {size === 'sm' || size === 'md' ? 'AI' : 'ARCH'}
    </div>
  );

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onClick={editable ? handleClick : undefined}
        className={`${SIZE_CLASSES[size]} rounded-full overflow-hidden border-2 border-white/10 shadow-lg ${editable ? 'cursor-pointer hover:opacity-80 transition-opacity group' : ''}`}
      >
        {isLoading ? (
          <div className={`${SIZE_CLASSES[size]} bg-slate-800 flex items-center justify-center`}>
            <div className="w-6 h-6 border-2 border-theme border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : avatar ? (
          <img src={avatar} alt="用户头像" className="w-full h-full object-cover" />
        ) : (
          renderPlaceholder()
        )}
      </div>

      {editable && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute inset-0 bg-black/50 rounded-full"></div>
          <svg className="relative w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      )}

      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {avatar && (
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors"
              title="删除头像"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </>
      )}

      {error && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-rose-500/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
};
