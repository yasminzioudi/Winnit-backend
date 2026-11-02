import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/winnit';
const WORKSPACE_ID = 'ws_maison_ambre';

// Seeded PRNG (Mulberry32)
function createSeededRandom(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const random = createSeededRandom(42); // Fixed seed for determinism

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

const PRODUCTS = [
  { id: 'prod_001', name: 'Montre Connectée Élégante', price: 129000, cogs: 28000 },
  { id: 'prod_002', name: 'Écouteurs Sans Fil Premium', price: 89000, cogs: 22000 },
  { id: 'prod_003', name: 'Sac à Dos Urbain', price: 65000, cogs: 18000 },
  { id: 'prod_004', name: 'Chargeur Rapide USB-C', price: 35000, cogs: 8000 },
  { id: 'prod_005', name: 'Enceinte Bluetooth Portable', price: 75000, cogs: 20000 },
];

const COURIERS = ['Aramex', 'CTM', 'DHL', 'Ecofresh'];
const GOVERNORATES = ['Tunis', 'Ariana', 'Ben Arous', 'Sfax', 'Sousse', 'Nabeul'];
const CITIES: Record<string, string[]> = {
  Tunis: ['Tunis', 'La Marsa', 'Carthage'],
  Ariana: ['Ariana', 'Soukra'],
  'Ben Arous': ['Ben Arous', 'Radès'],
  Sfax: ['Sfax', 'Sakiet Ezzit'],
  Sousse: ['Sousse', 'Hammam Sousse'],
  Nabeul: ['Nabeul', 'Hammamet'],
};

const FIRST_NAMES = ['Ahmed', 'Mohamed', 'Fatma', 'Leila', 'Youssef', 'Amira', 'Karim', 'Salma'];

const STATUSES = ['delivered', 'delivered', 'delivered', 'refused', 'shipped', 'confirmed'];

async function seed() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log(`Seeding workspace: ${WORKSPACE_ID}`);

    // Clean existing data for this workspace
    await db.collection('orders').deleteMany({ workspaceId: WORKSPACE_ID });
    await db.collection('counters').deleteMany({ workspaceId: WORKSPACE_ID });
    
    console.log('✓ Cleaned existing data');

    // Generate 40 orders over last 30 days
    const orders = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let i = 1; i <= 40; i++) {
      const product = randomChoice(PRODUCTS);
      const courier = randomChoice(COURIERS);
      const governorate = randomChoice(GOVERNORATES);
      const city = randomChoice(CITIES[governorate]);
      const status = randomChoice(STATUSES);
      const firstName = randomChoice(FIRST_NAMES);

      // Random date within last 30 days
      const placedAt = new Date(
        thirtyDaysAgo.getTime() + random() * (now.getTime() - thirtyDaysAgo.getTime()),
      );

      const quantity = 1;
      const shippingMillimes = randomInt(5000, 10000);
      const returnShippingMillimes = 0;
      const courierFeeMillimes = randomInt(0, 2000);
      const adCpaMillimes = randomInt(15000, 30000);

      // Calculate net contribution (pending status for calculation)
      let netContribution: number;
      if (status === 'refused') {
        netContribution = -(shippingMillimes + returnShippingMillimes + adCpaMillimes);
      } else {
        netContribution =
          product.price * quantity -
          product.cogs * quantity -
          shippingMillimes -
          adCpaMillimes -
          courierFeeMillimes;
      }

      const order = {
        workspaceId: WORKSPACE_ID,
        orderNumber: `ORD-${i}`,
        productId: product.id,
        productNameSnapshot: product.name,
        quantity,
        unitPriceMillimes: product.price,
        unitCogsMillimes: product.cogs,
        shippingMillimes,
        returnShippingMillimes,
        courierFeeMillimes,
        adCpaMillimes,
        courier,
        customer: {
          firstName,
          city,
          governorate,
        },
        status,
        statusHistory: [
          {
            status: 'pending',
            changedAt: placedAt,
            changedBy: 'system',
          },
          ...(status !== 'pending'
            ? [
                {
                  status,
                  changedAt: new Date(placedAt.getTime() + randomInt(1, 5) * 24 * 60 * 60 * 1000),
                  changedBy: 'system',
                },
              ]
            : []),
        ],
        placedAt,
        deliveredAt: status === 'delivered' ? new Date(placedAt.getTime() + randomInt(2, 7) * 24 * 60 * 60 * 1000) : undefined,
        netContributionMillimes: netContribution,
        version: 1,
        deletedAt: null,
        createdAt: placedAt,
        updatedAt: placedAt,
      };

      orders.push(order);
    }

    await db.collection('orders').insertMany(orders);
    console.log(`✓ Created ${orders.length} orders`);

    // Set counter
    await db.collection('counters').insertOne({
      workspaceId: WORKSPACE_ID,
      name: 'order',
      value: 40,
    });
    console.log('✓ Set counter to 40');

    // Verify finance identities
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const refusedOrders = orders.filter((o) => o.status === 'refused');
    const grossRevenue = deliveredOrders.reduce(
      (sum, o) => sum + o.unitPriceMillimes * o.quantity,
      0,
    );
    const productCOGS = deliveredOrders.reduce((sum, o) => sum + o.unitCogsMillimes * o.quantity, 0);
    const outboundShipping = deliveredOrders.reduce(
      (sum, o) => sum + o.shippingMillimes + o.courierFeeMillimes,
      0,
    );
    const codRefusalPenalty = refusedOrders.reduce(
      (sum, o) => sum + o.shippingMillimes + o.returnShippingMillimes,
      0,
    );

    const totalNetContribution = orders
      .filter((o) => o.status === 'delivered' || o.status === 'refused')
      .reduce((sum, o) => sum + o.netContributionMillimes, 0);

    console.log('\n📊 Finance Identity Check:');
    console.log(`   Gross Revenue: ${(grossRevenue / 1000).toFixed(2)} TND`);
    console.log(`   Product COGS: ${(productCOGS / 1000).toFixed(2)} TND`);
    console.log(`   Outbound Shipping: ${(outboundShipping / 1000).toFixed(2)} TND`);
    console.log(`   COD Refusal Penalty: ${(codRefusalPenalty / 1000).toFixed(2)} TND`);
    console.log(`   Total Net Contribution: ${(totalNetContribution / 1000).toFixed(2)} TND`);

    console.log('\n✅ Seed completed successfully!');
    console.log(`\nMongoDB Compass: Check collections "orders" and "counters" for workspace "${WORKSPACE_ID}"`);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
