import * as fs from 'fs';
import * as path from 'path';
import {
  calculateUnitEconomics,
  calculateOrderNetContribution,
  calculateWaterfall,
  calculateAdSpendDelta,
  calculateLedgerNet,
  type OrderFinance,
} from './finance';

const goldenFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../contracts-golden.json'), 'utf8'),
);

describe('Finance Domain - Golden Fixture', () => {
  it('unit economics calibration matches fixture', () => {
    const testCase = goldenFixture.unitEconomics[0];
    const result = calculateUnitEconomics(testCase.input);

    expect(result.maxTolerableCpaMillimes).toBe(testCase.expected.maxTolerableCpaMillimes);
    expect(result.breakEvenROAS).toBe(testCase.expected.breakEvenROAS);
    expect(result.netProfitPerUnitMillimes).toBe(testCase.expected.netProfitPerUnitMillimes);
  });

  it('order net contributions match fixture', () => {
    for (const orderData of goldenFixture.orders) {
      const order: OrderFinance = {
        unitPriceMillimes: orderData.unitPriceMillimes,
        unitCogsMillimes: orderData.unitCogsMillimes,
        quantity: orderData.quantity,
        shippingMillimes: orderData.shippingMillimes,
        returnShippingMillimes: orderData.returnShippingMillimes,
        courierFeeMillimes: orderData.courierFeeMillimes,
        adCpaMillimes: orderData.adCpaMillimes,
        status: orderData.status,
      };

      const net = calculateOrderNetContribution(order);
      expect(net).toBe(orderData.expectedNetContributionMillimes);
    }
  });

  it('waterfall matches fixture (realized orders only)', () => {
    const orders: OrderFinance[] = goldenFixture.orders.map((o: any) => ({
      unitPriceMillimes: o.unitPriceMillimes,
      unitCogsMillimes: o.unitCogsMillimes,
      quantity: o.quantity,
      shippingMillimes: o.shippingMillimes,
      returnShippingMillimes: o.returnShippingMillimes,
      courierFeeMillimes: o.courierFeeMillimes,
      adCpaMillimes: o.adCpaMillimes,
      status: o.status,
    }));

    const waterfall = calculateWaterfall(orders, goldenFixture.waterfall.actualAdSpendEntriesMillimes);
    const expected = goldenFixture.waterfall.expected;

    expect(waterfall.grossRevenueMillimes).toBe(expected.grossRevenueMillimes);
    expect(waterfall.productCOGSMillimes).toBe(expected.productCOGSMillimes);
    expect(waterfall.outboundShippingMillimes).toBe(expected.outboundShippingMillimes);
    expect(waterfall.paidAdSpendMillimes).toBe(expected.paidAdSpendMillimes);
    expect(waterfall.codRefusalPenaltyMillimes).toBe(expected.codRefusalPenaltyMillimes);
    expect(waterfall.netRealizedContributionMillimes).toBe(expected.netRealizedContributionMillimes);
    expect(waterfall.netRealizedContributionPercent).toBe(expected.netRealizedContributionPercent);
  });

  it('waterfall identity: sum equals netRealizedContribution', () => {
    const orders: OrderFinance[] = goldenFixture.orders.map((o: any) => ({
      unitPriceMillimes: o.unitPriceMillimes,
      unitCogsMillimes: o.unitCogsMillimes,
      quantity: o.quantity,
      shippingMillimes: o.shippingMillimes,
      returnShippingMillimes: o.returnShippingMillimes,
      courierFeeMillimes: o.courierFeeMillimes,
      adCpaMillimes: o.adCpaMillimes,
      status: o.status,
    }));

    const waterfall = calculateWaterfall(orders, goldenFixture.waterfall.actualAdSpendEntriesMillimes);

    const computedNet =
      waterfall.grossRevenueMillimes -
      waterfall.productCOGSMillimes -
      waterfall.outboundShippingMillimes -
      waterfall.paidAdSpendMillimes -
      waterfall.codRefusalPenaltyMillimes;

    expect(computedNet).toBe(waterfall.netRealizedContributionMillimes);
  });

  it('adSpendDelta identity matches fixture', () => {
    const orders: OrderFinance[] = goldenFixture.orders.map((o: any) => ({
      unitPriceMillimes: o.unitPriceMillimes,
      unitCogsMillimes: o.unitCogsMillimes,
      quantity: o.quantity,
      shippingMillimes: o.shippingMillimes,
      returnShippingMillimes: o.returnShippingMillimes,
      courierFeeMillimes: o.courierFeeMillimes,
      adCpaMillimes: o.adCpaMillimes,
      status: o.status,
    }));

    const delta = calculateAdSpendDelta(orders, goldenFixture.waterfall.actualAdSpendEntriesMillimes);
    expect(delta).toBe(goldenFixture.waterfall.expected.adSpendDeltaMillimes);
  });

  it('ledger identity: waterfallNet = ledgerNet - adSpendDelta', () => {
    const orders: OrderFinance[] = goldenFixture.orders.map((o: any) => ({
      unitPriceMillimes: o.unitPriceMillimes,
      unitCogsMillimes: o.unitCogsMillimes,
      quantity: o.quantity,
      shippingMillimes: o.shippingMillimes,
      returnShippingMillimes: o.returnShippingMillimes,
      courierFeeMillimes: o.courierFeeMillimes,
      adCpaMillimes: o.adCpaMillimes,
      status: o.status,
    }));

    const waterfall = calculateWaterfall(orders, goldenFixture.waterfall.actualAdSpendEntriesMillimes);
    const ledgerNet = calculateLedgerNet(orders);
    const adSpendDelta = calculateAdSpendDelta(orders, goldenFixture.waterfall.actualAdSpendEntriesMillimes);

    // Identity: waterfallNet = ledgerNet - adSpendDelta
    expect(waterfall.netRealizedContributionMillimes).toBe(ledgerNet - adSpendDelta);
  });
});

