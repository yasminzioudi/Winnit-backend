import { UnprocessableEntityException } from '@nestjs/common';
import {
  withIdempotency,
  deterministicStringify,
  hashPayload,
} from './idempotency.utils';

describe('deterministicStringify and hashPayload', () => {
  it('produces identical output regardless of object key order', () => {
    const objA = { b: 2, a: 1, nested: { y: 'y', x: 'x' } };
    const objB = { nested: { x: 'x', y: 'y' }, a: 1, b: 2 };

    expect(deterministicStringify(objA)).toBe(deterministicStringify(objB));
    expect(hashPayload(objA)).toBe(hashPayload(objB));
  });

  it('produces different hash for different payloads', () => {
    const objA = { amount: 100 };
    const objB = { amount: 200 };

    expect(hashPayload(objA)).not.toBe(hashPayload(objB));
  });
});

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

  it('replays existing resource when idempotencyKey already exists with same body', async () => {
    const payload = { title: 'Test' };
    const bodyHash = hashPayload(payload);
    const findExisting = jest.fn().mockResolvedValue({ id: 'res_existing', bodyHash });
    const createFn = jest.fn();

    const result = await withIdempotency(
      workspaceId,
      'idem_123',
      findExisting,
      createFn,
      { requestPayload: payload },
    );

    expect(result).toEqual({ id: 'res_existing', bodyHash });
    expect(findExisting).toHaveBeenCalledWith(workspaceId, 'idem_123');
    expect(createFn).not.toHaveBeenCalled();
  });

  it('throws 422 UnprocessableEntityException when key reused with different payload', async () => {
    const initialPayload = { title: 'Initial' };
    const differentPayload = { title: 'Modified' };
    const bodyHash = hashPayload(initialPayload);
    const findExisting = jest.fn().mockResolvedValue({ id: 'res_existing', bodyHash });
    const createFn = jest.fn();

    await expect(
      withIdempotency(
        workspaceId,
        'idem_123',
        findExisting,
        createFn,
        { requestPayload: differentPayload },
      ),
    ).rejects.toThrow(UnprocessableEntityException);

    await expect(
      withIdempotency(
        workspaceId,
        'idem_123',
        findExisting,
        createFn,
        { requestPayload: differentPayload },
      ),
    ).rejects.toThrow('Idempotency key reused with different payload');

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
    const payload = { amount: 50 };
    const bodyHash = hashPayload(payload);
    const existing = { id: 'res_concurrent', bodyHash };
    const findExisting = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const createFn = jest.fn().mockRejectedValue({ code: 11000, message: 'duplicate key' });

    const result = await withIdempotency(
      workspaceId,
      'idem_concurrent',
      findExisting,
      createFn,
      { requestPayload: payload },
    );

    expect(result).toEqual(existing);
    expect(findExisting).toHaveBeenCalledTimes(2);
  });

  it('throws 422 if concurrent E11000 resolution finds existing record with different payload', async () => {
    const existing = { id: 'res_concurrent', bodyHash: hashPayload({ initial: 1 }) };
    const findExisting = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const createFn = jest.fn().mockRejectedValue({ code: 11000, message: 'duplicate key' });

    await expect(
      withIdempotency(
        workspaceId,
        'idem_concurrent',
        findExisting,
        createFn,
        { requestPayload: { initial: 2 } },
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rethrows non-11000 errors', async () => {
    const findExisting = jest.fn().mockResolvedValue(null);
    const createFn = jest.fn().mockRejectedValue(new Error('Database unavailable'));

    await expect(
      withIdempotency(workspaceId, 'idem_123', findExisting, createFn),
    ).rejects.toThrow('Database unavailable');
  });
});
