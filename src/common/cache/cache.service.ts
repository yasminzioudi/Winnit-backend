import { Injectable } from '@nestjs/common';

export interface ICacheService {
  set(key: string, value: unknown, ttlSeconds?: number): void;
  get<T>(key: string): T | null;
  delete(key: string): void;
  invalidateWorkspace(workspaceId: string): void;
  clear(): void;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class CacheService implements ICacheService {
  private cache = new Map<string, CacheEntry>();

  set(key: string, value: unknown, ttlSeconds: number = 60): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  invalidateWorkspace(workspaceId: string): void {
    // Delete all keys starting with workspace prefix
    const prefix = `${workspaceId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
