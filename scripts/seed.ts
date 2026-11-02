import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import {
  generateSeedDataset,
  WORKSPACE_ID,
  type SeedOrder,
  type SeedSettlement,
  type SeedAdSpend,
  type SeedExpense,
  type SeedScenario,
  type SeedReport,
  type SeedCounter,
} from '../src/database/seed-generator';
import {
  calculateWaterfall,
  calculateLedgerNet,
  calculateAdSpendDelta,
} from '../src/profit-os/domain/finance';

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/winnit';

const SEED_REFERENCE_DATE = process.env.SEED_REFERENCE_DATE
  ? new Date(process.env.SEED_REFERENCE_DATE)
  : new Date();

async function seed() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log(`========================================`);
    console.log(`🌱 WINNIT OS Profit OS: Full Deterministic Seed`);
    console.log(`🏢 Workspace: ${WORKSPACE_ID}`);
    console.log(`📅 Reference Date: ${SEED_REFERENCE_DATE.toISOString().split('T')[0]}`);
    console.log(`========================================`);

    // Clean existing data for this workspace across all Profit OS collections
    await db.collection('orders').deleteMany({ workspaceId: WORKSPACE_ID });
    await db.collection('counters').deleteMany({ workspaceId: WORKSPACE_ID });
    await db.collection('ad_spend').deleteMany({ workspaceId: WORKSPACE_ID });
    await db.collection('expenses').deleteMany({ workspaceId: WORKSPACE_ID });
    await db.collection('scenarios').deleteMany({ workspaceId: WORKSPACE_ID });
    await db.collection('settlements').deleteMany({ workspaceId: WORKSPACE_ID });
    await db.collection('reports').deleteMany({ workspaceId: WORKSPACE_ID });

    console.log('✓ Cleaned existing data for workspace across all collections');

    const dataset = generateSeedDataset(SEED_REFERENCE_DATE);

    // 1. Insert Orders
    await db.collection<SeedOrder>('orders').insertMany(dataset.orders);
    console.log(`✓ Inserted ${dataset.orders.length} orders over 90 days`);

    // 2. Set Counter to 600
    await db.collection<SeedCounter>('counters').insertOne({
      workspaceId: WORKSPACE_ID,
      name: 'order',
      value: dataset.orders.length,
    });
    console.log(`✓ Initialized atomic order counter to ${dataset.orders.length}`);

    // 3. Insert Settlements
    await db.collection<SeedSettlement>('settlements').insertMany(dataset.settlements);
    console.log(`✓ Inserted ${dataset.settlements.length} courier settlements`);

    // 4. Insert Ad Spend
    await db.collection<SeedAdSpend>('ad_spend').insertMany(dataset.adSpends);
    console.log(`✓ Inserted ${dataset.adSpends.length} ad spend entries`);

    // 5. Insert Fixed Expenses
    await db.collection<SeedExpense>('expenses').insertMany(dataset.expenses);
    console.log(`✓ Inserted ${dataset.expenses.length} monthly expense categories`);

    // 6. Insert Pricing Scenarios
    await db.collection<SeedScenario>('scenarios').insertMany(dataset.scenarios);
    console.log(`✓ Inserted ${dataset.scenarios.length} saved pricing scenarios`);

    // 7. Insert Reports
    await db.collection<SeedReport>('reports').insertMany(dataset.reports);
    console.log(`✓ Inserted ${dataset.reports.length} report placeholder records`);

    // 30-Day Waterfall Metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const orders30d = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= now,
    );
    const adSpends30d = dataset.adSpends.filter(
      (s) => s.periodStart >= thirtyDaysAgo && s.periodStart <= now,
    );
    const totalAdSpend30d = adSpends30d.reduce(
      (sum, s) => sum + s.spendMillimes,
      0,
    );

    const waterfall = calculateWaterfall(orders30d, totalAdSpend30d);
    const ledgerNet = calculateLedgerNet(orders30d);
    const adSpendDelta = calculateAdSpendDelta(orders30d, totalAdSpend30d);

    const resolvedOrders = dataset.orders.filter(
      (o) => o.status === 'delivered' || o.status === 'refused',
    );
    const refusedOrders = dataset.orders.filter((o) => o.status === 'refused');
    const globalRefusalRate = (
      (refusedOrders.length / resolvedOrders.length) *
      100
    ).toFixed(1);

    console.log(`\n========================================`);
    console.log(`📊 REAL 30-DAY WATERFALL (TND)`);
    console.log(`========================================`);
    console.log(`   30-Day Orders Sample:         ${orders30d.length} orders`);
    console.log(`   Global 90-Day Refusal Rate:   ${globalRefusalRate}% (spec: 18-24%)`);
    console.log(`   Gross Revenue:                ${(waterfall.grossRevenueMillimes / 1000).toFixed(3)} TND`);
    console.log(`   Product COGS:                 -${(waterfall.productCOGSMillimes / 1000).toFixed(3)} TND`);
    console.log(`   Outbound Shipping:            -${(waterfall.outboundShippingMillimes / 1000).toFixed(3)} TND`);
    console.log(`   Paid Ad Spend:                -${(waterfall.paidAdSpendMillimes / 1000).toFixed(3)} TND`);
    console.log(`   COD Refusal Penalty:          -${(waterfall.codRefusalPenaltyMillimes / 1000).toFixed(3)} TND`);
    console.log(`   ----------------------------------------`);
    console.log(`   Net Realized Contribution:    ${(waterfall.netRealizedContributionMillimes / 1000).toFixed(3)} TND`);
    console.log(`   Ad Spend Delta:               ${(adSpendDelta / 1000).toFixed(3)} TND`);
    console.log(`   Ledger Net:                   ${(ledgerNet / 1000).toFixed(3)} TND`);
    console.log(`   Identity Check:               ${waterfall.netRealizedContributionMillimes + adSpendDelta === ledgerNet ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`========================================\n`);

    console.log(`📁 MongoDB Compass Checklist (${WORKSPACE_ID}):`);
    console.log(`   - orders:      ${dataset.orders.length} documents`);
    console.log(`   - counters:    1 document (value: ${dataset.orders.length})`);
    console.log(`   - ad_spend:    ${dataset.adSpends.length} documents`);
    console.log(`   - expenses:    ${dataset.expenses.length} documents`);
    console.log(`   - scenarios:   ${dataset.scenarios.length} documents`);
    console.log(`   - settlements: ${dataset.settlements.length} documents`);
    console.log(`   - reports:     ${dataset.reports.length} documents`);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
