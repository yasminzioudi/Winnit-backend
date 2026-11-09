import { HttpException, HttpStatus } from '@nestjs/common';
import { AiCacheService } from './ai-cache.service';

describe('AiCacheService & Throttler', () => {
  let cacheService: AiCacheService;

  beforeEach(() => {
    cacheService = new AiCacheService();
  });

  afterEach(() => {
    cacheService.clear();
  });

  it('computes deterministic SHA-256 hash for snapshot', () => {
    const snapA = { workspaceId: 'ws_test', value: 123, sub: { a: 1 } };
    const snapB = { sub: { a: 1 }, value: 123, workspaceId: 'ws_test' };

    const hashA = cacheService.hashSnapshot(snapA);
    const hashB = cacheService.hashSnapshot(snapB);

    expect(hashA).toBeDefined();
    expect(hashA).toHaveLength(64);
    expect(hashA).toBe(hashB);
  });

  it('caches entries and retrieves before expiration', () => {
    const key = cacheService.buildKey('ws_test', 'hash123', 'promptA');
    cacheService.set(key, 'cached-response');

    expect(cacheService.get(key)).toBe('cached-response');
  });

  it('expires entries after TTL', () => {
    const key = cacheService.buildKey('ws_test', 'hash123', 'promptB');
    // Set with 0ms TTL
    cacheService.set(key, 'short-lived', -10);

    expect(cacheService.get(key)).toBeUndefined();
  });

  it('allows up to 10 requests per minute and throws HTTP 429 on 11th request', () => {
    const workspaceId = 'ws_maison_ambre';

    // 10 allowed requests
    for (let i = 0; i < 10; i++) {
      expect(() => cacheService.checkThrottle(workspaceId)).not.toThrow();
    }

    // 11th request exceeds 10/min rate limit
    try {
      cacheService.checkThrottle(workspaceId);
      fail('Expected HttpException 429');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('isolates rate limits per workspace', () => {
    for (let i = 0; i < 10; i++) {
      cacheService.checkThrottle('ws_alpha');
    }

    // ws_alpha is throttled
    expect(() => cacheService.checkThrottle('ws_alpha')).toThrow();

    // ws_beta is fresh and not throttled
    expect(() => cacheService.checkThrottle('ws_beta')).not.toThrow();
  });
});
