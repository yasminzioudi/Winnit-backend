/**
 * Winners scoring algorithm: 0..100 with configurable weights.
 * ZERO Nest/Mongoose imports.
 * 
 * Products with < 20 orders in window: "données insuffisantes", never ranked as winner.
 * Labels: >= 75 "Winner", 50-74 "À surveiller", < 50 "À couper"
 */

export interface ProductMetrics {
  productId: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  netMarginPercent: number; // as percent, e.g. 40.8
  breakEvenROAS: number;
  actualROAS: number;
  volumeTrend30Days: number; // -1..1, 0 = flat
}

export interface ScoreWeights {
  netMarginWeight: number;
  deliveryRateWeight: number;
  roasWeight: number;
  volumeTrendWeight: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  netMarginWeight: 40,
  deliveryRateWeight: 25,
  roasWeight: 20,
  volumeTrendWeight: 15,
};

export interface WinnerScore {
  productId: string;
  score: number; // 0..100
  label: 'Winner' | 'À surveiller' | 'À couper' | 'Données insuffisantes';
  breakdown: {
    netMarginScore: number;
    deliveryRateScore: number;
    roasScore: number;
    volumeTrendScore: number;
  };
}

/**
 * Calculate winner score (0..100) with configurable weights.
 * Formula:
 * - netMargin score: normalized to 0..100 (0% = 0, 50% = 100)
 * - deliveryRate score: (delivered / (delivered + refused)) * 100
 * - roas score: (actualROAS / breakEvenROAS) * 100, capped at 100
 * - volumeTrend score: (trend + 1) / 2 * 100 (normalize -1..1 to 0..100)
 *
 * Total = weighted sum
 */
export function calculateWinnerScore(
  metrics: ProductMetrics,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): WinnerScore {
  // < 20 orders: insufficient data
  if (metrics.totalOrders < 20) {
    return {
      productId: metrics.productId,
      score: 0,
      label: 'Données insuffisantes',
      breakdown: {
        netMarginScore: 0,
        deliveryRateScore: 0,
        roasScore: 0,
        volumeTrendScore: 0,
      },
    };
  }

  // Net margin score: 0% = 0, 50% = 100
  const netMarginScore = Math.min(100, Math.max(0, metrics.netMarginPercent * 2));

  // Delivery rate score
  const deliveryRate =
    metrics.deliveredOrders / (metrics.deliveredOrders + metrics.refusedOrders);
  const deliveryRateScore = deliveryRate * 100;

  // ROAS score: proportional to break-even (1.0x = 50, 2.0x = 100), no instant saturation
  const roasRatio =
    metrics.breakEvenROAS > 0 ? metrics.actualROAS / metrics.breakEvenROAS : 0;
  const roasScore = Math.min(100, Math.max(0, roasRatio * 50));

  // Volume trend score: normalize -1..1 to 0..100
  const volumeTrendScore = ((metrics.volumeTrend30Days + 1) / 2) * 100;

  // Weighted sum
  const totalWeight =
    weights.netMarginWeight +
    weights.deliveryRateWeight +
    weights.roasWeight +
    weights.volumeTrendWeight;

  const score =
    (netMarginScore * weights.netMarginWeight +
      deliveryRateScore * weights.deliveryRateWeight +
      roasScore * weights.roasWeight +
      volumeTrendScore * weights.volumeTrendWeight) /
    totalWeight;

  const roundedScore = Math.round(score);

  // Label
  let label: 'Winner' | 'À surveiller' | 'À couper';
  if (roundedScore >= 75) {
    label = 'Winner';
  } else if (roundedScore >= 50) {
    label = 'À surveiller';
  } else {
    label = 'À couper';
  }

  return {
    productId: metrics.productId,
    score: roundedScore,
    label,
    breakdown: {
      netMarginScore: Math.round(netMarginScore),
      deliveryRateScore: Math.round(deliveryRateScore),
      roasScore: Math.round(roasScore),
      volumeTrendScore: Math.round(volumeTrendScore),
    },
  };
}
