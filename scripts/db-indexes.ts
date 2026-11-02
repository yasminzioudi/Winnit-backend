import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/winnit';

async function createIndexes() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log('Creating indexes for orders collection...');

    const ordersCollection = db.collection('orders');

    // Tenant-first indexes
    await ordersCollection.createIndex({ workspaceId: 1, orderNumber: 1 }, { unique: true });
    console.log('✓ Created: { workspaceId: 1, orderNumber: 1 } unique');

    await ordersCollection.createIndex({ workspaceId: 1, status: 1 });
    console.log('✓ Created: { workspaceId: 1, status: 1 }');

    await ordersCollection.createIndex({ workspaceId: 1, courier: 1 });
    console.log('✓ Created: { workspaceId: 1, courier: 1 }');

    await ordersCollection.createIndex({ workspaceId: 1, 'customer.governorate': 1 });
    console.log('✓ Created: { workspaceId: 1, "customer.governorate": 1 }');

    await ordersCollection.createIndex({ workspaceId: 1, productId: 1 });
    console.log('✓ Created: { workspaceId: 1, productId: 1 }');

    await ordersCollection.createIndex({ workspaceId: 1, placedAt: -1 });
    console.log('✓ Created: { workspaceId: 1, placedAt: -1 }');

    await ordersCollection.createIndex({ workspaceId: 1, deliveredAt: 1 }, { sparse: true });
    console.log('✓ Created: { workspaceId: 1, deliveredAt: 1 } sparse');

    await ordersCollection.createIndex({ workspaceId: 1, settlementId: 1 }, { sparse: true });
    console.log('✓ Created: { workspaceId: 1, settlementId: 1 } sparse');

    // Unique partial index for idempotency
    await ordersCollection.createIndex(
      { workspaceId: 1, idempotencyKey: 1 },
      {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      },
    );
    console.log('✓ Created: { workspaceId: 1, idempotencyKey: 1 } unique partial');

    console.log('\nCreating indexes for counters collection...');
    const countersCollection = db.collection('counters');
    await countersCollection.createIndex({ workspaceId: 1, name: 1 }, { unique: true });
    console.log('✓ Created: { workspaceId: 1, name: 1 } unique');

    console.log('\nAll indexes created successfully!');
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createIndexes();
