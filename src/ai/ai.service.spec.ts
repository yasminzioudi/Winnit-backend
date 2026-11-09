import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { LLM_PROVIDER } from './interfaces/llm-provider.interface';
import { FakeLlmProvider } from './testing/fake-llm-provider';
import { FinancialSnapshotBuilder } from './financial-snapshot.builder';
import { AiCacheService } from './ai-cache.service';
import type { FinancialSnapshot } from './dto/financial-snapshot.dto';

describe('AiService', () => {
  let aiService: AiService;
  let fakeLlm: FakeLlmProvider;
  let cacheService: AiCacheService;

  const mockSnapshot: FinancialSnapshot = {
    workspaceId: 'ws_maison_ambre',
    period: { from: '2026-01-01', to: '2026-03-31' },
    summary: {
      waterfall: {
        grossRevenueMillimes: 100000,
        productCOGSMillimes: 20000,
        outboundShippingMillimes: 10000,
        codRefusalPenaltyMillimes: 5000,
        paidAdSpendMillimes: 15000,
        netRealizedContributionMillimes: 50000,
        netRealizedContributionPercent: 50.0,
      },
      kpis: {
        totalOrdersCount: 10,
        deliveredCount: 8,
        refusedCount: 2,
        deliveryRatePercent: 80.0,
        refusalRatePercent: 20.0,
        averageOrderValueMillimes: 10000,
      },
      expenses: {
        fixedExpensesMillimes: 10000,
        netProfitAfterExpensesMillimes: 40000,
        netProfitMarginPercent: 40.0,
      },
    },
    byProduct: [],
    byCourier: [],
    byGovernorate: [],
    codAging: {
      expectedCashCollectionsMillimes: 80000,
      bankWireSettledMillimes: 60000,
      pendingCourierPayoutsMillimes: 20000,
      days0to7Count: 5,
      days8to14Count: 2,
      days15to30Count: 1,
      daysOver30Count: 0,
    },
    winners: [],
    insights: [],
  };

  beforeEach(async () => {
    fakeLlm = new FakeLlmProvider();
    cacheService = new AiCacheService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: LLM_PROVIDER,
          useValue: fakeLlm,
        },
        {
          provide: FinancialSnapshotBuilder,
          useValue: {
            build: jest.fn().mockResolvedValue(mockSnapshot),
          },
        },
        {
          provide: AiCacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
  });

  afterEach(() => {
    cacheService.clear();
  });

  it('proves 10/min throttle counts cache hits (11 identical requests within a minute: 11th returns 429)', async () => {
    const prompt = 'Quelle est ma marge nette ?';
    const workspaceId = 'ws_maison_ambre';

    // 1st request: Cache miss -> calls LLM provider
    const res1 = await aiService.generateWithSnapshot(workspaceId, prompt, mockSnapshot);
    expect(res1).toBe(fakeLlm.mockResponse);
    expect(fakeLlm.callCount).toBe(1);

    // Requests 2 through 10: Cache hits -> returns cached response WITHOUT calling LLM again
    for (let i = 2; i <= 10; i++) {
      const res = await aiService.generateWithSnapshot(workspaceId, prompt, mockSnapshot);
      expect(res).toBe(fakeLlm.mockResponse);
    }
    // LLM call count remains 1 because requests 2..10 were served from cache
    expect(fakeLlm.callCount).toBe(1);

    // 11th request: Cache would hit, BUT throttle check runs first and rejects with HTTP 429
    let thrownError: unknown;
    try {
      await aiService.generateWithSnapshot(workspaceId, prompt, mockSnapshot);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError).toBeInstanceOf(HttpException);
    expect((thrownError as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((thrownError as HttpException).message).toContain('10 requêtes par minute');
  });
});

