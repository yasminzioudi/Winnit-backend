import { Connection } from 'mongoose';

interface IndexSpec {
  key: Record<string, 1 | -1>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    partialFilterExpression?: Record<string, unknown>;
    name?: string;
  };
}

async function createIndexesWithConflictRetry(
  collection: ReturnType<Connection['collection']>,
  specs: IndexSpec[],
): Promise<void> {
  for (const spec of specs) {
    try {
      await collection.createIndex(spec.key, spec.options);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: unknown }).code === 86
      ) {
        const indexName =
          spec.options?.name ||
          Object.entries(spec.key)
            .map(([k, v]) => `${k}_${v}`)
            .join('_');
        await collection.dropIndex(indexName);
        await collection.createIndex(spec.key, spec.options);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Ensures indexes exist on collections. Only drops an index if its spec conflicts (code 86).
 * Used by both npm run db:indexes and e2e test setup.
 */
export async function ensureIndexes(connection: Connection): Promise<void> {
  const ordersCollection = connection.collection('orders');
  const countersCollection = connection.collection('counters');
  const adSpendCollection = connection.collection('ad_spend');
  const expensesCollection = connection.collection('expenses');
  const scenariosCollection = connection.collection('scenarios');
  const settlementsCollection = connection.collection('settlements');

  // Orders indexes
  const orderIndexes: IndexSpec[] = [
    {
      key: { workspaceId: 1, orderNumber: 1 },
      options: { unique: true },
    },
    {
      key: { workspaceId: 1, placedAt: -1 },
    },
    {
      key: { workspaceId: 1, status: 1, placedAt: -1 },
    },
    {
      key: { workspaceId: 1, productId: 1, placedAt: -1 },
    },
    {
      key: { workspaceId: 1, courier: 1, status: 1 },
    },
    {
      key: { workspaceId: 1, settlementId: 1 },
    },
    {
      key: { workspaceId: 1, idempotencyKey: 1 },
      options: {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      },
    },
  ];

  // Counters index
  const countersIndexes: IndexSpec[] = [
    {
      key: { workspaceId: 1, name: 1 },
      options: { unique: true },
    },
  ];

  // Ad spend indexes
  const adSpendIndexes: IndexSpec[] = [
    {
      key: { workspaceId: 1, periodStart: -1 },
    },
    {
      key: { workspaceId: 1, productId: 1 },
    },
    {
      key: { workspaceId: 1, idempotencyKey: 1 },
      options: {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      },
    },
  ];

  // Expenses indexes
  const expenseIndexes: IndexSpec[] = [
    {
      key: { workspaceId: 1, periodType: 1 },
    },
    {
      key: { workspaceId: 1, category: 1 },
    },
    {
      key: { workspaceId: 1, idempotencyKey: 1 },
      options: {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      },
    },
  ];

  // Scenarios indexes
  const scenarioIndexes: IndexSpec[] = [
    {
      key: { workspaceId: 1, productId: 1 },
    },
    {
      key: { workspaceId: 1, idempotencyKey: 1 },
      options: {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      },
    },
  ];

  // Settlements indexes
  const settlementIndexes: IndexSpec[] = [
    {
      key: { workspaceId: 1, status: 1 },
    },
    {
      key: { workspaceId: 1, settlementDate: -1 },
    },
    {
      key: { workspaceId: 1, courier: 1 },
    },
    {
      key: { workspaceId: 1, idempotencyKey: 1 },
      options: {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      },
    },
  ];

  await createIndexesWithConflictRetry(ordersCollection, orderIndexes);
  await createIndexesWithConflictRetry(countersCollection, countersIndexes);
  await createIndexesWithConflictRetry(adSpendCollection, adSpendIndexes);
  await createIndexesWithConflictRetry(expensesCollection, expenseIndexes);
  await createIndexesWithConflictRetry(scenariosCollection, scenarioIndexes);
  await createIndexesWithConflictRetry(settlementsCollection, settlementIndexes);
}
