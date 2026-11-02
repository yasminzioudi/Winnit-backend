import { UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Deterministically serializes any JS value into JSON with sorted object keys.
 */
export function deterministicStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(deterministicStringify).join(',')}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) =>
      `${JSON.stringify(k)}:${deterministicStringify((obj as Record<string, unknown>)[k])}`,
  );
  return `{${pairs.join(',')}}`;
}

/**
 * Computes a SHA-256 hash of a request payload using deterministic stringification.
 */
export function hashPayload(payload: unknown): string {
  if (payload === undefined || payload === null) return '';
  return createHash('sha256')
    .update(deterministicStringify(payload))
    .digest('hex');
}

export interface IdempotencyOptions<T> {
  requestPayload?: unknown;
  getStoredHash?: (existing: T) => string | undefined;
}

/**
 * Executes an operation with idempotency protection.
 * 1. If an idempotencyKey is provided, checks if a resource with that key already exists.
 *    - If payload verification is active and the stored hash differs from the current payload,
 *      throws 422 UnprocessableEntityException('Idempotency key reused with different payload').
 *    - Otherwise, replays the existing resource.
 * 2. If not, invokes createFn().
 * 3. If createFn() throws a duplicate key error (code 11000) from a concurrent race condition,
 *    it queries again, checks payload verification, and returns the existing resource if found.
 */
export async function withIdempotency<T>(
  workspaceId: string,
  idempotencyKey: string | undefined,
  findExisting: (workspaceId: string, key: string) => Promise<T | null>,
  createFn: () => Promise<T>,
  options?: IdempotencyOptions<T>,
): Promise<T> {
  const currentHash =
    options?.requestPayload !== undefined
      ? hashPayload(options.requestPayload)
      : undefined;

  const verifyPayloadHash = (existing: T) => {
    if (currentHash !== undefined) {
      const storedHash = options?.getStoredHash
        ? options.getStoredHash(existing)
        : (existing as { bodyHash?: string }).bodyHash;
      if (storedHash && storedHash !== currentHash) {
        throw new UnprocessableEntityException(
          'Idempotency key reused with different payload',
        );
      }
    }
  };

  if (idempotencyKey) {
    const existing = await findExisting(workspaceId, idempotencyKey);
    if (existing) {
      verifyPayloadHash(existing);
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
        verifyPayloadHash(existing);
        return existing;
      }
    }
    throw error;
  }
}
