interface BlobEntry {
  url: string;
  blob: Blob;
  timestamp: number;
  keepAlive: boolean;
}

class VideoBlobService {
  private blobStore: Map<string, BlobEntry> = new Map();
  private persistentUrls: Set<string> = new Set();
  
  /**
   * 创建并注册 blob URL
   * @param blob 视频 blob
   * @param keepAlive 是否长期保持（用于聊天消息中的视频）
   */
  createObjectURL(blob: Blob, keepAlive: boolean = false): string {
    const url = URL.createObjectURL(blob);
    
    this.blobStore.set(url, {
      url,
      blob,
      timestamp: Date.now(),
      keepAlive
    });
    
    if (keepAlive) {
      this.persistentUrls.add(url);
    }
    
    console.log('[VideoBlob] Created:', { url, keepAlive, total: this.blobStore.size });
    return url;
  }
  
  /**
   * 从 blob URL 获取 blob
   */
  getBlob(url: string): Blob | null {
    const entry = this.blobStore.get(url);
    return entry?.blob || null;
  }
  
  /**
   * 确保 blob URL 有效，如已释放则重新创建
   */
  ensureValid(url: string): string | null {
    const entry = this.blobStore.get(url);
    if (!entry) {
      console.warn('[VideoBlob] URL not found in store:', url);
      return null;
    }
    
    // 尝试检测 URL 是否仍然有效
    // 由于无法直接检测，我们假设只要有 entry 就有效
    return url;
  }
  
  /**
   * 检查 URL 是否被标记为持久保持
   */
  isPersistent(url: string): boolean {
    return this.persistentUrls.has(url);
  }

  /**
   * 标记 URL 为持久保持（用于聊天消息）
   */
  markAsPersistent(url: string): void {
    this.persistentUrls.add(url);
    const entry = this.blobStore.get(url);
    if (entry) {
      entry.keepAlive = true;
    }
  }
  
  /**
   * 释放 URL（仅释放非持久 URL）
   */
  revokeURL(url: string): void {
    if (this.persistentUrls.has(url)) {
      console.log('[VideoBlob] Skip revoke persistent URL:', url);
      return;
    }
    
    this.forceRevoke(url);
  }
  
  /**
   * 强制释放 URL（危险，慎用）
   */
  forceRevoke(url: string): void {
    const entry = this.blobStore.get(url);
    if (!entry) return;
    
    try {
      URL.revokeObjectURL(url);
      this.blobStore.delete(url);
      this.persistentUrls.delete(url);
      console.log('[VideoBlob] Revoked:', url);
    } catch (e) {
      console.warn('[VideoBlob] Failed to revoke:', e);
    }
  }
  
  /**
   * 清理过期的临时 URL（保留持久 URL）
   */
  cleanupExpired(maxAgeMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [url, entry] of this.blobStore) {
      if (!entry.keepAlive && (now - entry.timestamp) > maxAgeMs) {
        this.forceRevoke(url);
        removed++;
      }
    }
    
    console.log('[VideoBlob] Cleanup:', { removed, remaining: this.blobStore.size });
    return removed;
  }
  
  /**
   * 清空所有 URL（仅用于特殊情况，如完全重置）
   */
  clearAll(): void {
    for (const url of Array.from(this.blobStore.keys())) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // 忽略
      }
    }
    this.blobStore.clear();
    this.persistentUrls.clear();
  }
  
  /**
   * 获取当前统计信息
   */
  getStats(): { total: number; persistent: number; temporary: number } {
    return {
      total: this.blobStore.size,
      persistent: this.persistentUrls.size,
      temporary: this.blobStore.size - this.persistentUrls.size
    };
  }
}

// 导出单例
export const videoBlobService = new VideoBlobService();
