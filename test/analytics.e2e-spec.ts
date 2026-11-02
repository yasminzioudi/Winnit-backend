import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import * as mongoose from 'mongoose';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/utils/configure-app';
import { ensureIndexes } from '../src/database/ensure-indexes';
import {
  calculateWaterfall,
  calculateAdSpendDelta,
  calculateLedgerNet,
  type OrderFinance,
} from '../src/profit-os/domain/finance';

describe('Analytics & Insights API (e2e)', () => {
  let app: INestApplication;
  let mongoClient: MongoClient;
  let mongooseConnection: mongoose.Connection;
  const WORKSPACE_A = 'ws_maison_ambre';
  const WORKSPACE_B = 'ws_analytics_test_b';

  const fromDateStr = '2026-03-01T00:00:00.000Z';
  const toDateStr = '2026-03-31T23:59:59.000Z';

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/winnit_test';

    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();

    mongooseConnection = mongoose.createConnection(mongoUri);
    await mongooseConnection.asPromise();
    await ensureIndexes(mongooseConnection);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const db = mongoClient.db();

    // Clean test workspaces — targeted to avoid race with concurrent suites
    await db.collection('orders').deleteMany({
      $or: [
        { workspaceId: WORKSPACE_B },
        { _id: { $in: ['ord_e2e_001', 'ord_e2e_002', 'ord_e2e_003'] as any } },
        { idempotencyKey: 'cache-inval-001' },
      ],
    });
    await db.collection('ad_spend').deleteMany({
      $or: [
        { workspaceId: WORKSPACE_B },
        { _id: 'spend_e2e_001' as any },
      ],
    });
    await db.collection('expenses').deleteMany({
      $or: [
        { workspaceId: WORKSPACE_B },
        { _id: 'exp_e2e_001' as any },
      ],
    });
    await db.collection('settlements').deleteMany({
      $or: [
        { workspaceId: WORKSPACE_B },
        { _id: 'stl_e2e_001' as any },
      ],
    });

    // Seed test orders for WORKSPACE_A
    await db.collection('orders').insertMany([
      {
        _id: 'ord_e2e_001',
        workspaceId: WORKSPACE_A,
        orderNumber: 'ORD-E2E-001',
        productId: 'prd_001',
        productNameSnapshot: "Aura d'Ambre",
        quantity: 1,
        unitPriceMillimes: 129000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 21400,
        courier: 'yalidine',
        customer: { firstName: 'Alice', city: 'Tunis', governorate: 'Tunis' },
        status: 'delivered',
        placedAt: new Date('2026-03-10T10:00:00Z'),
        deliveredAt: new Date('2026-03-12T10:00:00Z'),
        netContributionMillimes: 72600,
        version: 1,
        deletedAt: null,
      },
      {
        _id: 'ord_e2e_002',
        workspaceId: WORKSPACE_A,
        orderNumber: 'ORD-E2E-002',
        productId: 'prd_001',
        productNameSnapshot: "Aura d'Ambre",
        quantity: 1,
        unitPriceMillimes: 129000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        returnShippingMillimes: 7000,
        courierFeeMillimes: 0,
        adCpaMillimes: 21400,
        courier: 'yalidine',
        customer: { firstName: 'Bob', city: 'Sousse', governorate: 'Sousse' },
        status: 'refused',
        placedAt: new Date('2026-03-15T14:00:00Z'),
        deliveredAt: null,
        netContributionMillimes: -35400,
        version: 1,
        deletedAt: null,
      },
      {
        _id: 'ord_e2e_003',
        workspaceId: WORKSPACE_A,
        orderNumber: 'ORD-E2E-003',
        productId: 'prd_003',
        productNameSnapshot: 'Desk Lamp',
        quantity: 1,
        unitPriceMillimes: 249000,
        unitCogsMillimes: 65000,
        shippingMillimes: 12000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 3500,
        adCpaMillimes: 38000,
        courier: 'aramex',
        customer: { firstName: 'Charlie', city: 'Sfax', governorate: 'Sfax' },
        status: 'delivered',
        placedAt: new Date('2026-03-20T09:00:00Z'),
        deliveredAt: new Date('2026-03-22T09:00:00Z'),
        netContributionMillimes: 130500,
        version: 1,
        deletedAt: null,
      },
      // Order for Tenant B (isolation test)
      {
        _id: 'ord_e2e_b01',
        workspaceId: WORKSPACE_B,
        orderNumber: 'ORD-B-001',
        productId: 'prd_001',
        productNameSnapshot: "Aura d'Ambre",
        quantity: 1,
        unitPriceMillimes: 129000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 21400,
        courier: 'yalidine',
        customer: { firstName: 'Zara', city: 'Tunis', governorate: 'Tunis' },
        status: 'delivered',
        placedAt: new Date('2026-03-10T10:00:00Z'),
        deliveredAt: new Date('2026-03-12T10:00:00Z'),
        netContributionMillimes: 72600,
        version: 1,
        deletedAt: null,
      },
    ] as any[]);

    // Seed ad spend
    await db.collection('ad_spend').insertOne({
      _id: 'spend_e2e_001',
      workspaceId: WORKSPACE_A,
      platform: 'facebook',
      campaignName: 'Winter Acquisition',
      periodStart: new Date('2026-03-05T00:00:00Z'),
      periodEnd: new Date('2026-03-25T23:59:59Z'),
      spendMillimes: 85000,
      currency: 'TND',
      productId: 'prd_001',
      version: 1,
      deletedAt: null,
    } as any);

    // Seed expense
    await db.collection('expenses').insertOne({
      _id: 'exp_e2e_001',
      workspaceId: WORKSPACE_A,
      category: 'rent',
      description: 'Bureau',
      amountMillimes: 1500000,
      periodType: 'monthly',
      startDate: new Date('2025-01-01T00:00:00Z'),
      version: 1,
      deletedAt: null,
    } as any);

    // Seed settlement
    await db.collection('settlements').insertOne({
      _id: 'stl_e2e_001',
      workspaceId: WORKSPACE_A,
      courier: 'yalidine',
      settlementDate: new Date('2026-03-28T00:00:00Z'),
      totalAmountMillimes: 129000,
      orderIds: ['ord_e2e_001'],
      status: 'settled',
      version: 1,
      deletedAt: null,
    } as any);
  });

  afterAll(async () => {
    const db = mongoClient.db();
    await db.collection('orders').deleteMany({
      $or: [
        { workspaceId: WORKSPACE_B },
        { _id: { $in: ['ord_e2e_001', 'ord_e2e_002', 'ord_e2e_003'] as any } },
        { idempotencyKey: 'cache-inval-001' },
      ],
    });
    await db.collection('ad_spend').deleteMany({
      $or: [
        { workspaceId: WORKSPACE_B },
        { _id: 'spend_e2e_001' as any },
      ],
    });
    await db.collection('expenses').deleteMany({
      $or: [
        { workspaceId: WORKSPACE_B },
        { _id: 'exp_e2e_001' as any },
      ],
    });
    await db.collection('settlements').deleteMany({
      $or: [
        { workspaceId: WORKSPACE_B },
        { _id: 'stl_e2e_001' as any },
      ],
    });

    if (mongooseConnection) await mongooseConnection.close();
    if (mongoClient) await mongoClient.close();
    if (app) await app.close();
  });

  describe('GET /api/v1/analytics/summary', () => {
    it('returns 200 with exact finance domain identities on seeded data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/analytics/summary?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      const body = response.body;

      // Verify domain consistency with raw orders
      const rawOrders: OrderFinance[] = [
        {
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          quantity: 1,
          shippingMillimes: 7000,
          returnShippingMillimes: 0,
          courierFeeMillimes: 0,
          adCpaMillimes: 21400,
          status: 'delivered',
        },
        {
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          quantity: 1,
          shippingMillimes: 7000,
          returnShippingMillimes: 7000,
          courierFeeMillimes: 0,
          adCpaMillimes: 21400,
          status: 'refused',
        },
        {
          unitPriceMillimes: 249000,
          unitCogsMillimes: 65000,
          quantity: 1,
          shippingMillimes: 12000,
          returnShippingMillimes: 0,
          courierFeeMillimes: 3500,
          adCpaMillimes: 38000,
          status: 'delivered',
        },
      ];

      const expectedWaterfall = calculateWaterfall(rawOrders, 85000);
      const expectedDelta = calculateAdSpendDelta(rawOrders, 85000);
      const expectedLedger = calculateLedgerNet(rawOrders);

      expect(body.waterfall.grossRevenueMillimes).toBe(expectedWaterfall.grossRevenueMillimes);
      expect(body.waterfall.productCOGSMillimes).toBe(expectedWaterfall.productCOGSMillimes);
      expect(body.waterfall.outboundShippingMillimes).toBe(expectedWaterfall.outboundShippingMillimes);
      expect(body.waterfall.paidAdSpendMillimes).toBe(85000);
      expect(body.waterfall.codRefusalPenaltyMillimes).toBe(expectedWaterfall.codRefusalPenaltyMillimes);
      expect(body.waterfall.netRealizedContributionMillimes).toBe(expectedWaterfall.netRealizedContributionMillimes);
      expect(body.waterfall.adSpendDeltaMillimes).toBe(expectedDelta);
      expect(body.waterfall.ledgerNetMillimes).toBe(expectedLedger);

      // Identity check: netRealizedContribution + adSpendDelta === ledgerNet
      expect(
        body.waterfall.netRealizedContributionMillimes + body.waterfall.adSpendDeltaMillimes,
      ).toBe(body.waterfall.ledgerNetMillimes);

      // KPIs
      expect(body.kpis.totalOrdersCount).toBe(3);
      expect(body.kpis.deliveredCount).toBe(2);
      expect(body.kpis.refusedCount).toBe(1);

      // Expenses
      expect(body.expenses.fixedExpensesMillimes).toBe(1500000);

      // COD
      expect(body.cod.bankWireSettledMillimes).toBe(129000);
    });

    it('enforces tenant isolation: Workspace B sees only its own data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/analytics/summary?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(200);

      expect(response.body.kpis.totalOrdersCount).toBe(1);
      expect(response.body.waterfall.grossRevenueMillimes).toBe(129000);
      expect(response.body.waterfall.paidAdSpendMillimes).toBe(0);
    });

    it('returns ETag and responds with 304 on If-None-Match', async () => {
      const res1 = await request(app.getHttpServer())
        .get(`/api/v1/analytics/summary?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      const etag = res1.headers['etag'];
      expect(etag).toBeDefined();

      await request(app.getHttpServer())
        .get(`/api/v1/analytics/summary?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .set('if-none-match', etag)
        .expect(304);
    });

    it('invalidates cache when an order is written', async () => {
      // Prime cache
      await request(app.getHttpServer())
        .get(`/api/v1/analytics/summary?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      // Add new order
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', 'cache-inval-001')
        .send({
          productId: 'prd_001',
          quantity: 1,
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          shippingMillimes: 7000,
          adCpaMillimes: 22000,
          courier: 'yalidine',
          placedAt: '2026-03-25T10:00:00Z',
          customer: { firstName: 'CacheTest', city: 'Tunis', governorate: 'Tunis' },
        })
        .expect(201);

      // Call summary again: orders count should now be 4
      const resFresh = await request(app.getHttpServer())
        .get(`/api/v1/analytics/summary?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(resFresh.body.kpis.totalOrdersCount).toBe(4);
    });

    it('returns 400 Problem+JSON when from > to', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary?from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);

      expect(res.body.type).toBe('https://winnit.tn/errors/400');
      expect(res.body.detail).toContain('Start date (from) must be before or equal to end date (to)');
    });

    it('rejects $-prefixed query keys with 400 Problem+JSON', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary?$where=1')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);

      expect(res.body.type).toBe('https://winnit.tn/errors/400');
    });
  });

  describe('Other Analytics Endpoints', () => {
    it('GET /api/v1/analytics/timeseries returns buckets', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/timeseries?from=${fromDateStr}&to=${toDateStr}&granularity=daily`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(res.body.granularity).toBe('daily');
      expect(Array.isArray(res.body.buckets)).toBe(true);
    });

    it('GET /api/v1/analytics/by-product returns product aggregations', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/by-product?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('productId');
      expect(res.body[0]).toHaveProperty('deliveryRatePercent');
    });

    it('GET /api/v1/analytics/by-courier returns courier breakdowns', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/by-courier?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('courier');
    });

    it('GET /api/v1/analytics/by-governorate returns geographic breakdowns', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/by-governorate?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('governorate');
    });

    it('GET /api/v1/analytics/cod returns reconciliation and aging breakdown', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/cod')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('aging');
      expect(res.body).toHaveProperty('byCourier');
    });

    it('GET /api/v1/analytics/winners returns scored products', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/winners?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('score');
        expect(res.body[0]).toHaveProperty('label');
      }
    });
  });

  describe('GET /api/v1/insights', () => {
    it('returns rule-based insights', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/insights?from=${fromDateStr}&to=${toDateStr}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/v1/pricing/optimize', () => {
    it('optimizes pricing and returns recommended band, curve, and disclaimer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pricing/optimize')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          basePriceMillimes: 129000,
          cogsMillimes: 28000,
          logisticsMillimes: 14000,
          baseVolume: 100,
          elasticity: -1.5,
          baseRefusalRate: 0.2,
          refusalSensitivity: 0.002,
          targetMarginPercent: 50,
        })
        .expect(200);

      expect(res.body.basePriceMillimes).toBe(129000);
      expect(res.body.unitCostMillimes).toBe(42000);
      expect(res.body.breakEvenPriceMillimes).toBe(42000);
      expect(res.body.targetMarginPriceMillimes).toBe(84000);
      expect(res.body.disclaimer).toBe('modèle basé sur vos hypothèses');
      expect(res.body.recommendedBand.label).toBe('modèle basé sur vos hypothèses');
      expect(Array.isArray(res.body.curve)).toBe(true);
    });

    it('rejects invalid inputs with 400 Problem+JSON', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pricing/optimize')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          basePriceMillimes: -100,
          cogsMillimes: 28000,
          logisticsMillimes: 14000,
        })
        .expect(400);

      expect(res.body.type).toBe('https://winnit.tn/errors/400');
    });
  });
});
