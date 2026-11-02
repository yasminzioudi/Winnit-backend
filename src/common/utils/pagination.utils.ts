import { PagePaginatedResponse } from '../dto/pagination.dto';

/**
 * Constructs a standardized page-paginated envelope.
 */
export function paginatePage<T>(
  data: T[],
  total: number,
  page = 1,
  limit = 20,
): PagePaginatedResponse<T> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  return {
    data,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 0,
    },
  };
}

/**
 * Builds cursor metadata for cursor-based pagination.
 * Computes base64 nextCursor from the last item when page is full.
 */
export function buildCursorMeta<T extends { _id: unknown; placedAt?: Date }>(
  items: T[],
  limit = 20,
): { nextCursor: string | null } {
  const nextCursor =
    items.length === limit && items.length > 0
      ? Buffer.from(
          JSON.stringify({
            placedAt: items[items.length - 1].placedAt,
            id: items[items.length - 1]._id,
          }),
        ).toString('base64')
      : null;

  return { nextCursor };
}
