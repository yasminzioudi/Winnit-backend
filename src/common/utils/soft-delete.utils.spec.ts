import { notDeletedFilter, softDeleteUpdate } from './soft-delete.utils';

describe('soft-delete.utils', () => {
  it('notDeletedFilter adds deletedAt: null to empty filter', () => {
    const filter = notDeletedFilter();
    expect(filter).toEqual({ deletedAt: null });
  });

  it('notDeletedFilter preserves existing filter keys while adding deletedAt: null', () => {
    const filter = notDeletedFilter({ workspaceId: 'ws_1', status: 'pending' });
    expect(filter).toEqual({
      workspaceId: 'ws_1',
      status: 'pending',
      deletedAt: null,
    });
  });

  it('softDeleteUpdate returns deletedAt Date', () => {
    const before = new Date();
    const update = softDeleteUpdate();
    const after = new Date();

    expect(update.deletedAt).toBeInstanceOf(Date);
    expect(update.deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(update.deletedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
