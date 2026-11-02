/**
 * Pure COD reconciliation domain functions.
 * ZERO Nest/Mongoose imports. Integer millimes only.
 */

export interface OrderForReconciliation {
  id: string;
  unitPriceMillimes: number;
  quantity: number;
  courierFeeMillimes: number;
  status: string;
  settlementId?: string | null;
}

export interface Settlement {
  id: string;
  orderIds: string[];
  grossCollectedMillimes: number;
  commissionMillimes: number;
  netMillimes: number;
  status: 'pending' | 'settled';
}

export interface CODReconciliationResult {
  pendingCourierPayoutsMillimes: number;
  bankWireSettledMillimes: number;
  expectedCashCollectionsMillimes: number;
}

/**
 * Pending payouts: sum of (price * qty - courierFee) for delivered orders NOT in a settled settlement.
 */
export function calculatePendingPayouts(
  orders: OrderForReconciliation[],
  settlements: Settlement[],
): number {
  const settledOrderIds = new Set<string>();
  for (const settlement of settlements) {
    if (settlement.status === 'settled') {
      for (const orderId of settlement.orderIds) {
        settledOrderIds.add(orderId);
      }
    }
  }

  let pendingMillimes = 0;
  for (const order of orders) {
    if (order.status === 'delivered' && !settledOrderIds.has(order.id)) {
      const grossCollected = order.unitPriceMillimes * order.quantity;
      pendingMillimes += grossCollected - order.courierFeeMillimes;
    }
  }

  return pendingMillimes;
}

/**
 * Settled net: sum of netMillimes from settled settlements.
 */
export function calculateSettledNet(settlements: Settlement[]): number {
  let settledMillimes = 0;
  for (const settlement of settlements) {
    if (settlement.status === 'settled') {
      settledMillimes += settlement.netMillimes;
    }
  }
  return settledMillimes;
}

/**
 * COD identity: expectedCashCollections = settledNet + pendingPayouts
 */
export function calculateCODReconciliation(
  orders: OrderForReconciliation[],
  settlements: Settlement[],
): CODReconciliationResult {
  const pendingCourierPayoutsMillimes = calculatePendingPayouts(orders, settlements);
  const bankWireSettledMillimes = calculateSettledNet(settlements);
  const expectedCashCollectionsMillimes = bankWireSettledMillimes + pendingCourierPayoutsMillimes;

  return {
    pendingCourierPayoutsMillimes,
    bankWireSettledMillimes,
    expectedCashCollectionsMillimes,
  };
}
