import {
  calculateWaterfall,
  calculateLedgerNet,
  calculateAdSpendDelta,
  calculateOrderNetContribution,
} from '../domain/finance';

describe('Seed Finance Identities', () => {
  // Seed-like order generator (deterministic)
  function generateTestOrders() {
    const orders = [
      {
        _id: '1',
        workspaceId: 'ws_test',
        orderNumber: 'ORD-1',
        productId: 'prd_001',
        productNameSnapshot: 'Product A',
        quantity: 1,
        unitPriceMillimes: 129000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 21400,
        courier: 'yalidine',
        customer: { firstName: 'Ahmed', city: 'Tunis', governorate: 'Tunis' },
        status: 'delivered',
        statusHistory: [],
        placedAt: new Date(),
        netContributionMillimes: 0,
        version: 1,
        deletedAt: null,
      },
      {
        _id: '2',
        workspaceId: 'ws_test',
        orderNumber: 'ORD-2',
        productId: 'prd_001',
        productNameSnapshot: 'Product A',
        quantity: 1,
        unitPriceMillimes: 129000,
        unitCogsMillimes: 28000,
        shippingMillimes: 8000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 21400,
        courier: 'yalidine',
        customer: { firstName: 'Fatima', city: 'Sfax', governorate: 'Sfax' },
        status: 'delivered',
        statusHistory: [],
        placedAt: new Date(),
        netContributionMillimes: 0,
        version: 1,
        deletedAt: null,
      },
      {
        _id: '3',
        workspaceId: 'ws_test',
        orderNumber: 'ORD-3',
        productId: 'prd_002',
        productNameSnapshot: 'Product B',
        quantity: 1,
        unitPriceMillimes: 249000,
        unitCogsMillimes: 65000,
        shippingMillimes: 12000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 3500,
        adCpaMillimes: 38000,
        courier: 'aramex',
        status: 'shipped',
        statusHistory: [],
        placedAt: new Date(),
        netContributionMillimes: 0,
        version: 1,
        deletedAt: null,
      },
      {
        _id: '4',
        workspaceId: 'ws_test',
        orderNumber: 'ORD-4',
        productId: 'prd_001',
        productNameSnapshot: 'Product A',
        quantity: 1,
        unitPriceMillimes: 129000,
        unitCogsMillimes: 28000,
        shippingMillimes: 8000,
        returnShippingMillimes: 0,
        courierFeeMillimes: 0,
        adCpaMillimes: 21400,
        courier: 'yalidine',
        customer: { firstName: 'Karim', city: 'Ariana', governorate: 'Ariana' },
        status: 'refused',
        statusHistory: [],
        placedAt: new Date(),
        netContributionMillimes: 0,
        version: 1,
        deletedAt: null,
      },
    ];

    // Compute net contribution for each order
    orders.forEach((order: any) => {
      order.netContributionMillimes = calculateOrderNetContribution(order);
    });

    return orders;
  }

  it('waterfall sum identity holds', () => {
    const orders = generateTestOrders();
    const actualAdSpendMillimes = 150000; // Simulated actual ad spend from platform

    const waterfall = calculateWaterfall(orders as any, actualAdSpendMillimes);

    // Identity: grossRevenue - productCOGS - outboundShipping - paidAdSpend - codRefusalPenalty = netRealizedContribution
    const computedNet =
      waterfall.grossRevenueMillimes -
      waterfall.productCOGSMillimes -
      waterfall.outboundShippingMillimes -
      waterfall.paidAdSpendMillimes -
      waterfall.codRefusalPenaltyMillimes;

    expect(waterfall.netRealizedContributionMillimes).toBe(computedNet);
  });

  it('waterfall vs ledger identity holds: waterfallNet = ledgerNet(realized) - adSpendDelta', () => {
    const orders = generateTestOrders();
    const actualAdSpendMillimes = 150000;

    const waterfall = calculateWaterfall(orders as any, actualAdSpendMillimes);
    const ledgerNet = calculateLedgerNet(orders as any);
    const adSpendDelta = calculateAdSpendDelta(orders as any, actualAdSpendMillimes);

    // Identity: waterfallNet + adSpendDelta = ledgerNet
    // (because waterfall uses actual ad spend, ledger uses allocated CPA)
    const leftSide = waterfall.netRealizedContributionMillimes + adSpendDelta;

    expect(leftSide).toBe(ledgerNet);
  });

  it('order net contribution formula is correct', () => {
    const deliveredOrder: any = {
      status: 'delivered',
      quantity: 1,
      unitPriceMillimes: 129000,
      unitCogsMillimes: 28000,
      shippingMillimes: 7000,
      courierFeeMillimes: 0,
      adCpaMillimes: 21400,
    };

    const net = calculateOrderNetContribution(deliveredOrder);
    // 129000 - 28000 - 7000 - 0 - 21400 = 72600
    expect(net).toBe(72600);
  });

  it('refused order net contribution formula is correct', () => {
    const refusedOrder: any = {
      status: 'refused',
      quantity: 1,
      unitPriceMillimes: 129000,
      unitCogsMillimes: 28000,
      shippingMillimes: 8000,
      returnShippingMillimes: 0,
      courierFeeMillimes: 0,
      adCpaMillimes: 21400,
    };

    const net = calculateOrderNetContribution(refusedOrder);
    // -(8000 + 0 + 21400) = -29400
    expect(net).toBe(-29400);
  });
});
