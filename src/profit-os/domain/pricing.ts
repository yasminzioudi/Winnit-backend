/**
 * Pricing optimizer domain functions.
 * ZERO Nest/Mongoose imports. Integer millimes.
 * 
 * Outputs labeled as "modèle basé sur vos hypothèses" (user assumptions, not predictions).
 * Explicit, user-editable elasticity (default -1.5) and refusal sensitivity.
 */

export interface PricingInput {
  baseCogsMillimes: number;
  baseLogisticsMillimes: number;
  targetMarginPercent: number; // 0..100
  currentPriceMillimes?: number;
  currentVolume?: number;
  demandElasticity?: number; // default -1.5
  refusalSensitivity?: number; // default 0.05 (5% refusal per 10TND price increase)
}

export interface PricingResult {
  breakEvenPriceMillimes: number;
  targetMarginPriceMillimes: number;
  recommendedBandMinMillimes: number;
  recommendedBandMaxMillimes: number;
  priceCurve: Array<{ priceMillimes: number; profitMillimes: number }>;
}

/**
 * Break-even price: price where net profit per unit = 0
 * Formula: COGS + logistics + 0 margin = price
 */
export function calculateBreakEvenPrice(
  cogsMillimes: number,
  logisticsMillimes: number,
): number {
  return cogsMillimes + logisticsMillimes;
}

/**
 * Price for target margin %:
 * target margin = (price - COGS - logistics) / price
 * Solve for price: price = (COGS + logistics) / (1 - targetMarginDecimal)
 */
export function calculatePriceForTargetMargin(
  cogsMillimes: number,
  logisticsMillimes: number,
  targetMarginPercent: number,
): number {
  if (targetMarginPercent >= 100 || targetMarginPercent < 0) {
    return 0;
  }

  const targetMarginDecimal = targetMarginPercent / 100;
  const totalCosts = cogsMillimes + logisticsMillimes;
  return Math.round(totalCosts / (1 - targetMarginDecimal));
}

/**
 * Profit-vs-price curve using demand elasticity.
 * Profit = (price - COGS - logistics) * volume(price)
 * volume(price) = baseVolume * (price / basePrice) ^ elasticity
 * 
 * Default elasticity: -1.5 (1% price increase → 1.5% volume decrease)
 */
export function generatePriceCurve(
  cogsMillimes: number,
  logisticsMillimes: number,
  basePriceMillimes: number,
  baseVolume: number,
  elasticity: number,
  steps: number = 20,
): Array<{ priceMillimes: number; profitMillimes: number }> {
  const curve: Array<{ priceMillimes: number; profitMillimes: number }> = [];
  const minPrice = Math.round(basePriceMillimes * 0.5);
  const maxPrice = Math.round(basePriceMillimes * 1.5);
  const priceStep = Math.round((maxPrice - minPrice) / steps);

  for (let price = minPrice; price <= maxPrice; price += priceStep) {
    const unitMargin = price - cogsMillimes - logisticsMillimes;
    const volumeMultiplier = Math.pow(price / basePriceMillimes, elasticity);
    const estimatedVolume = baseVolume * volumeMultiplier;
    const totalProfit = Math.round(unitMargin * estimatedVolume);

    curve.push({
      priceMillimes: price,
      profitMillimes: totalProfit,
    });
  }

  return curve;
}

/**
 * Recommended price band: [breakEven * 1.1, targetMarginPrice * 1.1]
 */
export function calculateRecommendedBand(
  breakEvenMillimes: number,
  targetMarginMillimes: number,
): { minMillimes: number; maxMillimes: number } {
  return {
    minMillimes: Math.round(breakEvenMillimes * 1.1),
    maxMillimes: Math.round(targetMarginMillimes * 1.1),
  };
}
