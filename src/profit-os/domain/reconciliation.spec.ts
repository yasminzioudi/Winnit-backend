import * as fs from 'fs';
import * as path from 'path';
import {
  calculateCODReconciliation,
  calculatePendingPayouts,
  calculateSettledNet,
  type OrderForReconciliation,
  type Settlement,
} from './reconciliation';

const goldenFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../contracts-golden.json'), 'utf8'),
);

describe('COD Reconciliation - Golden Fixture', () => {
  it('matches fixture expectations', () => {
    const orders: OrderForReconciliation[] = goldenFixture.orders.map((o: any) => ({
      id: o.id,
      unitPriceMillimes: o.unitPriceMillimes,
      quantity: o.quantity,
      courierFeeMillimes: o.courierFeeMillimes,
      status: o.status,
      settlementId: null,
    }));

    // Mark orders in settled settlement
    const settledSettlement = goldenFixture.settlements[0];
    for (const order of orders) {
      if (settledSettlement.orderIds.includes(order.id)) {
        order.settlementId = settledSettlement.id;
      }
    }

    const settlements: Settlement[] = goldenFixture.settlements;

    const result = calculateCODReconciliation(orders, settlements);
    const expected = goldenFixture.codReconciliation.expected;

    expect(result.pendingCourierPayoutsMillimes).toBe(expected.pendingCourierPayoutsMillimes);
    expect(result.bankWireSettledMillimes).toBe(expected.bankWireSettledMillimes);
    expect(result.expectedCashCollectionsMillimes).toBe(expected.expectedCashCollectionsMillimes);
  });

  it('COD identity: expectedCashCollections = settledNet + pendingPayouts', () => {
    const orders: OrderForReconciliation[] = goldenFixture.orders.map((o: any) => ({
      id: o.id,
      unitPriceMillimes: o.unitPriceMillimes,
      quantity: o.quantity,
      courierFeeMillimes: o.courierFeeMillimes,
      status: o.status,
      settlementId: null,
    }));

    const settlements: Settlement[] = goldenFixture.settlements;

    const pendingPayouts = calculatePendingPayouts(orders, settlements);
    const settledNet = calculateSettledNet(settlements);
    const expectedCashCollections = settledNet + pendingPayouts;

    const result = calculateCODReconciliation(orders, settlements);

    expect(result.expectedCashCollectionsMillimes).toBe(expectedCashCollections);
  });
});

describe('COD Reconciliation - Edge Cases', () => {
  it('empty orders returns zero pending payouts', () => {
    const result = calculatePendingPayouts([], []);
    expect(result).toBe(0);
  });

  it('no settled settlements returns zero settled net', () => {
    const settlements: Settlement[] = [
      {
        id: 'stl_pending',
        orderIds: ['ord_1'],
        grossCollectedMillimes: 100000,
        commissionMillimes: 5000,
        netMillimes: 95000,
        status: 'pending',
      },
    ];

    const result = calculateSettledNet(settlements);
    expect(result).toBe(0);
  });

  it('delivered orders in settled settlement are excluded from pending payouts', () => {
    const orders: OrderForReconciliation[] = [
      {
        id: 'ord_1',
        unitPriceMillimes: 100000,
        quantity: 1,
        courierFeeMillimes: 5000,
        status: 'delivered',
        settlementId: 'stl_001',
      },
      {
        id: 'ord_2',
        unitPriceMillimes: 80000,
        quantity: 1,
        courierFeeMillimes: 3000,
        status: 'delivered',
        settlementId: null,
      },
    ];

    const settlements: Settlement[] = [
      {
        id: 'stl_001',
        orderIds: ['ord_1'],
        grossCollectedMillimes: 100000,
        commissionMillimes: 5000,
        netMillimes: 95000,
        status: 'settled',
      },
    ];

    const pendingPayouts = calculatePendingPayouts(orders, settlements);

    // Only ord_2 is pending: 80 - 3 = 77
    expect(pendingPayouts).toBe(77000);
  });

  it('non-delivered orders do not contribute to pending payouts', () => {
    const orders: OrderForReconciliation[] = [
      {
        id: 'ord_1',
        unitPriceMillimes: 100000,
        quantity: 1,
        courierFeeMillimes: 5000,
        status: 'confirmed',
        settlementId: null,
      },
      {
        id: 'ord_2',
        unitPriceMillimes: 80000,
        quantity: 1,
        courierFeeMillimes: 3000,
        status: 'refused',
        settlementId: null,
      },
    ];

    const pendingPayouts = calculatePendingPayouts(orders, []);
    expect(pendingPayouts).toBe(0);
  });

  it('quantity > 1 multiplies price correctly', () => {
    const orders: OrderForReconciliation[] = [
      {
        id: 'ord_1',
        unitPriceMillimes: 50000,
        quantity: 3,
        courierFeeMillimes: 10000,
        status: 'delivered',
        settlementId: null,
      },
    ];

    const pendingPayouts = calculatePendingPayouts(orders, []);
    // (50 * 3) - 10 = 140
    expect(pendingPayouts).toBe(140000);
  });
});
