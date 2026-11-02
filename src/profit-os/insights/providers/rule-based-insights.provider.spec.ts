import { RuleBasedInsightsProvider } from './rule-based-insights.provider';
import type { FinancialSnapshot } from '../dto/financial-snapshot.dto';

describe('RuleBasedInsightsProvider', () => {
  let provider: RuleBasedInsightsProvider;

  beforeEach(() => {
    provider = new RuleBasedInsightsProvider();
  });

  it('should generate refusal rate insight when courier exceeds threshold', async () => {
    const snapshot: FinancialSnapshot = {
      workspaceId: 'ws_test',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      grossRevenueMillimes: 10000000,
      netRealizedContributionMillimes: 4000000,
      deliveredOrdersCount: 70,
      refusedOrdersCount: 30,
      courierMetrics: [
        {
          courier: 'aramex',
          delivered: 50,
          refused: 25, // 25 / 75 = 33% > 25% threshold
          pendingPayoutsMillimes: 500000,
        },
      ],
      productMetrics: [],
      pendingPayoutsMillimes: 500000,
      oldestPendingPayoutAgeDays: 5,
    };

    const insights = await provider.generateInsights(snapshot);
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe('refusal-rate-aramex');
    expect(insights[0].severity).toBe('warning');
  });

  it('should generate critical insight when product ROAS is below break-even', async () => {
    const snapshot: FinancialSnapshot = {
      workspaceId: 'ws_test',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      grossRevenueMillimes: 10000000,
      netRealizedContributionMillimes: 4000000,
      deliveredOrdersCount: 100,
      refusedOrdersCount: 10,
      courierMetrics: [],
      productMetrics: [
        {
          productId: 'prd_loss',
          productName: 'Unprofitable Lamp',
          actualROAS: 1.1, // 1.1 < 1.8 * 0.9 = 1.62
          breakEvenROAS: 1.8,
        },
      ],
      pendingPayoutsMillimes: 100000,
      oldestPendingPayoutAgeDays: 3,
    };

    const insights = await provider.generateInsights(snapshot);
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe('roas-below-breakeven-prd_loss');
    expect(insights[0].severity).toBe('critical');
  });

  it('should generate insight when pending payouts age exceeds threshold', async () => {
    const snapshot: FinancialSnapshot = {
      workspaceId: 'ws_test',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      grossRevenueMillimes: 10000000,
      netRealizedContributionMillimes: 4000000,
      deliveredOrdersCount: 100,
      refusedOrdersCount: 10,
      courierMetrics: [],
      productMetrics: [],
      pendingPayoutsMillimes: 4500000,
      oldestPendingPayoutAgeDays: 21, // 21 > 14 days threshold
    };

    const insights = await provider.generateInsights(snapshot);
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe('pending-payouts-old');
    expect(insights[0].severity).toBe('warning');
  });
});

