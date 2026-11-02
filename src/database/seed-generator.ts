import {
  calculateOrderNetContribution,
  type OrderFinance,
} from '../profit-os/domain/finance';

export const WORKSPACE_ID = 'ws_maison_ambre';

// Seeded PRNG (Mulberry32)
export function createSeededRandom(seed = 42) {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CATALOG_PRODUCTS = [
  {
    id: 'prd_001',
    name: "Aura d'Ambre Extrait (50ml)",
    price: 129000,
    cogs: 32000,
    shipping: 7000,
    returnShipping: 7000,
    cpa: 21400,
    courier: 'yalidine' as const,
    refusalAdj: -0.06,
    spendFactor: 0.55,
  },
  {
    id: 'prd_002',
    name: "Aura d'Ambre Duo Bundle",
    price: 229000,
    cogs: 62000,
    shipping: 7000,
    returnShipping: 7000,
    cpa: 26000,
    courier: 'yalidine' as const,
    refusalAdj: -0.07,
    spendFactor: 0.50,
  },
  {
    id: 'prd_003',
    name: 'Lumina Obsidian Articulated Desk Lamp',
    price: 249000,
    cogs: 88000,
    shipping: 12000,
    returnShipping: 12000,
    cpa: 38000,
    courier: 'aramex' as const,
    refusalAdj: 0.11,
    spendFactor: 1.20,
  },
  {
    id: 'prd_004',
    name: 'Saddle Leather Travel Duffle',
    price: 320000,
    cogs: 120000,
    shipping: 15000,
    returnShipping: 15000,
    cpa: 45000,
    courier: 'aramex' as const,
    refusalAdj: 0.12,
    spendFactor: 1.30,
  },
  {
    id: 'prd_005',
    name: 'Velvet Rose Night Serum (30ml)',
    price: 149000,
    cogs: 42000,
    shipping: 8000,
    returnShipping: 8000,
    cpa: 24000,
    courier: 'yalidine' as const,
    refusalAdj: 0.02,
    spendFactor: 0.68,
  },
  {
    id: 'prd_006',
    name: 'Silk Touch Wireless Charging Stand',
    price: 89000,
    cogs: 28000,
    shipping: 6000,
    returnShipping: 6000,
    cpa: 15000,
    courier: 'yalidine' as const,
    refusalAdj: 0.01,
    spendFactor: 0.72,
  },
  {
    id: 'prd_007',
    name: 'Marrakesh Clay Diffuser Set',
    price: 119000,
    cogs: 38000,
    shipping: 9000,
    returnShipping: 9000,
    cpa: 20000,
    courier: 'aramex' as const,
    refusalAdj: 0.13,
    spendFactor: 1.35,
  },
  {
    id: 'prd_008',
    name: 'Sahara Gold Cuff Bracelet',
    price: 179000,
    cogs: 52000,
    shipping: 6000,
    returnShipping: 6000,
    cpa: 28000,
    courier: 'yalidine' as const,
    refusalAdj: -0.05,
    spendFactor: 0.60,
  },
  {
    id: 'prd_009',
    name: 'Atlas Merino Wool Throw',
    price: 269000,
    cogs: 95000,
    shipping: 10000,
    returnShipping: 10000,
    cpa: 42000,
    courier: 'aramex' as const,
    refusalAdj: 0.03,
    spendFactor: 0.58,
  },
  {
    id: 'prd_010',
    name: 'Midnight Oud Cologne (100ml)',
    price: 159000,
    cogs: 46000,
    shipping: 8000,
    returnShipping: 8000,
    cpa: 26000,
    courier: 'yalidine' as const,
    refusalAdj: -0.04,
    spendFactor: 0.58,
  },
  {
    id: 'prd_011',
    name: 'Tunis Blue Ceramic Vase (Large)',
    price: 199000,
    cogs: 85000,
    shipping: 14000,
    returnShipping: 14000,
    cpa: 32000,
    courier: 'aramex' as const,
    refusalAdj: 0.14,
    spendFactor: 1.40,
  },
  {
    id: 'prd_012',
    name: 'Jasmine Night Candle Collection (3-pack)',
    price: 139000,
    cogs: 40000,
    shipping: 10000,
    returnShipping: 10000,
    cpa: 22000,
    courier: 'yalidine' as const,
    refusalAdj: 0.02,
    spendFactor: 0.65,
  },
];

export const GOVERNORATES = [
  { name: 'Tunis', city: 'La Marsa', refusalAdj: -0.02 },
  { name: 'Ariana', city: 'Ennasr', refusalAdj: -0.01 },
  { name: 'Sousse', city: 'Sousse', refusalAdj: 0.00 },
  { name: 'Sfax', city: 'Sfax', refusalAdj: 0.01 },
  { name: 'Bizerte', city: 'Bizerte', refusalAdj: 0.00 },
  { name: 'Nabeul', city: 'Hammamet', refusalAdj: -0.01 },
  { name: 'Monastir', city: 'Monastir', refusalAdj: 0.00 },
  { name: 'Gabès', city: 'Gabès', refusalAdj: 0.02 },
];

export const FIRST_NAMES = [
  'Yassine', 'Sarra', 'Mehdi', 'Ines', 'Karim', 'Amira',
  'Mohamed', 'Nour', 'Hamza', 'Meriem', 'Fares', 'Rim',
  'Walid', 'Hela', 'Anis', 'Cyrine', 'Aziz', 'Syrine',
];

// EXPLICIT QUOTA TABLE: deterministic order counts per product per window
// 3 Winner, 2 À surveiller, 2 À couper, 2 Données insuffisantes, 3 free
interface ProductQuota {
  productId: string;
  orders30d: number; // Last 30 days
  ordersPrev30d: number; // 30-60 days ago (controls trend)
  ordersOld: number; // 60-90 days ago
  refusalRate: number; // Target refusal rate for this product (applied to all windows)
  cpa: number; // CPA millimes (adjusted to hit ad spend 25-30%)
}

// Iteration 8 FINAL-c: ad spend 25% requires CPAs +2-3k across Winners/free
export const PRODUCT_QUOTAS: ProductQuota[] = [
  // 3 Winners: score ≥75, growing trend, low refusal 4-8%, CPA 29-32k
  { productId: 'prd_001', orders30d: 30, ordersPrev30d: 22, ordersOld: 3, refusalRate: 0.05, cpa: 29000 }, // Winner
  { productId: 'prd_008', orders30d: 32, ordersPrev30d: 24, ordersOld: 4, refusalRate: 0.04, cpa: 32000 }, // Winner
  { productId: 'prd_012', orders30d: 28, ordersPrev30d: 21, ordersOld: 3, refusalRate: 0.06, cpa: 29000 }, // Winner
  
  // 2 À surveiller: score 50-74, flat trend, refusal 25-29%, CPA 30-20k
  { productId: 'prd_005', orders30d: 26, ordersPrev30d: 26, ordersOld: 4, refusalRate: 0.26, cpa: 30000 }, // À surveiller
  { productId: 'prd_006', orders30d: 27, ordersPrev30d: 27, ordersOld: 3, refusalRate: 0.25, cpa: 20000 }, // À surveiller
  
  // 2 À couper: score <50, declining trend, refusal 44-46%, high CPA 40-37k
  { productId: 'prd_003', orders30d: 25, ordersPrev30d: 32, ordersOld: 4, refusalRate: 0.46, cpa: 40000 }, // À couper
  { productId: 'prd_011', orders30d: 26, ordersPrev30d: 33, ordersOld: 3, refusalRate: 0.44, cpa: 37000 }, // À couper
  
  // 2 Données insuffisantes: orders30d 8-15, CPA 30-45k
  { productId: 'prd_002', orders30d: 10, ordersPrev30d: 9, ordersOld: 2, refusalRate: 0.15, cpa: 30000 },
  { productId: 'prd_009', orders30d: 12, ordersPrev30d: 11, ordersOld: 2, refusalRate: 0.12, cpa: 45000 },
  
  // 3 free products: CPA 54k/28k/35k
  { productId: 'prd_004', orders30d: 22, ordersPrev30d: 20, ordersOld: 3, refusalRate: 0.27, cpa: 54000 },
  { productId: 'prd_007', orders30d: 24, ordersPrev30d: 23, ordersOld: 3, refusalRate: 0.24, cpa: 28000 },
  { productId: 'prd_010', orders30d: 26, ordersPrev30d: 25, ordersOld: 5, refusalRate: 0.22, cpa: 35000 },
];

export interface SeedOrder extends OrderFinance {
  _id: string;
  workspaceId: string;
  orderNumber: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPriceMillimes: number;
  unitCogsMillimes: number;
  shippingMillimes: number;
  returnShippingMillimes: number;
  courierFeeMillimes: number;
  adCpaMillimes: number;
  courier: 'yalidine' | 'aramex';
  customer: {
    firstName: string;
    city: string;
    governorate: string;
  };
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled';
  statusHistory: Array<{
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled';
    changedAt: Date;
    changedBy: string;
  }>;
  placedAt: Date;
  deliveredAt?: Date | null;
  netContributionMillimes: number;
  settlementId?: string;
  version: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedSettlement {
  _id: string;
  workspaceId: string;
  courier: 'yalidine' | 'aramex';
  settlementDate: Date;
  totalAmountMillimes: number;
  orderIds: string[];
  status: 'pending' | 'settled';
  reconciledAt?: Date;
  version: number;
}

export interface SeedAdSpend {
  _id: string;
  workspaceId: string;
  platform: string;
  campaignName: string;
  periodStart: Date;
  periodEnd: Date;
  spendMillimes: number;
  currency: string;
  productId: string;
  notes: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedExpense {
  _id: string;
  workspaceId: string;
  category: 'rent' | 'salary' | 'utilities' | 'logistics' | 'marketing' | 'other';
  description: string;
  amountMillimes: number;
  periodType: 'monthly' | 'one-time';
  startDate: Date;
  endDate?: Date;
  version: number;
}

export interface SeedScenario {
  _id: string;
  workspaceId: string;
  name: string;
  productId: string;
  unitPriceMillimes: number;
  unitCogsMillimes: number;
  shippingMillimes: number;
  adCpaMillimes: number;
  targetMarginPercent: number;
  notes: string;
  version: number;
}

export interface SeedReport {
  _id: string;
  workspaceId: string;
  title: string;
  type: string;
  format: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

export interface SeedCounter {
  workspaceId: string;
  name: string;
  value: number;
}

export interface SeedDataset {
  orders: SeedOrder[];
  settlements: SeedSettlement[];
  adSpends: SeedAdSpend[];
  expenses: SeedExpense[];
  scenarios: SeedScenario[];
  reports: SeedReport[];
}

export function generateSeedDataset(referenceDate = new Date()): SeedDataset {
  const rand = createSeededRandom(42);

  const randomInt = (min: number, max: number) =>
    Math.floor(rand() * (max - min + 1)) + min;

  const randomChoice = <T>(arr: T[]): T => arr[randomInt(0, arr.length - 1)];

  const now = referenceDate;
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // 1. Generate 600 Orders using EXPLICIT QUOTAS
  const orders: SeedOrder[] = [];
  let orderCounter = 1;

  // Generate orders per product per window (deterministic)
  for (const quota of PRODUCT_QUOTAS) {
    const product = CATALOG_PRODUCTS.find((p) => p.id === quota.productId)!;

    // Generate orders for three windows: days 0-30, 30-60, 60-90
    const windows = [
      { count: quota.orders30d, startDate: thirtyDaysAgo, endDate: now }, // Last 30 days
      { count: quota.ordersPrev30d, startDate: sixtyDaysAgo, endDate: new Date(thirtyDaysAgo.getTime() - 1) }, // 30-60 days ago
      { count: quota.ordersOld, startDate: ninetyDaysAgo, endDate: new Date(sixtyDaysAgo.getTime() - 1) }, // 60-90 days ago
    ];

    for (const window of windows) {
      const refusedCount = Math.round(window.count * quota.refusalRate);

      for (let i = 0; i < window.count; i++) {
        const gov = randomChoice(GOVERNORATES);
        const firstName = randomChoice(FIRST_NAMES);
        const courier: 'yalidine' | 'aramex' = product.courier;

        // Spread dates deterministically within window
        const progress = window.count > 1 ? i / (window.count - 1) : 0.5;
        const placedAt = new Date(
          window.startDate.getTime() +
            progress * (window.endDate.getTime() - window.startDate.getTime()),
        );

        // Deterministic refusal: first refusedCount orders are refused
        const isRefused = i < refusedCount;
        const daysSincePlaced = (now.getTime() - placedAt.getTime()) / (24 * 60 * 60 * 1000);

        let status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled';
        if (daysSincePlaced > 3) {
          // Orders > 3 days old are all resolved
          status = isRefused ? 'refused' : 'delivered';
        } else {
          // Recent orders (<= 3 days): only 10% pending/in-transit
          const r = randomInt(0, 9);
          if (r === 0) {
            status = randomInt(0, 1) === 0 ? 'pending' : 'confirmed';
          } else {
            status = isRefused ? 'refused' : 'delivered';
          }
        }

        const quantity = 1;
        const shippingMillimes = product.shipping;
        const returnShippingMillimes = status === 'refused' ? product.returnShipping : 0;
        const courierFeeMillimes = courier === 'aramex' ? 2000 : 0;
        const adCpaMillimes = quota.cpa;

        const orderFinance: OrderFinance = {
          unitPriceMillimes: product.price,
          unitCogsMillimes: product.cogs,
          quantity,
          shippingMillimes,
          returnShippingMillimes,
          courierFeeMillimes,
          adCpaMillimes,
          status,
        };
        const netContributionMillimes = calculateOrderNetContribution(orderFinance);

        const deliveredAt =
          status === 'delivered'
            ? new Date(
                Math.min(
                  now.getTime(),
                  placedAt.getTime() + randomInt(2, 5) * 24 * 60 * 60 * 1000,
                ),
              )
            : undefined;

        const statusHistory: Array<{
          status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled';
          changedAt: Date;
          changedBy: string;
        }> = [
          {
            status: 'pending',
            changedAt: placedAt,
            changedBy: 'system',
          },
        ];
        if (status === 'delivered' || status === 'refused') {
          statusHistory.push({
            status,
            changedAt: deliveredAt ?? new Date(placedAt.getTime() + 24 * 60 * 60 * 1000),
            changedBy: 'system',
          });
        }

        const order: SeedOrder = {
          _id: `65f${orderCounter.toString(16).padStart(21, '0')}`,
          workspaceId: WORKSPACE_ID,
          orderNumber: `ORD-${orderCounter}`,
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
            city: gov.city,
            governorate: gov.name,
          },
          status,
          statusHistory,
          placedAt,
          deliveredAt,
          netContributionMillimes,
          version: 1,
          deletedAt: null,
          createdAt: placedAt,
          updatedAt: placedAt,
        };

        orders.push(order);
        orderCounter++;
      }
    }
  }

  // Fill days 60-90 to reach 600 total orders, computed refusal rate for 22.8% global target
  const currentTotal = orders.length;
  const remainingOrders = 600 - currentTotal;
  const currentRefused = orders.filter((o) => o.status === 'refused').length;
  
  // Compute exact refusal rate needed for 60-90 day block
  // Target: 22.8% of 588 resolved = 134 total refused
  // We have currentRefused from 0-60 days, need to distribute rest over remaining orders
  const targetTotalRefused = 134; // 22.8% of 588
  const remainingRefused = Math.max(0, targetTotalRefused - currentRefused);
  
  // Distribute remaining orders across products proportionally
  for (let i = 0; i < remainingOrders; i++) {
    const quotaIndex = i % PRODUCT_QUOTAS.length;
    const quota = PRODUCT_QUOTAS[quotaIndex];
    const product = CATALOG_PRODUCTS.find((p) => p.id === quota.productId)!;

    const gov = randomChoice(GOVERNORATES);
    const firstName = randomChoice(FIRST_NAMES);
    const courier: 'yalidine' | 'aramex' = product.courier;

    const progress = remainingOrders > 1 ? i / (remainingOrders - 1) : 0.5;
    const placedAt = new Date(
      ninetyDaysAgo.getTime() + progress * (new Date(sixtyDaysAgo.getTime() - 1).getTime() - ninetyDaysAgo.getTime()),
    );

    const isRefused = i < remainingRefused;
    const status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled' =
      isRefused ? 'refused' : 'delivered';

    const quantity = 1;
    const shippingMillimes = product.shipping;
    const returnShippingMillimes = status === 'refused' ? product.returnShipping : 0;
    const courierFeeMillimes = courier === 'aramex' ? 2000 : 0;
    const adCpaMillimes = quota.cpa;

    const orderFinance: OrderFinance = {
      unitPriceMillimes: product.price,
      unitCogsMillimes: product.cogs,
      quantity,
      shippingMillimes,
      returnShippingMillimes,
      courierFeeMillimes,
      adCpaMillimes,
      status,
    };
    const netContributionMillimes = calculateOrderNetContribution(orderFinance);

    const deliveredAt =
      status === 'delivered'
        ? new Date(placedAt.getTime() + randomInt(2, 5) * 24 * 60 * 60 * 1000)
        : undefined;

    const statusHistory: Array<{
      status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled';
      changedAt: Date;
      changedBy: string;
    }> = [
      { status: 'pending', changedAt: placedAt, changedBy: 'system' },
    ];
    if (status === 'delivered' || status === 'refused') {
      statusHistory.push({
        status,
        changedAt: deliveredAt ?? new Date(placedAt.getTime() + 24 * 60 * 60 * 1000),
        changedBy: 'system',
      });
    }

    const order: SeedOrder = {
      _id: `65f${orderCounter.toString(16).padStart(21, '0')}`,
      workspaceId: WORKSPACE_ID,
      orderNumber: `ORD-${orderCounter}`,
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
        city: gov.city,
        governorate: gov.name,
      },
      status,
      statusHistory,
      placedAt,
      deliveredAt,
      netContributionMillimes,
      version: 1,
      deletedAt: null,
      createdAt: placedAt,
      updatedAt: placedAt,
    };

    orders.push(order);
    orderCounter++;
  }

  // 2. Courier Settlements (Settle most >30d orders, realistic pending share, some >14d)
  const yalidineDelivered = orders.filter(
    (o) => o.status === 'delivered' && o.courier === 'yalidine',
  );
  const aramexDelivered = orders.filter(
    (o) => o.status === 'delivered' && o.courier === 'aramex',
  );

  yalidineDelivered.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
  aramexDelivered.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

  // Yalidine: ~240 delivered total. ~170 older than 30d. Settle ~150 of them in 2 batches.
  const yalidineBatch1 = yalidineDelivered.slice(0, 90); // settled older
  const yalidineBatch2 = yalidineDelivered.slice(90, 150); // settled mid-older
  const yalidineBatch3 = yalidineDelivered.slice(150, 195); // pending (includes 15-30d aging)
  const _yalidineBatch4 = yalidineDelivered.slice(195); // pending (recent)

  // Aramex: ~200 delivered total. ~140 older than 30d. Settle ~120 of them in 2 batches.
  const aramexBatch1 = aramexDelivered.slice(0, 70); // settled older
  const aramexBatch2 = aramexDelivered.slice(70, 120); // settled mid-older
  const aramexBatch3 = aramexDelivered.slice(120, 155); // pending (includes 15-30d aging)
  const _aramexBatch4 = aramexDelivered.slice(155); // pending (recent)

  const settlements: SeedSettlement[] = [
    {
      _id: '65fa10000000000000000001',
      workspaceId: WORKSPACE_ID,
      courier: 'yalidine' as const,
      settlementDate: new Date(now.getTime() - 55 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: yalidineBatch1.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: yalidineBatch1.map((o) => o._id),
      status: 'settled' as const,
      reconciledAt: new Date(now.getTime() - 54 * 24 * 60 * 60 * 1000),
      version: 2,
    },
    {
      _id: '65fa10000000000000000002',
      workspaceId: WORKSPACE_ID,
      courier: 'yalidine' as const,
      settlementDate: new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: yalidineBatch2.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: yalidineBatch2.map((o) => o._id),
      status: 'settled' as const,
      reconciledAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
      version: 2,
    },
    {
      _id: '65fa10000000000000000003',
      workspaceId: WORKSPACE_ID,
      courier: 'aramex' as const,
      settlementDate: new Date(now.getTime() - 48 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: aramexBatch1.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: aramexBatch1.map((o) => o._id),
      status: 'settled' as const,
      reconciledAt: new Date(now.getTime() - 47 * 24 * 60 * 60 * 1000),
      version: 2,
    },
    {
      _id: '65fa10000000000000000004',
      workspaceId: WORKSPACE_ID,
      courier: 'aramex' as const,
      settlementDate: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: aramexBatch2.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: aramexBatch2.map((o) => o._id),
      status: 'settled' as const,
      reconciledAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      version: 2,
    },
    {
      _id: '65fa10000000000000000005',
      workspaceId: WORKSPACE_ID,
      courier: 'yalidine' as const,
      settlementDate: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: yalidineBatch3.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: yalidineBatch3.map((o) => o._id),
      status: 'pending' as const,
      version: 1,
    },
    {
      _id: '65fa10000000000000000006',
      workspaceId: WORKSPACE_ID,
      courier: 'aramex' as const,
      settlementDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: aramexBatch3.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: aramexBatch3.map((o) => o._id),
      status: 'pending' as const,
      version: 1,
    },
  ];

  // Set settlementId on settled orders
  for (const o of yalidineBatch1) {
    o.settlementId = '65fa10000000000000000001';
  }
  for (const o of yalidineBatch2) {
    o.settlementId = '65fa10000000000000000002';
  }
  for (const o of aramexBatch1) {
    o.settlementId = '65fa10000000000000000003';
  }
  for (const o of aramexBatch2) {
    o.settlementId = '65fa10000000000000000004';
  }

  // 3. Ad Spend entries: per product, sum of order CPAs in window + small unattributed share
  // Total should be 25-30% of 30-day gross revenue
  const adSpends: SeedAdSpend[] = [];
  const platforms = ['facebook', 'tiktok', 'google', 'instagram'];
  let spendCounter = 1;

  // Group orders by product and day
  const ordersByProductDay = new Map<string, Map<string, SeedOrder[]>>();
  for (const order of orders) {
    const dayKey = order.placedAt.toISOString().split('T')[0];
    
    if (!ordersByProductDay.has(order.productId)) {
      ordersByProductDay.set(order.productId, new Map());
    }
    const productMap = ordersByProductDay.get(order.productId)!;
    if (!productMap.has(dayKey)) {
      productMap.set(dayKey, []);
    }
    productMap.get(dayKey)!.push(order);
  }

  // Generate ad spend entries per product per day, matching order CPAs
  for (const [productId, dayMap] of ordersByProductDay) {
    const product = CATALOG_PRODUCTS.find((p) => p.id === productId)!;
    const daysSorted = Array.from(dayMap.keys()).sort();
    
    for (const dayKey of daysSorted) {
      const dayOrders = dayMap.get(dayKey)!;
      const totalCpaMillimes = dayOrders.reduce((sum, o) => sum + o.adCpaMillimes, 0);
      
      // Add 5% unattributed buffer
      const spendMillimes = Math.round(totalCpaMillimes * 1.05);
      
      const platform = platforms[spendCounter % platforms.length];
      const periodStart = new Date(dayKey + 'T00:00:00Z');
      const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
      
      adSpends.push({
        _id: `65fb${spendCounter.toString(16).padStart(20, '0')}`,
        workspaceId: WORKSPACE_ID,
        platform,
        campaignName: `${product.name.split(' ')[0]} Acquisition ${platform.toUpperCase()}`,
        periodStart,
        periodEnd,
        spendMillimes,
        currency: 'TND',
        productId,
        notes: `Automated ad spend import for ${product.name}`,
        version: 1,
        createdAt: periodStart,
        updatedAt: periodStart,
      });
      spendCounter++;
    }
  }

  // 4. Six monthly fixed expense types (reduced to 8-12% of typical gross)
  const expenses: SeedExpense[] = [
    {
      _id: '65fc00000000000000000001',
      workspaceId: WORKSPACE_ID,
      category: 'rent' as const,
      description: 'Loyer Bureau & Entrepôt La Marsa',
      amountMillimes: 800000, // 800 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000002',
      workspaceId: WORKSPACE_ID,
      category: 'salary' as const,
      description: 'Salaire Direction & Stratégie',
      amountMillimes: 1200000, // 1,200 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000003',
      workspaceId: WORKSPACE_ID,
      category: 'salary' as const,
      description: 'Salaire Gestionnaire Commandes & Service Client',
      amountMillimes: 600000, // 600 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000004',
      workspaceId: WORKSPACE_ID,
      category: 'utilities' as const,
      description: 'Fibre Optique, Électricité & Eau',
      amountMillimes: 200000, // 200 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000005',
      workspaceId: WORKSPACE_ID,
      category: 'logistics' as const,
      description: 'Abonnement Plateforme WMS & Emballages Premium',
      amountMillimes: 200000, // 200 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000006',
      workspaceId: WORKSPACE_ID,
      category: 'marketing' as const,
      description: 'Shopify Pro, Canva Pro & Outils Tracking',
      amountMillimes: 150000, // 150 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
  ];

  // 5. Four Saved Pricing Scenarios
  const scenarios: SeedScenario[] = [
    {
      _id: '65fd00000000000000000001',
      workspaceId: WORKSPACE_ID,
      name: "Aura d'Ambre - Prix Optimal Volume",
      productId: 'prd_001',
      unitPriceMillimes: 119000,
      unitCogsMillimes: 28000,
      shippingMillimes: 7000,
      adCpaMillimes: 19000,
      targetMarginPercent: 42.5,
      notes: 'Maximise les commandes nettes hebdomadaires',
      version: 1,
    },
    {
      _id: '65fd00000000000000000002',
      workspaceId: WORKSPACE_ID,
      name: "Aura d'Ambre - Marge Maximale",
      productId: 'prd_001',
      unitPriceMillimes: 149000,
      unitCogsMillimes: 28000,
      shippingMillimes: 7000,
      adCpaMillimes: 24000,
      targetMarginPercent: 55.0,
      notes: 'Positionnement premium sur Tunis et Ennasr',
      version: 1,
    },
    {
      _id: '65fd00000000000000000003',
      workspaceId: WORKSPACE_ID,
      name: 'Lumina Desk Lamp - Test Éco',
      productId: 'prd_003',
      unitPriceMillimes: 229000,
      unitCogsMillimes: 65000,
      shippingMillimes: 12000,
      adCpaMillimes: 34000,
      targetMarginPercent: 40.0,
      notes: 'Test de prix de lancement pour booster le volume mensuel',
      version: 1,
    },
    {
      _id: '65fd00000000000000000004',
      workspaceId: WORKSPACE_ID,
      name: 'Saddle Travel Duffle - Offre Prestige',
      productId: 'prd_004',
      unitPriceMillimes: 349000,
      unitCogsMillimes: 88000,
      shippingMillimes: 15000,
      adCpaMillimes: 42000,
      targetMarginPercent: 48.0,
      notes: 'Packaging cadeau inclus pour la clientèle corporate',
      version: 1,
    },
  ];

  // 6. Three Report Records
  const reports: SeedReport[] = [
    {
      _id: '65fe00000000000000000001',
      workspaceId: WORKSPACE_ID,
      title: 'Rapport Financier Mensuel - Janvier 2026',
      type: 'monthly_financial',
      format: 'pdf',
      status: 'ready',
      periodStart: new Date('2026-01-01T00:00:00Z'),
      periodEnd: new Date('2026-01-31T23:59:59Z'),
      createdAt: new Date('2026-02-01T08:00:00Z'),
    },
    {
      _id: '65fe00000000000000000002',
      workspaceId: WORKSPACE_ID,
      title: 'Réconciliation COD Aramex & Yalidine - Janvier 2026',
      type: 'cod_reconciliation',
      format: 'xlsx',
      status: 'ready',
      periodStart: new Date('2026-01-01T00:00:00Z'),
      periodEnd: new Date('2026-01-31T23:59:59Z'),
      createdAt: new Date('2026-02-01T09:30:00Z'),
    },
    {
      _id: '65fe00000000000000000003',
      workspaceId: WORKSPACE_ID,
      title: 'Classement Produits Gagnants & Optimisation Prix Q4',
      type: 'winners_ranking',
      format: 'csv',
      status: 'ready',
      periodStart: new Date('2025-10-01T00:00:00Z'),
      periodEnd: new Date('2025-12-31T23:59:59Z'),
      createdAt: new Date('2026-01-05T14:00:00Z'),
    },
  ];

  return {
    orders,
    settlements,
    adSpends,
    expenses,
    scenarios,
    reports,
  };
}
