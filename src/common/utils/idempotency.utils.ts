/**
 * Executes an operation with idempotency protection.
 * 1. If an idempotencyKey is provided, checks if a resource with that key already exists (replay -> returns it).
 * 2. If not, invokes createFn().
 * 3. If createFn() throws a duplicate key error (code 11000) from a concurrent race condition,
 *    it queries again and returns the existing resource if found.
 */
export async function withIdempotency<T>(
  workspaceId: string,
  idempotencyKey: string | undefined,
  findExisting: (workspaceId: string, key: string) => Promise<T | null>,
  createFn: () => Promise<T>,
): Promise<T> {
  if (idempotencyKey) {
    const existing = await findExisting(workspaceId, idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  try {
    return await createFn();
  } catch (error: unknown) {
    if (
      idempotencyKey &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: unknown }).code === 11000
    ) {
      const existing = await findExisting(workspaceId, idempotencyKey);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}
