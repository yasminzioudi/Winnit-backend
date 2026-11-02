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

/**
 * Ensures indexes exist on collections. Only drops an index if its spec conflicts (code 86).
 * Used by both npm run db:indexes and e2e test setup.
 */
export async function ensureIndexes(connection: Connection): Promise<void> {
  const ordersCollection = connection.collection('orders');
  const countersCollection = connection.collection('counters');

  // Orders indexes (tenant-first, matching section 4 of brief)
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

  // Create orders indexes (retry on conflict)
  for (const spec of orderIndexes) {
    try {
      await ordersCollection.createIndex(spec.key, spec.options);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 86
      ) {
        // Index key specs conflict - drop existing and recreate
        const indexName =
          spec.options?.name ||
          Object.entries(spec.key)
            .map(([k, v]) => `${k}_${v}`)
            .join('_');
        await ordersCollection.dropIndex(indexName);
        await ordersCollection.createIndex(spec.key, spec.options);
      } else {
        throw error;
      }
    }
  }

  // Counters index
  const countersIndexes: IndexSpec[] = [
    {
      key: { workspaceId: 1, name: 1 },
      options: { unique: true },
    },
  ];

  for (const spec of countersIndexes) {
    try {
      await countersCollection.createIndex(spec.key, spec.options);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 86
      ) {
        const indexName =
          spec.options?.name ||
          Object.entries(spec.key)
            .map(([k, v]) => `${k}_${v}`)
            .join('_');
        await countersCollection.dropIndex(indexName);
        await countersCollection.createIndex(spec.key, spec.options);
      } else {
        throw error;
      }
    }
  }
}
