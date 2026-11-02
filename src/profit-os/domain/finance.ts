/**
 * Pure finance domain functions: unit economics, order net contribution, waterfall, identities.
 * ZERO Nest/Mongoose imports. Integer millimes only, no floats for totals.
 *
 * ROUNDING RULE: Integer millimes throughout, Math.round() on rate multiplications (half away from zero).
 */

export interface OrderFinance {
  unitPriceMillimes: number;
  unitCogsMillimes: number;
  quantity: number;
  shippingMillimes: number;
  returnShippingMillimes: number;
  courierFeeMillimes: number;
  adCpaMillimes: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled';
}

export interface UnitEconomicsInput {
  priceMillimes: number;
  cogsMillimes: number;
  logisticsMillimes: number;
  cpaMillimes: number;
  refusalRate: number; // 0..1
}

export interface UnitEconomicsResult {
  maxTolerableCpaMillimes: number;
  breakEvenROAS: number; // 2 decimals
  netProfitPerUnitMillimes: number;
}

export interface WaterfallResult {
  grossRevenueMillimes: number;
  productCOGSMillimes: number;
  outboundShippingMillimes: number;
  paidAdSpendMillimes: number;
  codRefusalPenaltyMillimes: number;
  netRealizedContributionMillimes: number;
  netRealizedContributionPercent: number; // 1 decimal
}

/**
 * Unit Economics: maxTolerableCPA, break-even ROAS, net profit per unit.
 * Calibration: price 129, COGS 28, logistics 14, CPA 22, refusal 0.21
 *   -> maxTolerableCPA 87, breakEvenROAS 1.48, netProfitPerUnit 60.38 (60.4 display)
 */
export function calculateUnitEconomics(
  input: UnitEconomicsInput,
): UnitEconomicsResult {
  const { priceMillimes, cogsMillimes, logisticsMillimes, cpaMillimes, refusalRate } = input;

  if (priceMillimes <= 0) {
    return {
      maxTolerableCpaMillimes: 0,
      breakEvenROAS: 0,
      netProfitPerUnitMillimes: -(cogsMillimes + logisticsMillimes + cpaMillimes),
    };
  }

  const maxTolerableCpaMillimes = Math.max(0, priceMillimes - cogsMillimes - logisticsMillimes);
  const breakEvenROAS =
    maxTolerableCpaMillimes > 0
      ? Math.round((priceMillimes / maxTolerableCpaMillimes) * 100) / 100
      : 0;

  // Wasted ad spend on refused parcels: refusalRate * cpa
  const wastedCpaMillimes = Math.round(refusalRate * cpaMillimes);
  const netProfitPerUnitMillimes =
    priceMillimes - cogsMillimes - logisticsMillimes - cpaMillimes - wastedCpaMillimes;

  return {
    maxTolerableCpaMillimes,
    breakEvenROAS,
    netProfitPerUnitMillimes,
  };
}

/**
 * Order net contribution:
 * - Delivered/Shipped/Confirmed: price*qty - COGS*qty - shipping - adCpa - courierFee
 * - Refused: parcel returns to stock (COGS recovered), lose outbound shipping + return shipping + adCpa
 *   Formula: -(shipping + returnShipping + adCpa)
 */
export function calculateOrderNetContribution(order: OrderFinance): number {
  const { unitPriceMillimes, unitCogsMillimes, quantity, shippingMillimes, returnShippingMillimes, courierFeeMillimes, adCpaMillimes, status } = order;

  if (status === 'refused') {
    // COGS returns to inventory (0 revenue), lose shipping + return shipping + adCpa
    return -(shippingMillimes + returnShippingMillimes + adCpaMillimes);
  }

  // Delivered, shipped, confirmed
  const revenue = unitPriceMillimes * quantity;
  const cogs = unitCogsMillimes * quantity;
  return revenue - cogs - shippingMillimes - adCpaMillimes - courierFeeMillimes;
}

/**
 * Realized vs Projected recognition:
 * - REALIZED: delivered + refused (money has moved or been lost)
 * - PROJECTED: confirmed + shipped (forecast, not yet realized)
 * - EXCLUDED: pending, cancelled
 */
export function isOrderRealized(status: string): boolean {
  return status === 'delivered' || status === 'refused';
}

export function isOrderProjected(status: string): boolean {
  return status === 'confirmed' || status === 'shipped';
}

/**
 * P&L Waterfall over REALIZED orders only.
 * Identity: grossRevenue - productCOGS - outboundShipping - paidAdSpend - codRefusalPenalty = netRealizedContribution
 *
 * IMPORTANT: outboundShipping = shipping of DELIVERED orders + courierFee of DELIVERED orders.
 *            Refused order shipping goes ONLY to codRefusalPenalty, never counted twice.
 */
export function calculateWaterfall(
  orders: OrderFinance[],
  paidAdSpendMillimes: number,
): WaterfallResult {
  let grossRevenueMillimes = 0;
  let productCOGSMillimes = 0;
  let outboundShippingMillimes = 0;
  let codRefusalPenaltyMillimes = 0;

  for (const order of orders) {
    if (!isOrderRealized(order.status)) continue;

    if (order.status === 'delivered') {
      grossRevenueMillimes += order.unitPriceMillimes * order.quantity;
      productCOGSMillimes += order.unitCogsMillimes * order.quantity;
      outboundShippingMillimes += order.shippingMillimes + order.courierFeeMillimes;
    } else if (order.status === 'refused') {
      // Refused: shipping + return shipping penalty (COGS recovered, no revenue)
      codRefusalPenaltyMillimes += order.shippingMillimes + order.returnShippingMillimes;
    }
  }

  const netRealizedContributionMillimes =
    grossRevenueMillimes -
    productCOGSMillimes -
    outboundShippingMillimes -
    paidAdSpendMillimes -
    codRefusalPenaltyMillimes;

  const netRealizedContributionPercent =
    grossRevenueMillimes > 0
      ? Math.round((netRealizedContributionMillimes / grossRevenueMillimes) * 1000) / 10
      : 0;

  return {
    grossRevenueMillimes,
    productCOGSMillimes,
    outboundShippingMillimes,
    paidAdSpendMillimes,
    codRefusalPenaltyMillimes,
    netRealizedContributionMillimes,
    netRealizedContributionPercent,
  };
}

/**
 * Waterfall identity: waterfallNet = ledgerNet - adSpendDelta
 * where adSpendDelta = actualAdSpend - allocatedAdCpa
 */
export function calculateAdSpendDelta(
  orders: OrderFinance[],
  actualAdSpendMillimes: number,
): number {
  let allocatedAdCpaMillimes = 0;
  for (const order of orders) {
    if (isOrderRealized(order.status)) {
      allocatedAdCpaMillimes += order.adCpaMillimes;
    }
  }
  return actualAdSpendMillimes - allocatedAdCpaMillimes;
}

/**
 * Ledger net of realized orders (sum of net contributions)
 */
export function calculateLedgerNet(orders: OrderFinance[]): number {
  let ledgerNetMillimes = 0;
  for (const order of orders) {
    if (isOrderRealized(order.status)) {
      ledgerNetMillimes += calculateOrderNetContribution(order);
    }
  }
  return ledgerNetMillimes;
}
