import { withIdempotency } from './idempotency.utils';

describe('withIdempotency', () => {
  const workspaceId = 'ws_test';

  it('creates resource when no idempotencyKey is provided', async () => {
    const findExisting = jest.fn();
    const createFn = jest.fn().mockResolvedValue({ id: 'res_1' });

    const result = await withIdempotency(workspaceId, undefined, findExisting, createFn);

    expect(result).toEqual({ id: 'res_1' });
    expect(findExisting).not.toHaveBeenCalled();
    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it('replays existing resource when idempotencyKey already exists', async () => {
    const findExisting = jest.fn().mockResolvedValue({ id: 'res_existing' });
    const createFn = jest.fn();

    const result = await withIdempotency(workspaceId, 'idem_123', findExisting, createFn);

    expect(result).toEqual({ id: 'res_existing' });
    expect(findExisting).toHaveBeenCalledWith(workspaceId, 'idem_123');
    expect(createFn).not.toHaveBeenCalled();
  });

  it('creates resource when key does not exist yet', async () => {
    const findExisting = jest.fn().mockResolvedValue(null);
    const createFn = jest.fn().mockResolvedValue({ id: 'res_new' });

    const result = await withIdempotency(workspaceId, 'idem_123', findExisting, createFn);

    expect(result).toEqual({ id: 'res_new' });
    expect(findExisting).toHaveBeenCalledTimes(1);
    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it('catches E11000 duplicate key error and returns existing record', async () => {
    const existing = { id: 'res_concurrent' };
    const findExisting = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const createFn = jest.fn().mockRejectedValue({ code: 11000, message: 'duplicate key' });

    const result = await withIdempotency(workspaceId, 'idem_concurrent', findExisting, createFn);

    expect(result).toEqual(existing);
    expect(findExisting).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-11000 errors', async () => {
    const findExisting = jest.fn().mockResolvedValue(null);
    const createFn = jest.fn().mockRejectedValue(new Error('Database unavailable'));

    await expect(
      withIdempotency(workspaceId, 'idem_123', findExisting, createFn),
    ).rejects.toThrow('Database unavailable');
  });
});
