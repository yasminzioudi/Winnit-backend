import { ConflictException } from '@nestjs/common';

/**
 * Asserts that an atomic findOneAndUpdate with version filter succeeded.
 * If the updated document is null (due to version mismatch or not found),
 * throws a 409 ConflictException.
 */
export function assertOptimisticUpdate<T>(
  updated: T | null,
  errorMessage = 'Version conflict or order not found',
): T {
  if (!updated) {
    throw new ConflictException(errorMessage);
  }
  return updated;
}
