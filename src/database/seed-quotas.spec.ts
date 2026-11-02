import { generateSeedDataset } from './seed-generator';
import { calculateWinnerScore } from '../profit-os/domain/winners';
import { calculateWaterfall, calculateOrderNetContribution } from '../profit-os/domain/finance';
import { expenseTotalForPeriod, type ExpenseDomain } from '../profit-os/domain/expenses';
import {
  checkRefusalRate,
  checkROASBelowBreakEven,
  checkPendingPayoutsAge,
} from '../profit-os/domain/insights';

describe('Seed Dataset Quality Quotas', () => {
  const referenceDate = new Date('2026-11-02T12:00:00Z');
  const dataset = generateSeedDataset(referenceDate);
  
  const thirtyDaysAgo = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(referenceDate.getTime() - 60 * 24 * 60 * 60 * 1000);

  it('achieves winners label quotas: >=2 Winner, >=2 À surveiller, >=2 À couper, >=2 Données insuffisantes', () => {
    const last30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= referenceDate,
    );
    const previous30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= sixtyDaysAgo && o.placedAt < thirtyDaysAgo,
    );

    const productIds = Array.from(new Set(dataset.orders.map((o) => o.productId)));
    const scores = productIds.map((productId) => {
      const currentOrders = last30DaysOrders.filter((o) => o.productId === productId);
      const previousOrders = previous30DaysOrders.filter((o) => o.productId === productId);
      
      const delivered = currentOrders.filter((o) => o.status === 'delivered').length;
      const refused = currentOrders.filter((o) => o.status === 'refused').length;
      
      const revenue = currentOrders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + o.unitPriceMillimes * o.quantity, 0);
      const netContribution = currentOrders.reduce(
        (sum, o) => sum + calculateOrderNetContribution(o),
        0,
      );
      const netMarginPercent = revenue > 0 ? (netContribution / revenue) * 100 : 0;
      
      const adSpend = currentOrders.reduce((sum, o) => sum + o.adCpaMillimes, 0);
      const actualROAS = adSpend > 0 ? revenue / adSpend : 0;
      
      const cogs = currentOrders.reduce((sum, o) => sum + o.unitCogsMillimes * o.quantity, 0);
      const shipping = currentOrders.reduce((sum, o) => sum + o.shippingMillimes, 0);
      const maxTolerableCPA = revenue - cogs - shipping;
      const breakEvenROAS = maxTolerableCPA > 0 ? revenue / maxTolerableCPA : 0;
      
      const volumeTrend =
        previousOrders.length > 0
          ? (currentOrders.length - previousOrders.length) / previousOrders.length
          : 0;

      return calculateWinnerScore({
        productId,
        totalOrders: currentOrders.length,
        deliveredOrders: delivered,
        refusedOrders: refused,
        netMarginPercent,
        breakEvenROAS,
        actualROAS,
        volumeTrend30Days: volumeTrend,
      });
    });

    const winnerCount = scores.filter((s) => s.label === 'Winner').length;
    const surveillerCount = scores.filter((s) => s.label === 'À surveiller').length;
    const couperCount = scores.filter((s) => s.label === 'À couper').length;
    const insuffisantesCount = scores.filter((s) => s.label === 'Données insuffisantes').length;

    expect(winnerCount).toBeGreaterThanOrEqual(2);
    expect(surveillerCount).toBeGreaterThanOrEqual(2);
    expect(couperCount).toBeGreaterThanOrEqual(2);
    expect(insuffisantesCount).toBeGreaterThanOrEqual(2);
  });

  it('generates 3-5 insights with at most 2 per rule type', () => {
    const last30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= referenceDate,
    );
    const last30DaysAdSpend = dataset.adSpends.filter(
      (s) => s.periodStart >= thirtyDaysAgo && s.periodStart <= referenceDate,
    );

    calculateWaterfall(
      last30DaysOrders as any,
      last30DaysAdSpend.reduce((sum, s) => sum + s.spendMillimes, 0),
    );

    // Generate insights using domain functions
    const insights = [];
    
    // Check refusal rates per courier
    const couriers = ['aramex', 'yalidine'];
    for (const courier of couriers) {
      const courierOrders = last30DaysOrders.filter((o) => o.courier === courier);
      const delivered = courierOrders.filter((o) => o.status === 'delivered').length;
      const refused = courierOrders.filter((o) => o.status === 'refused').length;
      const insight = checkRefusalRate(delivered, refused, courier, 0.25);
      if (insight) insights.push(insight);
    }
    
    // Check ROAS per product
    const productIds = Array.from(new Set(last30DaysOrders.map((o) => o.productId)));
    for (const productId of productIds) {
      const productOrders = last30DaysOrders.filter((o) => o.productId === productId);
      const revenue = productOrders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + o.unitPriceMillimes * o.quantity, 0);
      const adSpend = productOrders.reduce((sum, o) => sum + o.adCpaMillimes, 0);
      const actualROAS = adSpend > 0 ? revenue / adSpend : 0;
      
      const cogs = productOrders.reduce((sum, o) => sum + o.unitCogsMillimes * o.quantity, 0);
      const shipping = productOrders.reduce((sum, o) => sum + o.shippingMillimes, 0);
      const maxTolerableCPA = revenue - cogs - shipping;
      const breakEvenROAS = maxTolerableCPA > 0 ? revenue / maxTolerableCPA : 0;
      
      const insight = checkROASBelowBreakEven(
        productId,
        productId,
        actualROAS,
        breakEvenROAS,
        0.9,
      );
      if (insight) insights.push(insight);
    }
    
    // Check pending payouts (use settlements)
    const pendingSettlements = dataset.settlements.filter((s) => s.status === 'pending');
    for (const settlement of pendingSettlements) {
      const daysPending = Math.floor(
        (referenceDate.getTime() - settlement.settlementDate.getTime()) / (24 * 60 * 60 * 1000),
      );
      const insight = checkPendingPayoutsAge(settlement.totalAmountMillimes, daysPending, 14);
      if (insight) insights.push(insight);
    }

    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights.length).toBeLessThanOrEqual(5);

    // Check at most 2 per rule type (group by title prefix)
    const typeCounts = new Map<string, number>();
    for (const insight of insights) {
      const type = insight.title.split('(')[0].trim();
      const count = typeCounts.get(type) || 0;
      typeCounts.set(type, count + 1);
    }
    for (const count of typeCounts.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('achieves ad spend 25-30% of gross revenue', () => {
    const last30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= referenceDate,
    );
    const last30DaysAdSpend = dataset.adSpends.filter(
      (s) => s.periodStart >= thirtyDaysAgo && s.periodStart <= referenceDate,
    );

    const waterfall = calculateWaterfall(
      last30DaysOrders as any,
      last30DaysAdSpend.reduce((sum, s) => sum + s.spendMillimes, 0),
    );

    const adSpendPercent = (waterfall.paidAdSpendMillimes / waterfall.grossRevenueMillimes) * 100;

    expect(adSpendPercent).toBeGreaterThanOrEqual(25);
    expect(adSpendPercent).toBeLessThanOrEqual(30);
  });

  it('achieves net realized contribution 15-35% of gross revenue', () => {
    const last30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= referenceDate,
    );
    const last30DaysAdSpend = dataset.adSpends.filter(
      (s) => s.periodStart >= thirtyDaysAgo && s.periodStart <= referenceDate,
    );

    const waterfall = calculateWaterfall(
      last30DaysOrders as any,
      last30DaysAdSpend.reduce((sum, s) => sum + s.spendMillimes, 0),
    );

    const netPercent =
      (waterfall.netRealizedContributionMillimes / waterfall.grossRevenueMillimes) * 100;

    expect(netPercent).toBeGreaterThanOrEqual(15);
    expect(netPercent).toBeLessThanOrEqual(35);
  });

  it('achieves fixed expenses 8-15% of gross revenue', () => {
    const last30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= referenceDate,
    );
    const last30DaysAdSpend = dataset.adSpends.filter(
      (s) => s.periodStart >= thirtyDaysAgo && s.periodStart <= referenceDate,
    );

    const waterfall = calculateWaterfall(
      last30DaysOrders as any,
      last30DaysAdSpend.reduce((sum, s) => sum + s.spendMillimes, 0),
    );

    const domainExpenses: ExpenseDomain[] = dataset.expenses.map((e) => ({
      amountMillimes: e.amountMillimes,
      periodType: e.periodType as 'monthly' | 'one-time',
      startDate: e.startDate,
      endDate: e.endDate,
    }));
    const fixedExpenses = expenseTotalForPeriod(domainExpenses, thirtyDaysAgo, referenceDate);

    const fixedExpensesPercent = (fixedExpenses / waterfall.grossRevenueMillimes) * 100;

    expect(fixedExpensesPercent).toBeGreaterThanOrEqual(8);
    expect(fixedExpensesPercent).toBeLessThanOrEqual(15);
  });

  it('achieves positive result after fixed expenses', () => {
    const last30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= referenceDate,
    );
    const last30DaysAdSpend = dataset.adSpends.filter(
      (s) => s.periodStart >= thirtyDaysAgo && s.periodStart <= referenceDate,
    );

    const waterfall = calculateWaterfall(
      last30DaysOrders as any,
      last30DaysAdSpend.reduce((sum, s) => sum + s.spendMillimes, 0),
    );

    const domainExpenses: ExpenseDomain[] = dataset.expenses.map((e) => ({
      amountMillimes: e.amountMillimes,
      periodType: e.periodType as 'monthly' | 'one-time',
      startDate: e.startDate,
      endDate: e.endDate,
    }));
    const fixedExpenses = expenseTotalForPeriod(domainExpenses, thirtyDaysAgo, referenceDate);

    const resultAfterExpenses = waterfall.netRealizedContributionMillimes - fixedExpenses;

    expect(resultAfterExpenses).toBeGreaterThan(0);
  });

  it('achieves 90-day refusal rate 22-23.5%', () => {
    const resolvedOrders = dataset.orders.filter(
      (o) => o.status === 'delivered' || o.status === 'refused',
    );
    const refusedCount = dataset.orders.filter((o) => o.status === 'refused').length;
    const refusalRate = (refusedCount / resolvedOrders.length) * 100;

    expect(refusalRate).toBeGreaterThanOrEqual(22);
    expect(refusalRate).toBeLessThanOrEqual(23.5);
  });
});
