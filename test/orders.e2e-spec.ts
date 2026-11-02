import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import * as mongoose from 'mongoose';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/utils/configure-app';
import { ensureIndexes } from '../src/database/ensure-indexes';

describe('Orders API (e2e)', () => {
  let app: INestApplication;
  let mongoClient: MongoClient;
  let mongooseConnection: mongoose.Connection;
  const WORKSPACE_A = 'ws_maison_ambre'; // Use workspace that has products
  const WORKSPACE_B = 'ws_test_b';

  beforeAll(async () => {
    // Connect to MongoDB
    mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/winnit_test');
    await mongoClient.connect();

    // Create mongoose connection for index creation
    mongooseConnection = mongoose.createConnection(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/winnit_test',
    );
    await mongooseConnection.asPromise();

    // Ensure indexes before tests run
    await ensureIndexes(mongooseConnection);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    // Clean test data
    const db = mongoClient.db();
    await db.collection('orders').deleteMany({ workspaceId: { $in: [WORKSPACE_A, WORKSPACE_B] } });
    await db.collection('counters').deleteMany({ workspaceId: { $in: [WORKSPACE_A, WORKSPACE_B] } });
    
    await mongooseConnection.close();
    await mongoClient.close();
    await app.close();
  });

  describe('Concurrent idempotency', () => {
    it('two concurrent POST with same Idempotency-Key both succeed and return same order', async () => {
      const idempotencyKey = `concurrent-test-${Date.now()}`;
      const payload = {
        productId: 'prd_001',
        quantity: 1,
        unitPriceMillimes: 129000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        adCpaMillimes: 22000,
        courier: 'aramex',
        customer: { firstName: 'Concurrent', city: 'Tunis', governorate: 'Tunis' },
      };

      // Fire two concurrent requests with same idempotency key
      const [response1, response2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('x-workspace-id', WORKSPACE_A)
          .set('Idempotency-Key', idempotencyKey)
          .send(payload),
        request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('x-workspace-id', WORKSPACE_A)
          .set('Idempotency-Key', idempotencyKey)
          .send(payload),
      ]);

      // Both should succeed
      expect(response1.status).toBeGreaterThanOrEqual(200);
      expect(response1.status).toBeLessThan(300);
      expect(response2.status).toBeGreaterThanOrEqual(200);
      expect(response2.status).toBeLessThan(300);

      // Both should return the same order number and ID
      expect(response1.body.orderNumber).toBe(response2.body.orderNumber);
      expect(response1.body._id).toBe(response2.body._id);
    });
  });

  describe('Query validation', () => {
    it('rejects query keys starting with "$"', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?$where=1')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.type).toContain('400');
    });

    it('rejects nested query keys containing "$"', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?status[$ne]=x')
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.type).toContain('400');
    });

    it('rejects limit > 100', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .query({ limit: 101 })
        .set('x-workspace-id', WORKSPACE_A)
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('accepts limit = 100', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders')
        .query({ limit: 100 })
        .set('x-workspace-id', WORKSPACE_A)
        .expect(200);
    });
  });

  describe('POST /api/v1/orders', () => {
    it('creates order and returns 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          productId: 'prd_001',
          quantity: 1,
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          shippingMillimes: 7000,
          adCpaMillimes: 22000,
          courier: 'Aramex',
          customer: {
            firstName: 'Ahmed',
            city: 'Tunis',
            governorate: 'Tunis',
          },
        })
        .expect(201);

      expect(response.body.orderNumber).toMatch(/^ORD-\d+$/);
      expect(response.body.workspaceId).toBe(WORKSPACE_A);
      expect(response.body.status).toBe('pending');
      expect(response.body.netContributionMillimes).toBeDefined();
      expect(response.body.version).toBe(1);
    });

    it('replays idempotent request with same status code', async () => {
      const idempotencyKey = 'test-idempotency-key-001';
      
      // First request
      const first = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .set('idempotency-key', idempotencyKey)
        .send({
          productId: 'prd_002',
          quantity: 1,
          unitPriceMillimes: 89000,
          unitCogsMillimes: 22000,
          shippingMillimes: 6000,
          adCpaMillimes: 18000,
          courier: 'CTM',
          customer: {
            firstName: 'Leila',
            city: 'Sousse',
            governorate: 'Sousse',
          },
        })
        .expect(201);

      // Replay - should return same order
      const replay = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .set('idempotency-key', idempotencyKey)
        .send({
          productId: 'prd_003', // Different data
          quantity: 2,
          unitPriceMillimes: 65000,
          unitCogsMillimes: 18000,
          shippingMillimes: 5000,
          adCpaMillimes: 15000,
          courier: 'DHL',
          customer: {
            firstName: 'Mohamed',
            city: 'Sfax',
            governorate: 'Sfax',
          },
        })
        .expect(201);

      expect(replay.body._id).toBe(first.body._id);
      expect(replay.body.orderNumber).toBe(first.body.orderNumber);
      expect(replay.body.productId).toBe('prd_002'); // Original data preserved
    });
  });

  describe('PATCH /api/v1/orders/:id/status', () => {
    let orderId: string;
    let orderVersion: number;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          productId: 'prd_001',
          quantity: 1,
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          shippingMillimes: 7000,
          adCpaMillimes: 22000,
          courier: 'Aramex',
          customer: {
            firstName: 'Fatma',
            city: 'Ariana',
            governorate: 'Ariana',
          },
        });

      orderId = response.body._id;
      orderVersion = response.body.version;
    });

    it('changes status to confirmed', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          status: 'confirmed',
          version: orderVersion,
        })
        .expect(200);

      expect(response.body.status).toBe('confirmed');
      expect(response.body.version).toBe(orderVersion + 1);
      expect(response.body.statusHistory).toHaveLength(2);
      orderVersion = response.body.version;
    });

    it('returns 422 on illegal transition', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          status: 'pending', // confirmed → pending is illegal
          version: orderVersion,
        })
        .expect(422);

      expect(response.body.type).toContain('/422');
      expect(response.body.status).toBe(422);
    });

    it('changes status to shipped then delivered', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          status: 'shipped',
          version: orderVersion,
        })
        .expect(200);

      orderVersion++;

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          status: 'delivered',
          version: orderVersion,
        })
        .expect(200);

      expect(response.body.status).toBe('delivered');
      expect(response.body.deliveredAt).toBeDefined();
    });
  });

  describe('POST /api/v1/orders/:id/reopen', () => {
    let refusedOrderId: string;

    beforeAll(async () => {
      // Create and refuse an order
      const created = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          productId: 'prd_003',
          quantity: 1,
          unitPriceMillimes: 65000,
          unitCogsMillimes: 18000,
          shippingMillimes: 5000,
          adCpaMillimes: 15000,
          courier: 'DHL',
          customer: {
            firstName: 'Youssef',
            city: 'Nabeul',
            governorate: 'Nabeul',
          },
        });

      refusedOrderId = created.body._id;

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${refusedOrderId}/status`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          status: 'confirmed',
          version: created.body.version,
        });

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${refusedOrderId}/status`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          status: 'shipped',
          version: created.body.version + 1,
        });

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${refusedOrderId}/status`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          status: 'refused',
          version: created.body.version + 2,
        });
    });

    it('reopens refused order to delivered', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${refusedOrderId}/reopen`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({ changedBy: 'admin_user' })
        .expect(200);

      expect(response.body.status).toBe('delivered');
      expect(response.body.deliveredAt).toBeDefined();
      expect(response.body.statusHistory[response.body.statusHistory.length - 1].action).toBe('reopen');
    });
  });

  describe('DELETE /api/v1/orders/:id', () => {
    it('soft deletes order', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          productId: 'prd_004',
          quantity: 1,
          unitPriceMillimes: 35000,
          unitCogsMillimes: 8000,
          shippingMillimes: 4000,
          adCpaMillimes: 10000,
          courier: 'Aramex',
          customer: {
            firstName: 'Amira',
            city: 'Tunis',
            governorate: 'Tunis',
          },
        });

      await request(app.getHttpServer())
        .delete(`/api/v1/orders/${created.body._id}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(204);

      // Verify it's soft deleted (not returned in GET)
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${created.body._id}`)
        .set('x-workspace-id', WORKSPACE_A)
        .expect(404);
    });
  });

  describe('GET /api/v1/orders with pagination and filters', () => {
    beforeAll(async () => {
      // Create multiple orders for pagination test
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('x-workspace-id', WORKSPACE_A)
          .send({
            productId: 'prd_001',
            quantity: 1,
            unitPriceMillimes: 129000,
            unitCogsMillimes: 28000,
            shippingMillimes: 7000,
            adCpaMillimes: 22000,
            courier: i % 2 === 0 ? 'Aramex' : 'CTM',
            customer: {
              firstName: `User${i}`,
              city: 'Tunis',
              governorate: 'Tunis',
            },
          });
      }
    });

    it('returns first page with cursor', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .query({ limit: 3 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.nextCursor).toBeDefined();
    });

    it('returns second page using cursor', async () => {
      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .query({ limit: 3 });

      const secondPage = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .query({ limit: 3, cursor: firstPage.body.meta.nextCursor })
        .expect(200);

      expect(secondPage.body.data).toBeDefined();
      // Verify no overlap
      const firstIds = firstPage.body.data.map((o: any) => o._id);
      const secondIds = secondPage.body.data.map((o: any) => o._id);
      const overlap = firstIds.filter((id: string) => secondIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('filters by courier', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .query({ courier: 'Aramex', limit: 20 })
        .expect(200);

      response.body.data.forEach((order: any) => {
        expect(order.courier).toBe('Aramex');
      });
    });

    it('filters by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .query({ status: 'pending', limit: 20 })
        .expect(200);

      response.body.data.forEach((order: any) => {
        expect(order.status).toBe('pending');
      });
    });

    it('searches by order number', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .query({ search: 'ORD-1', limit: 20 })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((order: any) => {
        expect(order.orderNumber).toContain('ORD-');
      });
    });
  });

  describe('Tenant isolation', () => {
    let workspaceAOrderId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          productId: 'prd_001',
          quantity: 1,
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          shippingMillimes: 7000,
          adCpaMillimes: 22000,
          courier: 'Aramex',
          customer: {
            firstName: 'Tenant A User',
            city: 'Tunis',
            governorate: 'Tunis',
          },
        });

      workspaceAOrderId = response.body._id;
    });

    it('workspace B cannot read workspace A order', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${workspaceAOrderId}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(404);
    });

    it('workspace B cannot update workspace A order', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${workspaceAOrderId}/status`)
        .set('x-workspace-id', WORKSPACE_B)
        .send({
          status: 'confirmed',
          version: 1,
        })
        .expect(404);
    });

    it('workspace B cannot delete workspace A order', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/orders/${workspaceAOrderId}`)
        .set('x-workspace-id', WORKSPACE_B)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/orders/:id returns 409 on version conflict', () => {
    it('returns 409 when version is stale', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          productId: 'prd_001',
          quantity: 1,
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          shippingMillimes: 7000,
          adCpaMillimes: 22000,
          courier: 'Aramex',
          customer: {
            firstName: 'Version Test',
            city: 'Tunis',
            governorate: 'Tunis',
          },
        });

      // Update with correct version
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${created.body._id}`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          unitPriceMillimes: 130000,
          version: created.body.version,
        })
        .expect(200);

      // Try to update with stale version
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${created.body._id}`)
        .set('x-workspace-id', WORKSPACE_A)
        .send({
          unitPriceMillimes: 140000,
          version: created.body.version, // Stale
        })
        .expect(409);

      expect(response.body.type).toContain('/409');
      expect(response.body.status).toBe(409);
    });
  });
});
