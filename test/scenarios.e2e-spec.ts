import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import * as mongoose from 'mongoose';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/utils/configure-app';
import { ensureIndexes } from '../src/database/ensure-indexes';

describe('Scenarios API (e2e)', () => {
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
      .collection('scenarios')
      .deleteMany({ workspaceId: { $in: [WORKSPACE_A, WORKSPACE_B] } });

    await mongooseConnection.close();
    await mongoClient.close();
    await app.close();
  });

  describe('POST /api/v1/scenarios', () => {
    it('creates a pricing scenario and returns 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/scenarios')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          name: 'Promo Q1 Test',
          productId: 'prd_001',
          unitPriceMillimes: 125000,
          unitCogsMillimes: 28000,
          shippingMillimes: 7000,
          adCpaMillimes: 20000,
        })
        .expect(201);

      expect(response.body._id).toBeDefined();
      expect(response.body.name).toBe('Promo Q1 Test');
      expect(response.body.unitPriceMillimes).toBe(125000);
      expect(response.body.version).toBe(1);
    });

    it('replays same record for identical payload', async () => {
      const key = `idem-scen-${Date.now()}`;
      const payload = {
        name: 'Identical Scenario',
        productId: 'prd_002',
        unitPriceMillimes: 219000,
        unitCogsMillimes: 52000,
        shippingMillimes: 7000,
        adCpaMillimes: 25000,
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/scenarios')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);

      const replay = await request(app.getHttpServer())
        .post('/api/v1/scenarios')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload);

      expect(replay.status).toBeGreaterThanOrEqual(200);
      expect(replay.status).toBeLessThan(300);
      expect(replay.body._id).toBe(first.body._id);
    });

    it('returns 422 when idempotency key is reused with different payload', async () => {
      const key = `idem-scen-diff-${Date.now()}`;
      const payload = {
        name: 'Initial Scenario',
        productId: 'prd_001',
        unitPriceMillimes: 129000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        adCpaMillimes: 22000,
      };

      await request(app.getHttpServer())
        .post('/api/v1/scenarios')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/scenarios')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send({
          ...payload,
          unitPriceMillimes: 139000, // Different price
        })
        .expect(422);

      expect(res.body.status).toBe(422);
      expect(res.body.type).toContain('/422');
    });
  });

  describe('Query Validation & $ Guard', () => {
    it('rejects query keys starting with $', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scenarios?$where=1')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);
    });

    it('rejects limit > 100', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scenarios?limit=101')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);
    });
  });

  describe('Tenant Isolation, Updates & Deletion', () => {
    let recordId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/scenarios')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          name: 'Tenant Isolation Scenario',
          productId: 'prd_003',
          unitPriceMillimes: 239000,
          unitCogsMillimes: 65000,
          shippingMillimes: 12000,
          adCpaMillimes: 35000,
        })
        .expect(201);
      recordId = res.body._id;
    });

    it('workspace B cannot read workspace A scenario', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/scenarios/${recordId}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(404);
    });

    it('returns 409 on version conflict', async () => {
      // Successful update
      await request(app.getHttpServer())
        .patch(`/api/v1/scenarios/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({ unitPriceMillimes: 245000, version: 1 })
        .expect(200);

      // Stale update (version 1 again) -> 409
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/scenarios/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({ unitPriceMillimes: 250000, version: 1 })
        .expect(409);

      expect(res.body.title).toBe('Version conflict');
    });

    it('returns 404 on non-existent record patch', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/scenarios/507f1f77bcf86cd799439011')
        .set('x-workspace-id', WORKSPACE_A)
        .send({ version: 1 })
        .expect(404);

      expect(res.body.title).toBe('Scenario not found');
    });

    it('workspace B cannot delete workspace A scenario', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/scenarios/${recordId}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(404);
    });

    it('workspace A can soft delete scenario', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/scenarios/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/scenarios/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(404);
    });
  });
});
