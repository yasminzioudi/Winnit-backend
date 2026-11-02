/**
 * Rule-based insights provider.
 * ZERO Nest/Mongoose imports.
 * 
 * Each insight: severity, title, evidence, suggested action, deep-link.
 * Thresholds configurable.
 */

export type InsightSeverity = 'critical' | 'warning' | 'info';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  evidence: string;
  suggestedAction: string;
  deepLink?: string;
}

export interface InsightThresholds {
  refusalRateThreshold: number; // e.g. 0.25 for 25%
  roasBelowBreakEvenThreshold: number; // e.g. 0.9 (90% of breakeven)
  pendingPayoutsAgeDays: number; // e.g. 14
}

export const DEFAULT_THRESHOLDS: InsightThresholds = {
  refusalRateThreshold: 0.25,
  roasBelowBreakEvenThreshold: 0.9,
  pendingPayoutsAgeDays: 14,
};

/**
 * Rule: refusal rate above threshold per courier/governorate
 */
export function checkRefusalRate(
  delivered: number,
  refused: number,
  courier: string,
  threshold: number,
): Insight | null {
  const total = delivered + refused;
  if (total === 0) return null;

  const refusalRate = refused / total;
  if (refusalRate > threshold) {
    return {
      id: `refusal-rate-${courier}`,
      severity: 'warning',
      title: `Taux de refus élevé (${courier})`,
      evidence: `${Math.round(refusalRate * 100)}% de refus (${refused}/${total})`,
      suggestedAction: `Analyser les raisons de refus avec ${courier}`,
      deepLink: `/dashboard/profit-os/cod?courier=${courier}`,
    };
  }

  return null;
}

/**
 * Rule: ROAS below break-even for a product
 */
export function checkROASBelowBreakEven(
  productId: string,
  productName: string,
  actualROAS: number,
  breakEvenROAS: number,
  threshold: number,
): Insight | null {
  if (actualROAS < breakEvenROAS * threshold) {
    return {
      id: `roas-below-breakeven-${productId}`,
      severity: 'critical',
      title: `ROAS sous le seuil de rentabilité (${productName})`,
      evidence: `ROAS ${actualROAS.toFixed(2)} < seuil ${breakEvenROAS.toFixed(2)}`,
      suggestedAction: 'Réduire le CPA ou augmenter le prix',
      deepLink: `/dashboard/profit-os/winners?product=${productId}`,
    };
  }

  return null;
}

/**
 * Rule: Pending payouts older than N days
 */
export function checkPendingPayoutsAge(
  pendingPayoutsMillimes: number,
  oldestPayoutAgeDays: number,
  threshold: number,
): Insight | null {
  if (oldestPayoutAgeDays > threshold && pendingPayoutsMillimes > 0) {
    return {
      id: 'pending-payouts-old',
      severity: 'warning',
      title: 'Paiements en attente depuis longtemps',
      evidence: `${(pendingPayoutsMillimes / 1000).toFixed(0)} TND en attente depuis ${oldestPayoutAgeDays} jours`,
      suggestedAction: 'Réconcilier les paiements avec le transporteur',
      deepLink: '/dashboard/profit-os/cod',
    };
  }

  return null;
}
