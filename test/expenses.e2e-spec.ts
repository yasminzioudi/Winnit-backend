import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import * as mongoose from 'mongoose';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/utils/configure-app';
import { ensureIndexes } from '../src/database/ensure-indexes';

describe('Expenses API (e2e)', () => {
  let app: INestApplication;
  let mongoClient: MongoClient;
  let mongooseConnection: mongoose.Connection;
  const WORKSPACE_A = 'ws_maison_ambre';
  const WORKSPACE_B = 'ws_test_tenant_b';

  beforeAll(async () => {
    mongoClient = new MongoClient(
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/winnit_test',
    );
    await mongoClient.connect();

    mongooseConnection = mongoose.createConnection(
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/winnit_test',
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
      .collection('expenses')
      .deleteMany({ workspaceId: { $in: [WORKSPACE_A, WORKSPACE_B] } });

    await mongooseConnection.close();
    await mongoClient.close();
    await app.close();
  });

  describe('POST /api/v1/expenses', () => {
    it('creates an expense record and returns 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          category: 'rent',
          description: 'Bureau Tunis Test',
          amountMillimes: 1200000,
          periodType: 'monthly',
          startDate: '2026-01-01T00:00:00.000Z',
        })
        .expect(201);

      expect(response.body._id).toBeDefined();
      expect(response.body.category).toBe('rent');
      expect(response.body.amountMillimes).toBe(1200000);
      expect(response.body.version).toBe(1);
    });

    it('replays same record for identical payload', async () => {
      const key = `idem-exp-${Date.now()}`;
      const payload = {
        category: 'utilities',
        description: 'Internet Fibre Pro',
        amountMillimes: 180000,
        periodType: 'monthly',
        startDate: '2026-01-01T00:00:00.000Z',
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);

      const replay = await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload);

      expect(replay.status).toBeGreaterThanOrEqual(200);
      expect(replay.status).toBeLessThan(300);
      expect(replay.body._id).toBe(first.body._id);
    });

    it('returns 422 when idempotency key is reused with different payload', async () => {
      const key = `idem-exp-diff-${Date.now()}`;
      const payload = {
        category: 'marketing',
        description: 'Design software',
        amountMillimes: 100000,
        periodType: 'monthly',
        startDate: '2026-01-01T00:00:00.000Z',
      };

      await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('x-workspace-id', WORKSPACE_A)
        .set('Idempotency-Key', key)
        .send({
          ...payload,
          amountMillimes: 150000, // Different payload
        })
        .expect(422);

      expect(res.body.status).toBe(422);
      expect(res.body.type).toContain('/422');
    });
  });

  describe('Query Validation & $ Guard', () => {
    it('rejects query keys starting with $', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/expenses?$where=1')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);
    });

    it('rejects limit > 100', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/expenses?limit=101')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);
    });
  });

  describe('Tenant Isolation, Updates & Deletion', () => {
    let recordId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          category: 'logistics',
          description: 'Tenant Isolation Test Expense',
          amountMillimes: 250000,
          periodType: 'one-time',
          startDate: '2026-01-10T00:00:00.000Z',
        })
        .expect(201);
      recordId = res.body._id;
    });

    it('workspace B cannot read workspace A expense', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/expenses/${recordId}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(404);
    });

    it('returns 409 on version conflict', async () => {
      // Successful update
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({ amountMillimes: 280000, version: 1 })
        .expect(200);

      // Stale update (version 1 again) -> 409
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({ amountMillimes: 300000, version: 1 })
        .expect(409);

      expect(res.body.title).toBe('Version conflict');
    });

    it('returns 404 on non-existent record patch', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/expenses/507f1f77bcf86cd799439011')
        .set('x-workspace-id', WORKSPACE_A)
        .send({ version: 1 })
        .expect(404);

      expect(res.body.title).toBe('Expense record not found');
    });

    it('workspace B cannot delete workspace A expense', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/expenses/${recordId}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(404);
    });

    it('workspace A can soft delete expense', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/expenses/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/expenses/${recordId}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(404);
    });
  });
});

