const AVATAR_KEY = 'user-architect-avatar-v120-locked';
const AVATAR_CHANGED_EVENT = 'avatarChanged';

interface AvatarValidationResult {
  valid: boolean;
  message?: string;
}

interface AvatarCompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

export class AvatarService {
  static readonly DEFAULT_OPTIONS: AvatarCompressionOptions = {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.85
  };

  static readonly VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  static readonly MAX_SIZE = 5 * 1024 * 1024;

  static validate(file: File): AvatarValidationResult {
    if (!file) {
      return { valid: false, message: '请选择文件' };
    }

    if (!this.VALID_TYPES.includes(file.type)) {
      return {
        valid: false,
        message: `只支持 ${this.VALID_TYPES.map(t => t.split('/')[1]).join(', ')} 格式`
      };
    }

    if (file.size > this.MAX_SIZE) {
      return {
        valid: false,
        message: `文件大小不能超过 ${(this.MAX_SIZE / 1024 / 1024).toFixed(0)}MB`
      };
    }

    return { valid: true };
  }

  static async compressImage(file: File, options: Partial<AvatarCompressionOptions> = {}): Promise<string> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          const ratio = Math.min(opts.maxWidth! / width, opts.maxHeight! / height);
          if (ratio < 1) {
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建 canvas 上下文'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const result = canvas.toDataURL(type, opts.quality);
          resolve(result);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  static saveAvatar(base64: string): void {
    try {
      localStorage.setItem(AVATAR_KEY, base64);
      this.dispatchChangeEvent(base64);
    } catch (e) {
      console.error('保存头像失败:', e);
    }
  }

  static loadAvatar(): string | null {
    try {
      return localStorage.getItem(AVATAR_KEY);
    } catch (e) {
      console.error('加载头像失败:', e);
      return null;
    }
  }

  static removeAvatar(): void {
    try {
      localStorage.removeItem(AVATAR_KEY);
      this.dispatchChangeEvent(null);
    } catch (e) {
      console.error('删除头像失败:', e);
    }
  }

  static dispatchChangeEvent(avatar: string | null): void {
    const event = new CustomEvent(AVATAR_CHANGED_EVENT, { detail: avatar });
    window.dispatchEvent(event);
  }

  static listenAvatarChange(callback: (avatar: string | null) => void): () => void {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      callback(detail);
    };
    window.addEventListener(AVATAR_CHANGED_EVENT, handler as EventListener);

    const storageHandler = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY) {
        callback(e.newValue);
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener(AVATAR_CHANGED_EVENT, handler as EventListener);
      window.removeEventListener('storage', storageHandler);
    };
  }

  static async processAvatar(file: File): Promise<string> {
    const validation = this.validate(file);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const compressed = await this.compressImage(file);
    return compressed;
  }
}
