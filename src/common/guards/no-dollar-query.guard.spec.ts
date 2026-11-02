import { ExecutionContext, BadRequestException } from '@nestjs/common';
import {
  NoDollarQueryGuard,
  validateNoDollarOrDotKeys,
} from './no-dollar-query.guard';

describe('NoDollarQueryGuard', () => {
  let guard: NoDollarQueryGuard;

  beforeEach(() => {
    guard = new NoDollarQueryGuard();
  });

  function createMockContext(query: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ query }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows clean query parameters', () => {
    const context = createMockContext({
      status: 'pending',
      limit: '20',
      search: 'ORD-12',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects top-level key starting with "$"', () => {
    const context = createMockContext({
      $where: '1',
    });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('rejects top-level key containing "."', () => {
    const context = createMockContext({
      'customer.city': 'Tunis',
    });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('rejects nested key starting with "$"', () => {
    const context = createMockContext({
      status: { $ne: 'delivered' },
    });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('validateNoDollarOrDotKeys throws expected message', () => {
    expect(() => validateNoDollarOrDotKeys({ $gt: 5 })).toThrow(
      "Query parameter key cannot start with '$' or contain '.': $gt",
    );
  });
});
