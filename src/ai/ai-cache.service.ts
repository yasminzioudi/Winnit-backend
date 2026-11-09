import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class AiCacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly requestWindows = new Map<string, number[]>();
  private readonly defaultTtlMs = 5 * 60 * 1000; // 5 minutes
  private readonly maxRequestsPerMinute = 10;
  private readonly windowMs = 60 * 1000; // 1 minute

  /**
   * Computes a deterministic SHA-256 hash of a FinancialSnapshot or arbitrary payload.
   */
  hashSnapshot(snapshot: unknown): string {
    const serialized = JSON.stringify(snapshot, Object.keys(snapshot as object).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Generates a cache key combining workspaceId, snapshotHash, and an operation/prompt hash.
   */
  buildKey(workspaceId: string, snapshotHash: string, operationTag: string): string {
    const opHash = crypto.createHash('sha256').update(operationTag).digest('hex').substring(0, 16);
    return `${workspaceId}:ai:${snapshotHash}:${opHash}`;
  }

  /**
   * Retrieves a cached value if present and unexpired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Stores a value with a 5-minute TTL.
   */
  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Enforces a hard rate limit of 10 AI operations per minute per workspace.
   * Throws HTTP 429 Too Many Requests if exceeded.
   */
  checkThrottle(workspaceId: string): void {
    const now = Date.now();
    const timestamps = this.requestWindows.get(workspaceId) || [];

    // Retain only requests within the last 60 seconds
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequestsPerMinute) {
      throw new HttpException(
        'Trop de requêtes IA (limite : 10 requêtes par minute)',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    validTimestamps.push(now);
    this.requestWindows.set(workspaceId, validTimestamps);
  }

  /**
   * Clears internal state (primarily for testing).
   */
  clear(): void {
    this.cache.clear();
    this.requestWindows.clear();
  }
}
