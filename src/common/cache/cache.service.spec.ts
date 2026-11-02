import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should store and retrieve values within TTL', () => {
    cacheService.set('key1', { foo: 'bar' }, 60);
    expect(cacheService.get('key1')).toEqual({ foo: 'bar' });
  });

  it('should expire values after TTL', () => {
    cacheService.set('key1', 'val1', 60);
    expect(cacheService.get('key1')).toBe('val1');

    // Fast-forward 61 seconds
    jest.advanceTimersByTime(61 * 1000);
    expect(cacheService.get('key1')).toBeNull();
  });

  it('should invalidate all keys for a specific workspace', () => {
    cacheService.set('ws_1:summary:2026-01', { rev: 100 });
    cacheService.set('ws_1:timeseries', [1, 2, 3]);
    cacheService.set('ws_2:summary:2026-01', { rev: 200 });

    cacheService.invalidateWorkspace('ws_1');

    expect(cacheService.get('ws_1:summary:2026-01')).toBeNull();
    expect(cacheService.get('ws_1:timeseries')).toBeNull();
    expect(cacheService.get('ws_2:summary:2026-01')).toEqual({ rev: 200 });
  });

  it('should delete individual keys', () => {
    cacheService.set('del_me', 123);
    cacheService.delete('del_me');
    expect(cacheService.get('del_me')).toBeNull();
  });

  it('should clear all entries', () => {
    cacheService.set('k1', 1);
    cacheService.set('k2', 2);
    cacheService.clear();
    expect(cacheService.get('k1')).toBeNull();
    expect(cacheService.get('k2')).toBeNull();
  });
});

