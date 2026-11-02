import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsService, validateDateRange } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import { CacheService } from '../../common/cache/cache.service';
import { PRODUCT_CATALOG_PORT } from '../../catalog/ports/product-catalog.port';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repo: jest.Mocked<AnalyticsRepository>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const repoMock = {
      findOrdersForPeriod: jest.fn().mockResolvedValue([]),
      findAdSpendsForPeriod: jest.fn().mockResolvedValue([]),
      findExpenses: jest.fn().mockResolvedValue([]),
      findSettlements: jest.fn().mockResolvedValue([]),
      getTimeseriesOrders: jest.fn().mockResolvedValue([]),
      getTimeseriesAdSpends: jest.fn().mockResolvedValue([]),
      getProductAggregation: jest.fn().mockResolvedValue([]),
      getCourierAggregation: jest.fn().mockResolvedValue([]),
      getGovernorateAggregation: jest.fn().mockResolvedValue([]),
      getCODAgingFacet: jest.fn().mockResolvedValue({}),
      explainSummary: jest.fn().mockResolvedValue({}),
    };

    const cacheMock = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      delete: jest.fn(),
      invalidateWorkspace: jest.fn(),
      clear: jest.fn(),
    };

    const catalogMock = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'prd_001',
          name: 'Product 1',
          priceMillimes: 129000,
          cogsMillimes: 28000,
          shippingMillimes: 7000,
          returnShippingMillimes: 7000,
          adCpaMillimes: 22000,
          courier: 'yalidine',
        },
      ]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: AnalyticsRepository, useValue: repoMock },
        { provide: CacheService, useValue: cacheMock },
        { provide: PRODUCT_CATALOG_PORT, useValue: catalogMock },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    repo = module.get(AnalyticsRepository);
    cacheService = module.get(CacheService);
  });

  describe('validateDateRange', () => {
    it('should parse valid dates', () => {
      const res = validateDateRange('2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z');
      expect(res.from).toBeInstanceOf(Date);
      expect(res.to).toBeInstanceOf(Date);
      expect(res.from.getTime()).toBeLessThan(res.to.getTime());
    });

    it('should throw BadRequestException if from > to', () => {
      expect(() =>
        validateDateRange('2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid date string', () => {
      expect(() => validateDateRange('invalid', '2026-01-01T00:00:00Z')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getSummary', () => {
    it('should return cached summary if present', async () => {
      const cached = { period: { from: 'a', to: 'b' } } as any;
      cacheService.get.mockReturnValueOnce(cached);

      const res = await service.getSummary('ws_test', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z');
      expect(res).toBe(cached);
      expect(repo.findOrdersForPeriod).not.toHaveBeenCalled();
    });

    it('should compute waterfall, kpis, expenses, and cod if not cached', async () => {
      repo.findOrdersForPeriod.mockResolvedValueOnce([
        {
          _id: 'ord1',
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          quantity: 1,
          shippingMillimes: 7000,
          returnShippingMillimes: 0,
          courierFeeMillimes: 0,
          adCpaMillimes: 22000,
          status: 'delivered',
          courier: 'yalidine',
        } as any,
        {
          _id: 'ord2',
          unitPriceMillimes: 129000,
          unitCogsMillimes: 28000,
          quantity: 1,
          shippingMillimes: 7000,
          returnShippingMillimes: 7000,
          courierFeeMillimes: 0,
          adCpaMillimes: 22000,
          status: 'refused',
          courier: 'yalidine',
        } as any,
      ]);

      repo.findAdSpendsForPeriod.mockResolvedValueOnce([
        { spendMillimes: 50000, productId: 'prd_001' } as any,
      ]);

      repo.findExpenses.mockResolvedValueOnce([
        {
          amountMillimes: 1500000,
          periodType: 'monthly',
          startDate: new Date('2025-01-01T00:00:00Z'),
        } as any,
      ]);

      const res = await service.getSummary('ws_test', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z');

      expect(res.waterfall.grossRevenueMillimes).toBe(129000);
      expect(res.waterfall.productCOGSMillimes).toBe(28000);
      expect(res.waterfall.paidAdSpendMillimes).toBe(50000);
      expect(res.waterfall.codRefusalPenaltyMillimes).toBe(14000); // 7000 + 7000
      expect(res.kpis.totalOrdersCount).toBe(2);
      expect(res.kpis.deliveredCount).toBe(1);
      expect(res.kpis.refusedCount).toBe(1);
      expect(res.kpis.deliveryRatePercent).toBe(50);
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('getTimeseries', () => {
    it('should merge order and ad spend buckets', async () => {
      repo.getTimeseriesOrders.mockResolvedValueOnce([
        {
          _id: '2026-01-01',
          ordersCount: 5,
          deliveredCount: 4,
          refusedCount: 1,
          grossRevenueMillimes: 500000,
          netContributionMillimes: 250000,
        },
      ]);
      repo.getTimeseriesAdSpends.mockResolvedValueOnce([
        { _id: '2026-01-01', adSpendMillimes: 100000 },
      ]);

      const res = await service.getTimeseries('ws_test', '2026-01-01T00:00:00Z', '2026-01-05T23:59:59Z');

      expect(res.buckets).toHaveLength(1);
      expect(res.buckets[0].period).toBe('2026-01-01');
      expect(res.buckets[0].adSpendMillimes).toBe(100000);
      expect(res.buckets[0].ordersCount).toBe(5);
    });
  });

  describe('getWinners', () => {
    it('should rank products and return winner scores', async () => {
      repo.getProductAggregation.mockResolvedValueOnce([
        {
          _id: 'prd_001',
          productName: "Aura d'Ambre",
          totalOrders: 35,
          deliveredOrders: 30,
          refusedOrders: 5,
          grossRevenueMillimes: 3870000,
          netContributionMillimes: 1800000,
        },
      ]);

      const res = await service.getWinners('ws_test', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z');

      expect(res).toHaveLength(1);
      expect(res[0].productId).toBe('prd_001');
      expect(res[0].score).toBeGreaterThan(0);
      expect(['Winner', 'À surveiller', 'À couper']).toContain(res[0].label);
    });
  });
});