describe('Finance Domain - Edge Cases', () => {
  it('zero price returns zero maxTolerableCPA and breakEvenROAS', () => {
    const result = calculateUnitEconomics({
      priceMillimes: 0,
      cogsMillimes: 20000,
      logisticsMillimes: 10000,
      cpaMillimes: 15000,
      refusalRate: 0.2,
    });

    expect(result.maxTolerableCpaMillimes).toBe(0);
    expect(result.breakEvenROAS).toBe(0);
    expect(result.netProfitPerUnitMillimes).toBeLessThan(0);
  });

  it('100% refusal rate accounts for full CPA waste', () => {
    const result = calculateUnitEconomics({
      priceMillimes: 100000,
      cogsMillimes: 25000,
      logisticsMillimes: 10000,
      cpaMillimes: 20000,
      refusalRate: 1.0,
    });

    // 100 - 25 - 10 - 20 - (1.0 * 20) = 25
    expect(result.netProfitPerUnitMillimes).toBe(25000);
  });

  it('quantity > 1 multiplies price and COGS correctly', () => {
    const order: OrderFinance = {
      unitPriceMillimes: 50000,
      unitCogsMillimes: 15000,
      quantity: 3,
      shippingMillimes: 10000,
      returnShippingMillimes: 0,
      courierFeeMillimes: 5000,
      adCpaMillimes: 12000,
      status: 'delivered',
    };

    // (50 * 3) - (15 * 3) - 10 - 12 - 5 = 150 - 45 - 27 = 78
    const net = calculateOrderNetContribution(order);
    expect(net).toBe(78000);
  });

  it('empty orders array returns zero waterfall', () => {
    const waterfall = calculateWaterfall([], 0);

    expect(waterfall.grossRevenueMillimes).toBe(0);
    expect(waterfall.productCOGSMillimes).toBe(0);
    expect(waterfall.outboundShippingMillimes).toBe(0);
    expect(waterfall.netRealizedContributionMillimes).toBe(0);
    expect(waterfall.netRealizedContributionPercent).toBe(0);
  });

  it('only realized orders contribute to waterfall', () => {
    const orders: OrderFinance[] = [
      {
        unitPriceMillimes: 100000,
        unitCogsMillimes: 30000,
        quantity: 1,
        shippingMillimes: 5000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 10000,
        status: 'delivered', // Realized
      },
      {
        unitPriceMillimes: 80000,
        unitCogsMillimes: 20000,
        quantity: 1,
        shippingMillimes: 5000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 8000,
        status: 'confirmed', // NOT realized
      },
      {
        unitPriceMillimes: 60000,
        unitCogsMillimes: 15000,
        quantity: 1,
        shippingMillimes: 4000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 6000,
        status: 'pending', // NOT realized
      },
    ];

    const waterfall = calculateWaterfall(orders, 0);

    // Only first order (delivered) counts
    expect(waterfall.grossRevenueMillimes).toBe(100000);
    expect(waterfall.productCOGSMillimes).toBe(30000);
  });

  it('refused order contributes to codRefusalPenalty, not revenue', () => {
    const orders: OrderFinance[] = [
      {
        unitPriceMillimes: 100000,
        unitCogsMillimes: 30000,
        quantity: 1,
        shippingMillimes: 8000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 15000,
        status: 'refused',
      },
    ];

    const waterfall = calculateWaterfall(orders, 0);

    expect(waterfall.grossRevenueMillimes).toBe(0);
    expect(waterfall.productCOGSMillimes).toBe(0);
    expect(waterfall.codRefusalPenaltyMillimes).toBe(8000); // shipping only
  });
});

describe('Finance Domain - Rounding', () => {
  it('rate multiplications use Math.round (half away from zero)', () => {
    // refusalRate 0.21 * cpa 22000 = 4620 (exact)
    const result = calculateUnitEconomics({
      priceMillimes: 129000,
      cogsMillimes: 28000,
      logisticsMillimes: 14000,
      cpaMillimes: 22000,
      refusalRate: 0.21,
    });

    // 129 - 28 - 14 - 22 - 4.62 = 60.38
    expect(result.netProfitPerUnitMillimes).toBe(60380);
  });

  it('netRealizedContributionPercent rounds to 1 decimal', () => {
    const orders: OrderFinance[] = [
      {
        unitPriceMillimes: 578000,
        unitCogsMillimes: 154000,
        quantity: 1,
        shippingMillimes: 30200,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 0,
        status: 'delivered',
      },
    ];

    const waterfall = calculateWaterfall(orders, 150000);
    // Net = 578 - 154 - 30.2 - 150 - 0 = 243.8
    // Percent = 243.8 / 578 * 100 = 42.18... -> 42.2
    expect(waterfall.netRealizedContributionPercent).toBe(42.2);
  });
});
