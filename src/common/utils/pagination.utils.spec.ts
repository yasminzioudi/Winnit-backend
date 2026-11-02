import { paginatePage, buildCursorMeta } from './pagination.utils';

describe('pagination.utils', () => {
  describe('paginatePage', () => {
    it('calculates totalPages and sets metadata correctly', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = paginatePage(items, 45, 2, 20);

      expect(result.data).toBe(items);
      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it('handles total = 0 gracefully', () => {
      const result = paginatePage([], 0, 1, 20);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('buildCursorMeta', () => {
    it('returns base64 cursor when page is full (items.length === limit)', () => {
      const placedAt = new Date('2026-01-15T10:00:00.000Z');
      const items = [
        { _id: 'id_1', placedAt },
        { _id: 'id_2', placedAt },
      ];

      const { nextCursor } = buildCursorMeta(items, 2);
      expect(nextCursor).not.toBeNull();

      const decoded = JSON.parse(
        Buffer.from(nextCursor!, 'base64').toString('utf8'),
      );
      expect(decoded.id).toBe('id_2');
      expect(decoded.placedAt).toBe(placedAt.toISOString());
    });

    it('returns null when items.length < limit', () => {
      const items = [{ _id: 'id_1' }];
      const { nextCursor } = buildCursorMeta(items, 5);
      expect(nextCursor).toBeNull();
    });

    it('returns null for empty array', () => {
      const { nextCursor } = buildCursorMeta([], 5);
      expect(nextCursor).toBeNull();
    });
  });
});
