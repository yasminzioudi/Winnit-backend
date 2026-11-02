import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/utils/configure-app';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    configureApp(app);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('/api/v1/health/live (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });

    it('/api/v1/health/ready (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.mongo).toBe('connected');
        });
    });
  });

  describe('Catalog', () => {
    it('/api/v1/products (GET) with workspace header returns products', () => {
      return request(app.getHttpServer())
        .get('/api/v1/products')
        .set('x-workspace-id', 'ws_maison_ambre')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBe(12);
          expect(res.body.data[0].id).toBe('prd_001');
        });
    });

    it('/api/v1/products/:id (GET) with workspace header returns product', () => {
      return request(app.getHttpServer())
        .get('/api/v1/products/prd_001')
        .set('x-workspace-id', 'ws_maison_ambre')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe('prd_001');
          expect(res.body.name).toBe("Aura d'Ambre Extrait (50ml)");
        });
    });

    it('/api/v1/products/:id (GET) with nonexistent id returns 404 problem+json', () => {
      return request(app.getHttpServer())
        .get('/api/v1/products/nonexistent')
        .set('x-workspace-id', 'ws_maison_ambre')
        .expect(404)
        .expect('content-type', /application\/problem\+json/)
        .expect((res) => {
          expect(res.body.type).toContain('/404');
          expect(res.body.status).toBe(404);
          expect(res.body.requestId).toBeDefined();
          expect(res.body.instance).toBe('/api/v1/products/nonexistent');
        });
    });
  });

  describe('Tenant Guard', () => {
    it('/api/v1/products (GET) without workspace header returns 401 problem+json with requestId', () => {
      return request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(401)
        .expect('content-type', /application\/problem\+json/)
        .expect((res) => {
          expect(res.body.type).toContain('/401');
          expect(res.body.status).toBe(401);
          expect(res.body.detail).toContain('x-workspace-id');
          expect(res.body.requestId).toBeDefined();
          expect(res.body.requestId).not.toBe('unknown');
        });
    });

    it('x-request-id header is returned on all responses', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.headers['x-request-id']).toBeDefined();
          expect(res.headers['x-request-id']).toMatch(/^req_[a-f0-9]{24}$/);
        });
    });
  });
});
