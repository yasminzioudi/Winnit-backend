import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import * as mongoose from 'mongoose';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/utils/configure-app';
import { ensureIndexes } from '../src/database/ensure-indexes';

describe('Settlements API (e2e)', () => {
  let app: INestApplication;
  let mongoClient: MongoClient;
  let mongooseConnection: mongoose.Connection;
  const WORKSPACE_A = 'ws_maison_ambre';
  const WORKSPACE_B = 'ws_test_tenant_b';

  beforeAll(async () => {
    mongoClient = new MongoClient(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/winnit_test',
    );
    await mongoClient.connect();

    mongooseConnection = mongoose.createConnection(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/winnit_test',
    );
    await mongooseConnection.asPromise();
    await ensureIndexes(mongooseConnection);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    const db = mongoClient.db();
    await db
      .collection('settlements')
      .deleteMany({ workspaceId: { $in: [WORKSPACE_A, WORKSPACE_B] } });
    await db
      .collection('orders')
      .deleteMany({ workspaceId: { $in: [WORKSPACE_A, WORKSPACE_B] } });

    await mongooseConnection.close();
    await mongoClient.close();
    await app.close();
  });

  describe('POST /api/v1/settlements', () => {
    it('creates a settlement record and returns 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          courier: 'yalidine',
          settlementDate: '2026-01-20T00:00:00.000Z',
          totalAmountMillimes: 650000,
          orderIds: [],
        })
        .expect(201);

      expect(response.body._id).toBeDefined();
      expect(response.body.courier).toBe('yalidine');
      expect(response.body.status).toBe('pending');
      expect(response.body.totalAmountMillimes).toBe(650000);
      expect(response.body.version).toBe(1);
    });

    it('replays same record for identical payload', async () => {
      const key = `idem-settle-${Date.now()}`;
      const payload = {
        courier: 'aramex',
        settlementDate: '2026-01-20T00:00:00.000Z',
        totalAmountMillimes: 420000,
        orderIds: [],
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);

      const replay = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload);

      expect(replay.status).toBeGreaterThanOrEqual(200);
      expect(replay.status).toBeLessThan(300);
      expect(replay.body._id).toBe(first.body._id);
    });

    it('returns 422 when idempotency key is reused with different payload', async () => {
      const key = `idem-settle-diff-${Date.now()}`;
      const payload = {
        courier: 'aramex',
        settlementDate: '2026-01-20T00:00:00.000Z',
        totalAmountMillimes: 420000,
        orderIds: [],
      };

      await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send({
          ...payload,
          totalAmountMillimes: 500000,
        })
        .expect(422);

      expect(res.body.status).toBe(422);
      expect(res.body.type).toContain('/422');
    });
  });

  describe('Query Validation & $ Guard', () => {
    it('rejects query keys starting with $', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/settlements?$where=1')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);
    });

    it('rejects limit > 100', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/settlements?limit=101')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);
    });
  });

  describe('Reconciliation & Retry Safety', () => {
    let settlementId: string;
    let order1Id: string;
    let order2Id: string;

    beforeAll(async () => {
      // Create two test orders
      const ord1 = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          productId: 'prd_001',
          quantity: 1,
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          shippingMillimes: 7000,
          adCpaMillimes: 22000,
          courier: 'yalidine',
          customer: { firstName: 'Settle1', city: 'Tunis', governorate: 'Tunis' },
        })
        .expect(201);
      order1Id = ord1.body._id;

      const ord2 = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          productId: 'prd_001',
          quantity: 1,
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          shippingMillimes: 7000,
          adCpaMillimes: 22000,
          courier: 'yalidine',
          customer: { firstName: 'Settle2', city: 'Sousse', governorate: 'Sousse' },
        })
        .expect(201);
      order2Id = ord2.body._id;

      // Create settlement with these orders
      const st = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          courier: 'yalidine',
          settlementDate: '2026-01-25T00:00:00.000Z',
          totalAmountMillimes: 258000,
          orderIds: [order1Id, order2Id],
        })
        .expect(201);
      settlementId = st.body._id;
    });

    it('POST /settlements/:id/reconcile marks settled and links orders', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/settlements/${settlementId}/reconcile`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(res.body._id).toBe(settlementId);
      expect(res.body.status).toBe('settled');
      expect(res.body.reconciledAt).toBeDefined();

      // Verify orders received settlementId
      const o1 = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order1Id}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);
      expect(o1.body.settlementId).toBe(settlementId);

      const o2 = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order2Id}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);
      expect(o2.body.settlementId).toBe(settlementId);
    });

    it('reconcile retry safety: re-running reconcile succeeds with 200 without duplicate updates', async () => {
      // Fire reconcile again
      const retryRes = await request(app.getHttpServer())
        .post(`/api/v1/settlements/${settlementId}/reconcile`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);

      expect(retryRes.body._id).toBe(settlementId);
      expect(retryRes.body.status).toBe('settled');

      // Orders still correctly linked
      const o1 = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order1Id}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);
      expect(o1.body.settlementId).toBe(settlementId);
    });
  });

  describe('Tenant Isolation, Updates & Deletion', () => {
    let recordId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          courier: 'aramex',
          settlementDate: '2026-01-20T00:00:00.000Z',
          totalAmountMillimes: 300000,
          orderIds: [],
        })
        .expect(201);
      recordId = res.body._id;
    });

    it('workspace B cannot read workspace A settlement', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/settlements/${recordId}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(404);
    });

    it('returns 409 on version conflict', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/settlements/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({ totalAmountMillimes: 350000, version: 1 })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/settlements/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({ totalAmountMillimes: 400000, version: 1 })
        .expect(409);

      expect(res.body.title).toBe('Version conflict');
    });

    it('returns 404 on non-existent record patch', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/settlements/507f1f77bcf86cd799439011')
        .set('x-workspace-id', WORKSPACE_A)
        .send({ version: 1 })
        .expect(404);

      expect(res.body.title).toBe('Settlement not found');
    });

    it('workspace B cannot delete workspace A settlement', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/settlements/${recordId}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(404);
    });

    it('workspace A can soft delete settlement', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/settlements/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/settlements/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(404);
    });
  });
});

