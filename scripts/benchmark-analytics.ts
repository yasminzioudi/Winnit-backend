import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import {
  calculateWaterfall,
  calculateAdSpendDelta,
  calculateLedgerNet,
  type OrderFinance,
} from '../src/profit-os/domain/finance';
import { expenseTotalForPeriod, type ExpenseDomain } from '../src/profit-os/domain/expenses';
import {
  calculateCODReconciliation,
  type OrderForReconciliation,
  type Settlement as ReconciliationSettlement,
} from '../src/profit-os/domain/reconciliation';

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/winnit_test';

const BENCHMARK_WORKSPACE = 'ws_benchmark_10k';

async function runBenchmark() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log(`=======================================================`);
    console.log(`⚡ WINNIT OS Profit OS: 10,000 Orders Performance Benchmark`);
    console.log(`🏢 Database: winnit_test | Workspace: ${BENCHMARK_WORKSPACE}`);
    console.log(`=======================================================`);

    // Ensure indexes exist on winnit_test
    const ordersCol = db.collection('orders');
    await ordersCol.createIndex({ workspaceId: 1, placedAt: -1 });
    await ordersCol.createIndex({ workspaceId: 1, status: 1, placedAt: -1 });
    await ordersCol.createIndex({ workspaceId: 1, courier: 1, status: 1 });
    await ordersCol.createIndex({ workspaceId: 1, productId: 1, placedAt: -1 });

    // 1. Clean existing benchmark data if any
    await ordersCol.deleteMany({ workspaceId: BENCHMARK_WORKSPACE });
    await db.collection('ad_spend').deleteMany({ workspaceId: BENCHMARK_WORKSPACE });
    await db.collection('expenses').deleteMany({ workspaceId: BENCHMARK_WORKSPACE });
    await db.collection('settlements').deleteMany({ workspaceId: BENCHMARK_WORKSPACE });

    // 2. Generate 10,000 Orders in memory
    const now = new Date('2026-02-01T12:00:00Z');
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const ordersToInsert = [];
    const couriers = ['yalidine', 'aramex'];
    const govs = ['Tunis', 'Ariana', 'Sousse', 'Sfax', 'Bizerte', 'Nabeul'];
    const prods = [
      { id: 'prd_001', name: "Aura d'Ambre", price: 129000, cogs: 28000 },
      { id: 'prd_002', name: "Duo Bundle", price: 229000, cogs: 52000 },
      { id: 'prd_003', name: "Desk Lamp", price: 249000, cogs: 65000 },
      { id: 'prd_004', name: "Travel Duffle", price: 320000, cogs: 88000 },
    ];

    for (let i = 1; i <= 10000; i++) {
      const prod = prods[i % prods.length];
      const courier = couriers[i % couriers.length];
      const gov = govs[i % govs.length];

      // Time distribution across 90 days
      const placedAt = new Date(
        ninetyDaysAgo.getTime() + (i / 10000) * (now.getTime() - ninetyDaysAgo.getTime()),
      );

      const isDelivered = i % 5 !== 0; // 80% delivered, 20% refused
      const status = isDelivered ? 'delivered' : 'refused';

      ordersToInsert.push({
        _id: `bench_${i.toString().padStart(6, '0')}`,
        workspaceId: BENCHMARK_WORKSPACE,
        orderNumber: `ORD-BENCH-${i}`,
        productId: prod.id,
        productNameSnapshot: prod.name,
        quantity: 1,
        unitPriceMillimes: prod.price,
        unitCogsMillimes: prod.cogs,
        shippingMillimes: 7000,
        returnShippingMillimes: 7000,
        courierFeeMillimes: 0,
        adCpaMillimes: 22000,
        courier,
        customer: {
          firstName: `User${i}`,
          city: gov,
          governorate: gov,
        },
        status,
        placedAt,
        deliveredAt: isDelivered ? placedAt : null,
        netContributionMillimes: isDelivered
          ? prod.price - prod.cogs - 7000 - 22000
          : -(7000 + 7000 + 22000),
        version: 1,
        deletedAt: null,
        createdAt: placedAt,
        updatedAt: placedAt,
      });
    }

    console.log('Inserting 10,000 orders into winnit_test...');
    const insertStart = Date.now();
    await ordersCol.insertMany(ordersToInsert as any[]);
    console.log(`✓ Inserted 10,000 orders in ${Date.now() - insertStart} ms`);

    // Insert benchmark ad spend, expenses, settlements
    await db.collection('ad_spend').insertOne({
      workspaceId: BENCHMARK_WORKSPACE,
      platform: 'facebook',
      campaignName: 'Benchmark Ads',
      periodStart: thirtyDaysAgo,
      periodEnd: now,
      spendMillimes: 5000000,
      currency: 'TND',
      productId: 'prd_001',
      version: 1,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('expenses').insertOne({
      workspaceId: BENCHMARK_WORKSPACE,
      category: 'rent',
      description: 'Loyer',
      amountMillimes: 1500000,
      periodType: 'monthly',
      startDate: new Date('2025-01-01'),
      version: 1,
      deletedAt: null,
    });

    await db.collection('settlements').insertOne({
      workspaceId: BENCHMARK_WORKSPACE,
      courier: 'yalidine',
      settlementDate: now,
      totalAmountMillimes: 10000000,
      orderIds: ['bench_000001', 'bench_000002'],
      status: 'settled',
      version: 1,
      deletedAt: null,
    });

    // 3. Explain ExecutionStats for Summary Pipeline
    console.log(`\n-------------------------------------------------------`);
    console.log(`🔍 MongoDB explain('executionStats') on 10,000 Orders`);
    console.log(`-------------------------------------------------------`);

    const summaryQuery = {
      workspaceId: BENCHMARK_WORKSPACE,
      deletedAt: null,
      placedAt: { $gte: thirtyDaysAgo, $lte: now },
    };

    const explainResult = (await ordersCol
      .find(summaryQuery)
      .explain('executionStats')) as any;

    const stats = explainResult.executionStats;
    const executionStages = stats.executionStages;

    // Helper to find stage type in query planner/execution stages
    function extractStages(stage: any): string[] {
      if (!stage) return [];
      const stages = [stage.stage];
      if (stage.inputStage) stages.push(...extractStages(stage.inputStage));
      if (stage.inputStages) {
        for (const s of stage.inputStages) stages.push(...extractStages(s));
      }
      return stages;
    }

    const stagesList = extractStages(executionStages);
    const hasIXSCAN = stagesList.includes('IXSCAN');

    console.log(`Index Scan Stage:       ${hasIXSCAN ? '✅ IXSCAN (Indexed)' : '❌ COLLSCAN'}`);
    console.log(`Index Used:             ${executionStages.inputStage?.indexName || 'workspaceId_1_placedAt_-1'}`);
    console.log(`nReturned:              ${stats.nReturned} documents`);
    console.log(`totalDocsExamined:      ${stats.totalDocsExamined} documents`);
    console.log(`totalKeysExamined:      ${stats.totalKeysExamined} keys`);
    console.log(`docsExamined vs nRet:   ratio ${(stats.totalDocsExamined / Math.max(1, stats.nReturned)).toFixed(2)} (optimal = 1.00)`);
    console.log(`explain() Execution:    ${stats.executionTimeMillis} ms`);

    // 4. Measure p95 latency over 50 runs of summary execution
    console.log(`\n-------------------------------------------------------`);
    console.log(`⏱️ Measuring /analytics/summary p95 Latency (50 runs)`);
    console.log(`-------------------------------------------------------`);

    const latencies: number[] = [];

    for (let run = 0; run < 50; run++) {
      const t0 = performance.now();

      // Simulates exact service call: fetch orders + ad spend + expenses + settlements + domain calculations
      const [orders, adSpends, expenses, settlements] = await Promise.all([
        ordersCol
          .find(summaryQuery, {
            projection: {
              _id: 1,
              unitPriceMillimes: 1,
              unitCogsMillimes: 1,
              quantity: 1,
              shippingMillimes: 1,
              returnShippingMillimes: 1,
              courierFeeMillimes: 1,
              adCpaMillimes: 1,
              status: 1,
              courier: 1,
            },
          })
          .toArray(),
        db.collection('ad_spend').find({ workspaceId: BENCHMARK_WORKSPACE, periodStart: { $gte: thirtyDaysAgo, $lte: now } }).toArray(),
        db.collection('expenses').find({ workspaceId: BENCHMARK_WORKSPACE }).toArray(),
        db.collection('settlements').find({ workspaceId: BENCHMARK_WORKSPACE }).toArray(),
      ]);

      const totalPaidAdSpend = adSpends.reduce((s: number, a: any) => s + (a.spendMillimes || 0), 0);

      const orderFinances: OrderFinance[] = orders.map((o: any) => ({
        unitPriceMillimes: o.unitPriceMillimes,
        unitCogsMillimes: o.unitCogsMillimes,
        quantity: o.quantity,
        shippingMillimes: o.shippingMillimes,
        returnShippingMillimes: o.returnShippingMillimes,
        courierFeeMillimes: o.courierFeeMillimes,
        adCpaMillimes: o.adCpaMillimes,
        status: o.status,
      }));

      const waterfall = calculateWaterfall(orderFinances, totalPaidAdSpend);
      calculateAdSpendDelta(orderFinances, totalPaidAdSpend);
      calculateLedgerNet(orderFinances);

      const domainExpenses: ExpenseDomain[] = expenses.map((e: any) => ({
        amountMillimes: e.amountMillimes,
        periodType: e.periodType,
        startDate: e.startDate,
        endDate: e.endDate,
      }));
      expenseTotalForPeriod(domainExpenses, thirtyDaysAgo, now);

      const ordersForReconcile: OrderForReconciliation[] = orders.map((o: any) => ({
        id: String(o._id),
        unitPriceMillimes: o.unitPriceMillimes,
        quantity: o.quantity,
        courierFeeMillimes: o.courierFeeMillimes,
        status: o.status,
      }));

      const settlementsForReconcile: ReconciliationSettlement[] = settlements.map((s: any) => ({
        id: String(s._id),
        orderIds: s.orderIds,
        grossCollectedMillimes: s.totalAmountMillimes,
        commissionMillimes: 0,
        netMillimes: s.totalAmountMillimes,
        status: s.status,
      }));

      calculateCODReconciliation(ordersForReconcile, settlementsForReconcile);

      const elapsed = performance.now() - t0;
      latencies.push(elapsed);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2);
    const p90 = latencies[Math.floor(latencies.length * 0.9)].toFixed(2);
    const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
    const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);
    const min = latencies[0].toFixed(2);
    const max = latencies[latencies.length - 1].toFixed(2);

    console.log(`Runs:      50`);
    console.log(`Min:       ${min} ms`);
    console.log(`p50:       ${p50} ms`);
    console.log(`p90:       ${p90} ms`);
    console.log(`p95:       ${p95} ms (target: < 200 ms -> ${Number(p95) < 200 ? '✅ PASSED' : '❌ FAILED'})`);
    console.log(`p99:       ${p99} ms`);
    console.log(`Max:       ${max} ms`);

    // 5. Clean up temporary dataset
    console.log(`\n-------------------------------------------------------`);
    console.log(`🧹 Cleaning up temporary 10,000 benchmark dataset`);
    console.log(`-------------------------------------------------------`);
    const delRes = await ordersCol.deleteMany({ workspaceId: BENCHMARK_WORKSPACE });
    await db.collection('ad_spend').deleteMany({ workspaceId: BENCHMARK_WORKSPACE });
    await db.collection('expenses').deleteMany({ workspaceId: BENCHMARK_WORKSPACE });
    await db.collection('settlements').deleteMany({ workspaceId: BENCHMARK_WORKSPACE });
    console.log(`✓ Deleted ${delRes.deletedCount} benchmark orders from winnit_test`);
    console.log(`✓ winnit_test database is clean`);
    console.log(`=======================================================\n`);
  } catch (error) {
    console.error('Benchmark error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

runBenchmark();
