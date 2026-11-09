import { buildCompactSnapshot } from './compact-snapshot';
import type { FinancialSnapshot } from './dto/financial-snapshot.dto';

describe('CompactSnapshot Builder & Character Budget', () => {
  const mockFullSnapshot: FinancialSnapshot = {
    workspaceId: 'ws_maison_ambre',
    period: { from: '2026-01-01', to: '2026-03-31' },
    summary: {
      waterfall: {
        grossRevenueMillimes: 125000000.42,
        productCOGSMillimes: 35000000.12,
        outboundShippingMillimes: 14000000.55,
        codRefusalPenaltyMillimes: 4000000.89,
        paidAdSpendMillimes: 25000000.0,
        netRealizedContributionMillimes: 47000000.33,
        netRealizedContributionPercent: 37.600001,
      },
      kpis: {
        totalOrdersCount: 600,
        deliveredCount: 460,
        refusedCount: 140,
        deliveryRatePercent: 76.666667,
        refusalRatePercent: 23.333333,
        averageOrderValueMillimes: 208333.333333,
      },
      expenses: {
        fixedExpensesMillimes: 15000000,
        netProfitAfterExpensesMillimes: 32000000,
        netProfitMarginPercent: 25.600001,
      },
    },
    byProduct: [
      {
        productId: 'prod_1',
        productName: 'Aura Ambre Extrait',
        totalOrders: 220,
        deliveredOrders: 180,
        refusedOrders: 40,
        grossRevenueMillimes: 52000000,
        netContributionMillimes: 22000000,
        roas: 2.8,
      },
      {
        productId: 'prod_2',
        productName: 'Rose Mystique',
        totalOrders: 150,
        deliveredOrders: 120,
        refusedOrders: 30,
        grossRevenueMillimes: 35000000,
        netContributionMillimes: 14000000,
        roas: 2.4,
      },
      {
        productId: 'prod_3',
        productName: 'Oud Royal',
        totalOrders: 100,
        deliveredOrders: 80,
        refusedOrders: 20,
        grossRevenueMillimes: 24000000,
        netContributionMillimes: 8000000,
        roas: 1.9,
      },
      {
        productId: 'prod_4',
        productName: 'Fleur d Oranger',
        totalOrders: 80,
        deliveredOrders: 50,
        refusedOrders: 30,
        grossRevenueMillimes: 12000000,
        netContributionMillimes: 2000000,
        roas: 1.2,
      },
      {
        productId: 'prod_5',
        productName: 'Musk Blanc',
        totalOrders: 50,
        deliveredOrders: 30,
        refusedOrders: 20,
        grossRevenueMillimes: 6000000,
        netContributionMillimes: 1000000,
        roas: 1.0,
      },
    ],
    byCourier: [
      {
        courier: 'yalidine',
        totalOrders: 350,
        deliveredOrders: 280,
        refusedOrders: 70,
        grossRevenueMillimes: 65000000,
        pendingPayoutsMillimes: 15000000,
      },
      {
        courier: 'aramex',
        totalOrders: 250,
        deliveredOrders: 180,
        refusedOrders: 70,
        grossRevenueMillimes: 60000000,
        pendingPayoutsMillimes: 13000000,
      },
    ],
    byGovernorate: [
      {
        governorate: 'Tunis',
        totalOrders: 200,
        deliveredOrders: 170,
        refusedOrders: 30,
        grossRevenueMillimes: 45000000,
      },
      {
        governorate: 'Sfax',
        totalOrders: 150,
        deliveredOrders: 110,
        refusedOrders: 40,
        grossRevenueMillimes: 32000000,
      },
      {
        governorate: 'Gafsa',
        totalOrders: 50,
        deliveredOrders: 25,
        refusedOrders: 25,
        grossRevenueMillimes: 10000000,
      },
      {
        governorate: 'Medenine',
        totalOrders: 40,
        deliveredOrders: 15,
        refusedOrders: 25,
        grossRevenueMillimes: 8000000,
      },
    ],
    codAging: {
      expectedCashCollectionsMillimes: 113000000,
      bankWireSettledMillimes: 85000000,
      pendingCourierPayoutsMillimes: 28000000,
      days0to7Count: 12,
      days8to14Count: 8,
      days15to30Count: 3,
      daysOver30Count: 1,
    },
    winners: [
      {
        rank: 1,
        productId: 'prod_1',
        productName: 'Aura Ambre Extrait',
        score: 88,
        label: 'Winner',
      },
    ],
    insights: [
      {
        id: 'ins_1',
        severity: 'warning',
        title: 'Taux de refus élevé à Gafsa',
        evidence: '50% des commandes refusées',
        suggestedAction: 'Basculer vers Yalidine',
      },
    ],
  };

  it('ASSERT: compact snapshot size is strictly under character budget of 1800 chars', () => {
    const compact = buildCompactSnapshot(mockFullSnapshot);
    const serialized = JSON.stringify(compact);

    expect(serialized.length).toBeLessThanOrEqual(1800);
  });

  it('rounds numbers and preserves key summary, couriers, and worst governorates', () => {
    const compact = buildCompactSnapshot(mockFullSnapshot);

    expect(compact.summary.grossRevenueMillimes).toBe(125000000);
    expect(compact.summary.deliveryRatePercent).toBe(76.7);
    expect(compact.summary.refusalRatePercent).toBe(23.3);

    // Top products limited to 3
    expect(compact.topProducts.length).toBeLessThanOrEqual(3);
    expect(compact.topProducts[0].name).toBe('Aura Ambre Extrait');

    // Worst governorates by refusal rate
    expect(compact.worstGovernorates.length).toBeLessThanOrEqual(3);
    expect(compact.worstGovernorates[0].governorate).toBe('Medenine'); // 25/40 = 62.5% refusal
  });
});
