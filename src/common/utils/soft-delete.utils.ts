/**
 * Returns a filter object augmented with { deletedAt: null }
 * to exclude soft-deleted records.
 */
export function notDeletedFilter<T extends Record<string, any> = Record<string, any>>(
  filter: T = {} as T,
): T & { deletedAt: null } {
  return {
    ...filter,
    deletedAt: null,
  };
}

/**
 * Returns the update payload for a soft delete operation.
 */
export function softDeleteUpdate(): { deletedAt: Date } {
  return {
    deletedAt: new Date(),
  };
}
