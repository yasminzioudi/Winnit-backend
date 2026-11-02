import {
  generateSeedDataset,
  WORKSPACE_ID,
} from '../../database/seed-generator';
import {
  calculateWaterfall,
  calculateLedgerNet,
  calculateAdSpendDelta,
} from '../domain/finance';

describe('600-Order Seed Identity & Finance Verification', () => {
  const fixedReferenceDate = new Date('2026-02-01T12:00:00Z');
  const dataset = generateSeedDataset(fixedReferenceDate);

  it('generates exactly 600 orders limited to ws_maison_ambre', () => {
    expect(dataset.orders.length).toBe(600);
    const nonWorkspaceOrders = dataset.orders.filter(
      (o) => o.workspaceId !== WORKSPACE_ID,
    );
    expect(nonWorkspaceOrders.length).toBe(0);
  });

  it('lands refusal rate between 18% and 24%', () => {
    const resolvedOrders = dataset.orders.filter(
      (o) => o.status === 'delivered' || o.status === 'refused',
    );
    const refusedCount = dataset.orders.filter((o) => o.status === 'refused').length;
    const refusalRate = (refusedCount / resolvedOrders.length) * 100;

    expect(refusalRate).toBeGreaterThanOrEqual(18.0);
    expect(refusalRate).toBeLessThanOrEqual(24.0);
  });

  it('contains both Aramex and Yalidine couriers across all 8 governorates', () => {
    const couriers = new Set(dataset.orders.map((o) => o.courier));
    expect(couriers.has('aramex')).toBe(true);
    expect(couriers.has('yalidine')).toBe(true);

    const govs = new Set(dataset.orders.map((o) => o.customer.governorate));
    expect(govs.size).toBe(8);
    expect(govs.has('Tunis')).toBe(true);
    expect(govs.has('Ariana')).toBe(true);
    expect(govs.has('Sousse')).toBe(true);
    expect(govs.has('Sfax')).toBe(true);
    expect(govs.has('Bizerte')).toBe(true);
    expect(govs.has('Nabeul')).toBe(true);
    expect(govs.has('Monastir')).toBe(true);
    expect(govs.has('Gabès')).toBe(true);
  });

  it('satisfies 30-day waterfall net contribution identity', () => {
    const thirtyDaysAgo = new Date(
      fixedReferenceDate.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const last30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= fixedReferenceDate,
    );

    // Sum ad spend for the same 30-day window
    const last30DaysAdSpend = dataset.adSpends.filter(
      (s) => s.periodStart >= thirtyDaysAgo && s.periodStart <= fixedReferenceDate,
    );
    const total30DayAdSpendMillimes = last30DaysAdSpend.reduce(
      (sum, s) => sum + s.spendMillimes,
      0,
    );

    const waterfall = calculateWaterfall(
      last30DaysOrders as any,
      total30DayAdSpendMillimes,
    );

    // Fundamental identity:
    // netRealizedContribution === grossRevenue - cogs - outboundShipping - paidAdSpend - codRefusalPenalty
    const expectedNet =
      waterfall.grossRevenueMillimes -
      waterfall.productCOGSMillimes -
      waterfall.outboundShippingMillimes -
      waterfall.paidAdSpendMillimes -
      waterfall.codRefusalPenaltyMillimes;

    expect(waterfall.netRealizedContributionMillimes).toBe(expectedNet);
  });

  it('satisfies waterfall vs ledger net identity on 30-day window', () => {
    const thirtyDaysAgo = new Date(
      fixedReferenceDate.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const last30DaysOrders = dataset.orders.filter(
      (o) => o.placedAt >= thirtyDaysAgo && o.placedAt <= fixedReferenceDate,
    );

    const last30DaysAdSpend = dataset.adSpends.filter(
      (s) => s.periodStart >= thirtyDaysAgo && s.periodStart <= fixedReferenceDate,
    );
    const total30DayAdSpendMillimes = last30DaysAdSpend.reduce(
      (sum, s) => sum + s.spendMillimes,
      0,
    );

    const waterfall = calculateWaterfall(
      last30DaysOrders as any,
      total30DayAdSpendMillimes,
    );
    const ledgerNet = calculateLedgerNet(last30DaysOrders as any);
    const adSpendDelta = calculateAdSpendDelta(
      last30DaysOrders as any,
      total30DayAdSpendMillimes,
    );

    // Fundamental identity: waterfallNet + adSpendDelta === ledgerNet
    expect(waterfall.netRealizedContributionMillimes + adSpendDelta).toBe(ledgerNet);
  });

  it('preserves delivered vs refused order financial formulas', () => {
    for (const order of dataset.orders) {
      if (order.status === 'delivered') {
        const expected =
          order.unitPriceMillimes * order.quantity -
          order.unitCogsMillimes * order.quantity -
          order.shippingMillimes -
          order.courierFeeMillimes -
          order.adCpaMillimes;
        expect(order.netContributionMillimes).toBe(expected);
        expect(order.deliveredAt).toBeDefined();
      } else if (order.status === 'refused') {
        const expected = -(
          order.shippingMillimes +
          order.returnShippingMillimes +
          order.adCpaMillimes
        );
        expect(order.netContributionMillimes).toBe(expected);
      }
    }
  });

  it('includes settlements (some settled, some pending) with correct order links', () => {
    expect(dataset.settlements.length).toBeGreaterThanOrEqual(4);

    const settled = dataset.settlements.filter((s) => s.status === 'settled');
    const pending = dataset.settlements.filter((s) => s.status === 'pending');

    expect(settled.length).toBeGreaterThanOrEqual(2);
    expect(pending.length).toBeGreaterThanOrEqual(2);

    // Settled settlements have reconciledAt
    for (const s of settled) {
      expect(s.reconciledAt).toBeDefined();
      // Orders in settled settlements must have settlementId set
      for (const orderId of s.orderIds) {
        const order = dataset.orders.find((o) => o._id === orderId);
        expect(order).toBeDefined();
        expect(order?.settlementId).toBe(s._id);
      }
    }
  });

  it('includes 6 monthly expense types, 4 scenarios, and 3 reports', () => {
    expect(dataset.expenses.length).toBe(6);
    const categories = new Set(dataset.expenses.map((e) => e.category));
    expect(categories.has('rent')).toBe(true);
    expect(categories.has('salary')).toBe(true);
    expect(categories.has('utilities')).toBe(true);
    expect(categories.has('logistics')).toBe(true);
    expect(categories.has('marketing')).toBe(true);

    expect(dataset.scenarios.length).toBe(4);
    expect(dataset.reports.length).toBe(3);
  });
});
