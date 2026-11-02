import { ConflictException } from '@nestjs/common';
import { assertOptimisticUpdate } from './optimistic-lock.utils';

describe('assertOptimisticUpdate', () => {
  it('returns updated object when non-null', () => {
    const updated = { id: 'order_1', version: 2 };
    const result = assertOptimisticUpdate(updated);
    expect(result).toBe(updated);
  });

  it('throws ConflictException when updated is null with default message', () => {
    expect(() => assertOptimisticUpdate(null)).toThrow(ConflictException);
    expect(() => assertOptimisticUpdate(null)).toThrow('Version conflict');
  });

  it('throws ConflictException with custom message', () => {
    expect(() =>
      assertOptimisticUpdate(null, 'Custom version conflict'),
    ).toThrow('Custom version conflict');
  });
});
