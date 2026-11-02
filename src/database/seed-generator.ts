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
    cogs: 28000,
    shipping: 7000,
    returnShipping: 7000,
    cpa: 21400,
    courier: 'yalidine',
  },
  {
    id: 'prd_002',
    name: "Aura d'Ambre Duo Bundle",
    price: 229000,
    cogs: 52000,
    shipping: 7000,
    returnShipping: 7000,
    cpa: 26000,
    courier: 'yalidine',
  },
  {
    id: 'prd_003',
    name: 'Lumina Obsidian Articulated Desk Lamp',
    price: 249000,
    cogs: 65000,
    shipping: 12000,
    returnShipping: 12000,
    cpa: 38000,
    courier: 'aramex',
  },
  {
    id: 'prd_004',
    name: 'Saddle Leather Travel Duffle',
    price: 320000,
    cogs: 88000,
    shipping: 15000,
    returnShipping: 15000,
    cpa: 45000,
    courier: 'aramex',
  },
  {
    id: 'prd_005',
    name: 'Velvet Rose Night Serum (30ml)',
    price: 149000,
    cogs: 35000,
    shipping: 8000,
    returnShipping: 8000,
    cpa: 24000,
    courier: 'yalidine',
  },
  {
    id: 'prd_006',
    name: 'Silk Touch Wireless Charging Stand',
    price: 89000,
    cogs: 22000,
    shipping: 6000,
    returnShipping: 6000,
    cpa: 15000,
    courier: 'yalidine',
  },
  {
    id: 'prd_007',
    name: 'Marrakesh Clay Diffuser Set',
    price: 119000,
    cogs: 28000,
    shipping: 9000,
    returnShipping: 9000,
    cpa: 20000,
    courier: 'aramex',
  },
  {
    id: 'prd_008',
    name: 'Sahara Gold Cuff Bracelet',
    price: 179000,
    cogs: 42000,
    shipping: 6000,
    returnShipping: 6000,
    cpa: 28000,
    courier: 'yalidine',
  },
  {
    id: 'prd_009',
    name: 'Atlas Merino Wool Throw',
    price: 269000,
    cogs: 78000,
    shipping: 10000,
    returnShipping: 10000,
    cpa: 42000,
    courier: 'aramex',
  },
  {
    id: 'prd_010',
    name: 'Midnight Oud Cologne (100ml)',
    price: 159000,
    cogs: 38000,
    shipping: 8000,
    returnShipping: 8000,
    cpa: 26000,
    courier: 'yalidine',
  },
  {
    id: 'prd_011',
    name: 'Tunis Blue Ceramic Vase (Large)',
    price: 199000,
    cogs: 52000,
    shipping: 14000,
    returnShipping: 14000,
    cpa: 32000,
    courier: 'aramex',
  },
  {
    id: 'prd_012',
    name: 'Jasmine Night Candle Collection (3-pack)',
    price: 139000,
    cogs: 32000,
    shipping: 10000,
    returnShipping: 10000,
    cpa: 22000,
    courier: 'yalidine',
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

  // 1. Generate 600 Orders
  const TOTAL_ORDERS = 600;
  const orders: SeedOrder[] = [];

  for (let i = 1; i <= TOTAL_ORDERS; i++) {
    const product = randomChoice(CATALOG_PRODUCTS);
    const gov = randomChoice(GOVERNORATES);
    const firstName = randomChoice(FIRST_NAMES);

    // Courier distribution: 55% Yalidine, 45% Aramex
    const courier: 'yalidine' | 'aramex' = rand() < 0.55 ? 'yalidine' : 'aramex';

    // Order placed timestamp over 90 days
    // Weight slightly towards recent days
    const timeProgress = Math.pow(rand(), 0.85);
    const placedAt = new Date(
      ninetyDaysAgo.getTime() +
        timeProgress * (now.getTime() - ninetyDaysAgo.getTime()),
    );

    const daysSincePlaced = (now.getTime() - placedAt.getTime()) / (24 * 60 * 60 * 1000);

    // Refusal probability: base 0.205 (20.5%) + courier modifier (+0.015 Aramex, -0.015 Yalidine) + gov modifier
    const courierRefusalMod = courier === 'aramex' ? 0.015 : -0.015;
    const refusalProb = 0.205 + courierRefusalMod + gov.refusalAdj;

    let status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled';

    if (daysSincePlaced > 7) {
      // Historical orders are resolved
      if (rand() < 0.02) {
        status = 'cancelled';
      } else if (rand() < refusalProb) {
        status = 'refused';
      } else {
        status = 'delivered';
      }
    } else if (daysSincePlaced > 3) {
      // Mid-transit orders
      const roll = rand();
      if (roll < refusalProb * 0.7) {
        status = 'refused';
      } else if (roll < 0.55) {
        status = 'delivered';
      } else if (roll < 0.85) {
        status = 'shipped';
      } else {
        status = 'confirmed';
      }
    } else {
      // Recent orders (< 3 days)
      const roll = rand();
      if (roll < 0.25) {
        status = 'pending';
      } else if (roll < 0.60) {
        status = 'confirmed';
      } else if (roll < 0.85) {
        status = 'shipped';
      } else if (roll < 0.95) {
        status = 'delivered';
      } else {
        status = 'refused';
      }
    }

    const quantity = 1;
    const shippingMillimes = product.shipping;
    const returnShippingMillimes = status === 'refused' ? product.returnShipping : 0;
    const courierFeeMillimes = courier === 'aramex' ? 2000 : 0;
    const adCpaMillimes = product.cpa;

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
    if (status !== 'pending') {
      statusHistory.push({
        status,
        changedAt: deliveredAt ?? new Date(placedAt.getTime() + 24 * 60 * 60 * 1000),
        changedBy: 'system',
      });
    }

    const order = {
      _id: `65f${i.toString(16).padStart(21, '0')}`,
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
  }

  // 2. Courier Settlements (Some settled, some pending)
  // Group delivered orders older than 15 days by courier into settled batches
  const yalidineDelivered = orders.filter(
    (o) => o.status === 'delivered' && o.courier === 'yalidine',
  );
  const aramexDelivered = orders.filter(
    (o) => o.status === 'delivered' && o.courier === 'aramex',
  );

  // Split into batches
  const yalidineBatch1 = yalidineDelivered.slice(0, 100);
  const yalidineBatch2 = yalidineDelivered.slice(100, 160); // pending
  const aramexBatch1 = aramexDelivered.slice(0, 70);
  const aramexBatch2 = aramexDelivered.slice(70, 110); // pending

  const settlements: SeedSettlement[] = [
    {
      _id: '65fa10000000000000000001',
      workspaceId: WORKSPACE_ID,
      courier: 'yalidine' as const,
      settlementDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: yalidineBatch1.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: yalidineBatch1.map((o) => o._id),
      status: 'settled' as const,
      reconciledAt: new Date(now.getTime() - 44 * 24 * 60 * 60 * 1000),
      version: 2,
    },
    {
      _id: '65fa10000000000000000002',
      workspaceId: WORKSPACE_ID,
      courier: 'aramex' as const,
      settlementDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: aramexBatch1.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: aramexBatch1.map((o) => o._id),
      status: 'settled' as const,
      reconciledAt: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
      version: 2,
    },
    {
      _id: '65fa10000000000000000003',
      workspaceId: WORKSPACE_ID,
      courier: 'yalidine' as const,
      settlementDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: yalidineBatch2.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: yalidineBatch2.map((o) => o._id),
      status: 'pending' as const,
      version: 1,
    },
    {
      _id: '65fa10000000000000000004',
      workspaceId: WORKSPACE_ID,
      courier: 'aramex' as const,
      settlementDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      totalAmountMillimes: aramexBatch2.reduce((sum, o) => sum + o.unitPriceMillimes, 0),
      orderIds: aramexBatch2.map((o) => o._id),
      status: 'pending' as const,
      version: 1,
    },
  ];

  // Set settlementId on settled orders
  for (const o of yalidineBatch1) {
    o.settlementId = '65fa10000000000000000001';
  }
  for (const o of aramexBatch1) {
    o.settlementId = '65fa10000000000000000002';
  }

  // 3. Ad Spend entries across the 90 days
  // Daily / bi-daily campaign records
  const adSpends: SeedAdSpend[] = [];
  const platforms = ['facebook', 'tiktok', 'google', 'instagram'];
  let currentDay = new Date(ninetyDaysAgo);
  let spendCounter = 1;

  while (currentDay.getTime() <= now.getTime()) {
    const nextDay = new Date(currentDay.getTime() + 24 * 60 * 60 * 1000);
    // 2-3 platform spend entries per day
    const entriesCount = randomInt(2, 3);
    for (let j = 0; j < entriesCount; j++) {
      const platform = platforms[j % platforms.length];
      const prod = CATALOG_PRODUCTS[spendCounter % CATALOG_PRODUCTS.length];
      const spendMillimes = randomInt(40000, 110000); // 40 to 110 TND/day per campaign

      adSpends.push({
        _id: `65fb${spendCounter.toString(16).padStart(20, '0')}`,
        workspaceId: WORKSPACE_ID,
        platform,
        campaignName: `${prod.name.split(' ')[0]} Acquisition ${platform.toUpperCase()}`,
        periodStart: currentDay,
        periodEnd: nextDay,
        spendMillimes,
        currency: 'TND',
        productId: prod.id,
        notes: `Automated ad spend import for ${prod.name}`,
        version: 1,
        createdAt: currentDay,
        updatedAt: currentDay,
      });
      spendCounter++;
    }
    currentDay = nextDay;
  }

  // 4. Six monthly fixed expense types
  const expenses: SeedExpense[] = [
    {
      _id: '65fc00000000000000000001',
      workspaceId: WORKSPACE_ID,
      category: 'rent' as const,
      description: 'Loyer Bureau & Entrepôt La Marsa',
      amountMillimes: 1500000, // 1,500 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000002',
      workspaceId: WORKSPACE_ID,
      category: 'salary' as const,
      description: 'Salaire Direction & Stratégie',
      amountMillimes: 2500000, // 2,500 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000003',
      workspaceId: WORKSPACE_ID,
      category: 'salary' as const,
      description: 'Salaire Gestionnaire Commandes & Service Client',
      amountMillimes: 1200000, // 1,200 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000004',
      workspaceId: WORKSPACE_ID,
      category: 'utilities' as const,
      description: 'Fibre Optique, Électricité & Eau',
      amountMillimes: 350000, // 350 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000005',
      workspaceId: WORKSPACE_ID,
      category: 'logistics' as const,
      description: 'Abonnement Plateforme WMS & Emballages Premium',
      amountMillimes: 400000, // 400 TND / month
      periodType: 'monthly' as const,
      startDate: new Date('2025-11-01T00:00:00Z'),
      version: 1,
    },
    {
      _id: '65fc00000000000000000006',
      workspaceId: WORKSPACE_ID,
      category: 'marketing' as const,
      description: 'Shopify Pro, Canva Pro & Outils Tracking',
      amountMillimes: 250000, // 250 TND / month
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
