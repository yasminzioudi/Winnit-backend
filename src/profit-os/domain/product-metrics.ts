/**
 * Product metrics calculation for winners scoring.
 * ZERO Nest/Mongoose imports - pure domain logic.
 * 
 * Used by:
 * - analytics.service.ts (API endpoints)
 * - seed-quotas.spec.ts (verification tests)
 * 
 * CRITICAL: Uses AdSpend entries (not order.adCpaMillimes) to match API behavior.
 */

export interface OrderForMetrics {
  productId: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'refused' | 'cancelled';
  unitPriceMillimes: number;
  unitCogsMillimes: number;
  shippingMillimes: number;
  quantity: number;
  netContributionMillimes: number;
}

export interface AdSpendForMetrics {
  productId?: string | null;
  spendMillimes: number;
}

export interface ProductMetricsInput {
  productId: string;
  currentOrders: OrderForMetrics[];
  previousOrders: OrderForMetrics[];
  adSpends: AdSpendForMetrics[]; // AdSpend collection entries
}

export interface CalculatedProductMetrics {
  productId: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  netMarginPercent: number;
  breakEvenROAS: number;
  actualROAS: number;
  volumeTrend30Days: number;
}

/**
 * Calculate product metrics from order data and AdSpend entries.
 * Uses AdSpend collection (not order.adCpaMillimes) to match API behavior.
 * This ensures test and API use identical calculation.
 */
export function calculateProductMetrics(
  input: ProductMetricsInput,
): CalculatedProductMetrics {
  const { productId, currentOrders, previousOrders, adSpends } = input;

  const delivered = currentOrders.filter((o) => o.status === 'delivered').length;
  const refused = currentOrders.filter((o) => o.status === 'refused').length;

  const revenue = currentOrders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + o.unitPriceMillimes * o.quantity, 0);

  const netContribution = currentOrders.reduce(
    (sum, o) => sum + o.netContributionMillimes,
    0,
  );

  const netMarginPercent = revenue > 0 ? (netContribution / revenue) * 100 : 0;

  // Ad spend: sum from AdSpend collection entries for this product
  const adSpend = adSpends
    .filter((s) => s.productId === productId)
    .reduce((sum, s) => sum + s.spendMillimes, 0);
  const actualROAS = adSpend > 0 ? revenue / adSpend : 0;

  // Break-even ROAS: compute from actual order economics
  const cogs = currentOrders.reduce(
    (sum, o) => sum + o.unitCogsMillimes * o.quantity,
    0,
  );
  const shipping = currentOrders.reduce((sum, o) => sum + o.shippingMillimes, 0);
  const maxTolerableCPA = revenue - cogs - shipping;
  const breakEvenROAS = maxTolerableCPA > 0 ? revenue / maxTolerableCPA : 0;

  // Volume trend
  const volumeTrend =
    previousOrders.length > 0
      ? (currentOrders.length - previousOrders.length) / previousOrders.length
      : 0;

  return {
    productId,
    totalOrders: currentOrders.length,
    deliveredOrders: delivered,
    refusedOrders: refused,
    netMarginPercent,
    breakEvenROAS,
    actualROAS,
    volumeTrend30Days: Math.max(-1, Math.min(1, volumeTrend)),
  };
}
