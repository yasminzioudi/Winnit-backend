import { Test, TestingModule } from '@nestjs/testing';
import { FinancialSnapshotBuilder } from './financial-snapshot.builder';
import { AnalyticsService } from '../profit-os/analytics/analytics.service';
import { InsightsService } from '../profit-os/insights/insights.service';

describe('FinancialSnapshotBuilder & Privacy Guard', () => {
  let builder: FinancialSnapshotBuilder;

  const mockSummary = {
    waterfall: {
      grossRevenueMillimes: 125000000,
      productCOGSMillimes: 35000000,
      outboundShippingMillimes: 14000000,
      codRefusalPenaltyMillimes: 4000000,
      paidAdSpendMillimes: 25000000,
      netRealizedContributionMillimes: 47000000,
      netRealizedContributionPercent: 37.6,
      adSpendDeltaMillimes: 0,
      ledgerNetMillimes: 47000000,
    },
    kpis: {
      totalOrdersCount: 600,
      deliveredCount: 460,
      refusedCount: 140,
      shippedCount: 0,
      confirmedCount: 0,
      pendingCount: 0,
      deliveryRatePercent: 76.7,
      refusalRatePercent: 23.3,
      averageOrderValueMillimes: 208333,
    },
    expenses: {
      fixedExpensesMillimes: 15000000,
      netProfitAfterExpensesMillimes: 32000000,
      netProfitMarginPercent: 25.6,
    },
    cod: {
      expectedCollectionsMillimes: 113000000,
      receivedSettlementsMillimes: 85000000,
      pendingDiscrepancyMillimes: 28000000,
      reconciliationRatePercent: 75.2,
    },
  };

  const mockProducts = [
    {
      productId: 'prod_ambre_extrait',
      productName: 'Aura Ambre Extrait',
      totalOrders: 220,
      deliveredOrders: 180,
      refusedOrders: 40,
      deliveryRatePercent: 81.8,
      grossRevenueMillimes: 52000000,
      netContributionMillimes: 22000000,
      adSpendMillimes: 10000000,
      roas: 2.8,
    },
  ];

  const mockCouriers = [
    {
      courier: 'yalidine',
      totalOrders: 350,
      deliveredOrders: 280,
      refusedOrders: 70,
      deliveryRatePercent: 80.0,
      refusalRatePercent: 20.0,
      grossRevenueMillimes: 65000000,
      shippingMillimes: 2100000,
      returnShippingMillimes: 500000,
      pendingPayoutsMillimes: 14000000,
    },
  ];

  const mockGovernorates = [
    {
      governorate: 'tunis',
      totalOrders: 220,
      deliveredOrders: 180,
      refusedOrders: 40,
      deliveryRatePercent: 81.8,
      refusalRatePercent: 18.2,
      grossRevenueMillimes: 48000000,
      netContributionMillimes: 19000000,
    },
  ];

  const mockCOD = {
    summary: {
      expectedCollectionsMillimes: 113000000,
      receivedSettlementsMillimes: 85000000,
      pendingDiscrepancyMillimes: 28000000,
      reconciliationRatePercent: 75.2,
      expectedCashCollectionsMillimes: 113000000,
      bankWireSettledMillimes: 85000000,
      pendingCourierPayoutsMillimes: 28000000,
      totalOrdersCount: 600,
      deliveredOrdersCount: 460,
      totalRevenueMillimes: 125000000,
      settledRevenueMillimes: 85000000,
      pendingSettlementMillimes: 40000000,
    },
    aging: {
      days0to7Millimes: 35000000,
      days8to14Millimes: 15000000,
      days15to30Millimes: 5000000,
      daysOver30Millimes: 2000000,
      days0to7Count: 120,
      days8to14Count: 45,
      days15to30Count: 15,
      daysOver30Count: 5,
    },
    byCourier: [],
  };

  const mockWinners = [
    {
      rank: 1,
      productId: 'prod_ambre_extrait',
      productName: 'Aura Ambre Extrait',
      score: 88,
      label: 'Winner',
      totalOrders: 220,
      deliveredOrders: 180,
      refusedOrders: 40,
      grossRevenueMillimes: 52000000,
      netMarginScore: 90,
      deliveryRateScore: 85,
      roasScore: 88,
      volumeTrendScore: 89,
    },
  ];

  const mockInsights = [
    {
      id: 'ins_1',
      severity: 'warning' as const,
      title: 'Taux de refus élevé (yalidine)',
      evidence: '20% de refus (70/350)',
      suggestedAction: 'Analyser les retours avec le transporteur',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialSnapshotBuilder,
        {
          provide: AnalyticsService,
          useValue: {
            getSummary: jest.fn().mockResolvedValue(mockSummary),
            getByProduct: jest.fn().mockResolvedValue(mockProducts),
            getByCourier: jest.fn().mockResolvedValue(mockCouriers),
            getByGovernorate: jest.fn().mockResolvedValue(mockGovernorates),
            getCOD: jest.fn().mockResolvedValue(mockCOD),
            getWinners: jest.fn().mockResolvedValue(mockWinners),
          },
        },
        {
          provide: InsightsService,
          useValue: {
            getInsights: jest.fn().mockResolvedValue(mockInsights),
          },
        },
      ],
    }).compile();

    builder = module.get<FinancialSnapshotBuilder>(FinancialSnapshotBuilder);
  });

  it('builds aggregated FinancialSnapshot matching all domain sections', async () => {
    const snapshot = await builder.build(
      'ws_maison_ambre',
      '2026-01-01T00:00:00Z',
      '2026-03-31T23:59:59Z',
    );

    expect(snapshot.workspaceId).toBe('ws_maison_ambre');
    expect(snapshot.summary.waterfall.grossRevenueMillimes).toBe(125000000);
    expect(snapshot.summary.kpis.deliveredCount).toBe(460);
    expect(snapshot.byProduct).toHaveLength(1);
    expect(snapshot.byCourier).toHaveLength(1);
    expect(snapshot.byGovernorate).toHaveLength(1);
    expect(snapshot.codAging.daysOver30Count).toBe(5);
    expect(snapshot.winners[0].score).toBe(88);
    expect(snapshot.insights[0].severity).toBe('warning');
  });

  it('PRIVACY AUDIT: serialized snapshot contains ZERO customer fields or order IDs', async () => {
    const snapshot = await builder.build(
      'ws_maison_ambre',
      '2026-01-01T00:00:00Z',
      '2026-03-31T23:59:59Z',
    );

    const serialized = JSON.stringify(snapshot);

    // Customer PII fields strictly forbidden
    const forbiddenPiiTerms = [
      'firstName',
      'lastName',
      'phone',
      'phoneNumber',
      'email',
      'address',
      'street',
      'client',
      'customer',
      'zipCode',
      'postalCode',
    ];

    for (const term of forbiddenPiiTerms) {
      expect(serialized).not.toMatch(new RegExp(`"${term}"`, 'i'));
    }

    // Order IDs or sequence numbers strictly forbidden
    const forbiddenOrderTerms = ['orderId', 'orderNumber', 'ord_', 'trackingNumber'];
    for (const term of forbiddenOrderTerms) {
      expect(serialized).not.toMatch(new RegExp(`"${term}"`, 'i'));
    }
  });
});
