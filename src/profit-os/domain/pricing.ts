/**
 * Pricing optimizer domain functions.
 * ZERO Nest/Mongoose imports. Integer millimes.
 * 
 * Outputs labeled as "modèle basé sur vos hypothèses" (user assumptions, not predictions).
 * Explicit, user-editable elasticity (default -1.5) and refusal sensitivity.
 */

export interface PricingConstraints {
  minRelativeToCurrent?: number; // default 0.8 (-20%)
  maxRelativeToCurrent?: number; // default 1.3 (+30%)
}

export interface ElasticOptimumInput {
  unitCostMillimes: number; // COGS + logistics
  baseRefusalRate: number; // 0..1, at current price
  refusalSensitivity: number; // refusal rate increase per TND price increase (e.g., 0.002)
  elasticity: number; // demand elasticity (e.g., -1.5)
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
 * Profit-vs-price curve using demand elasticity and refusal sensitivity.
 * Profit = (price - COGS - logistics) * volume(price) * (1 - refusalRate(price))
 * volume(price) = baseVolume * (price / basePrice) ^ elasticity
 * refusalRate(price) = min(1, baseRefusalRate + refusalSensitivity * (price - basePrice) / 1000)
 * 
 * Default elasticity: -1.5 (1% price increase → 1.5% volume decrease)
 * Default refusal sensitivity: 0.002 (2% refusal increase per 1 TND price increase)
 */
export function generatePriceCurve(
  cogsMillimes: number,
  logisticsMillimes: number,
  basePriceMillimes: number,
  baseVolume: number,
  elasticity: number,
  steps: number = 20,
  baseRefusalRate: number = 0.2,
  refusalSensitivity: number = 0.002,
  cpaMillimes: number = 0,
): Array<{ priceMillimes: number; profitMillimes: number; refusalRate: number }> {
  const curve: Array<{ priceMillimes: number; profitMillimes: number; refusalRate: number }> = [];
  const minPrice = Math.round(basePriceMillimes * 0.5);
  const maxPrice = Math.round(basePriceMillimes * 1.5);
  const priceStep = Math.round((maxPrice - minPrice) / steps);

  for (let price = minPrice; price <= maxPrice; price += priceStep) {
    // Refusal rate increases with price above base
    const priceDeltaTND = (price - basePriceMillimes) / 1000;
    const rawRefusalRate = Math.min(1, Math.max(0, baseRefusalRate + refusalSensitivity * priceDeltaTND));
    const refusalRate = Math.round(rawRefusalRate * 10000) / 10000;

    const unitMargin = price - cogsMillimes - logisticsMillimes - cpaMillimes;
    const volumeMultiplier = Math.pow(price / basePriceMillimes, elasticity);
    const estimatedVolume = baseVolume * volumeMultiplier;
    
    // Realized volume after refusals
    const realizedVolume = estimatedVolume * (1 - refusalRate);
    const totalProfit = Math.round(unitMargin * realizedVolume);

    curve.push({
      priceMillimes: price,
      profitMillimes: totalProfit,
      refusalRate,
    });
  }

  return curve;
}

/**
 * Recommended price band: bounded by constraints around current price.
 * With elasticity -1.5, unconstrained optimum ≈ 3x unit cost, but we bound to realistic range.
 * Refusal sensitivity reduces recommended max (higher sensitivity → lower recommended price).
 * 
 * @param currentPriceMillimes - Current selling price
 * @param elasticity - Demand elasticity (e.g., -1.5)
 * @param unitCostMillimes - COGS + logistics
 * @param baseRefusalRate - Refusal rate at current price (0..1)
 * @param refusalSensitivity - Refusal increase per TND price increase (e.g., 0.002 = 0.2% per TND)
 * @param constraints - Relative bounds (default: -20% to +30% of current)
 */
export function recommendPriceBand(
  currentPriceMillimes: number,
  elasticity: number,
  unitCostMillimes: number,
  baseRefusalRate: number = 0.2,
  refusalSensitivity: number = 0.002,
  constraints?: PricingConstraints,
): { minMillimes: number; maxMillimes: number; label: string } {
  const minRelative = constraints?.minRelativeToCurrent ?? 0.8;
  const maxRelative = constraints?.maxRelativeToCurrent ?? 1.3;

  // Calculate unconstrained elastic optimum: price = unitCost / (1 + 1/elasticity)
  // For elasticity -1.5: price = unitCost / (1 - 1/1.5) = unitCost / (1 - 0.667) = unitCost / 0.333 ≈ 3x unitCost
  const unconstrainedOptimum =
    elasticity < 0 ? Math.round(unitCostMillimes / (1 + 1 / elasticity)) : currentPriceMillimes;

  // Bound to realistic range around current price
  const minMillimes = Math.round(currentPriceMillimes * minRelative);
  const maxBoundMillimes = Math.round(currentPriceMillimes * maxRelative);

  // Clamp optimum within bounds
  let boundedOptimum = Math.max(minMillimes, Math.min(maxBoundMillimes, unconstrainedOptimum));

  // Apply refusal sensitivity penalty: higher sensitivity reduces max recommendation
  // At max bound, refusal rate would be: baseRefusalRate + sensitivity * (maxBound - current) / 1000
  const maxBoundRefusal = baseRefusalRate + refusalSensitivity * (maxBoundMillimes - currentPriceMillimes) / 1000;
  
  // If refusal at max bound would exceed 50%, reduce the max recommendation
  if (maxBoundRefusal > 0.5) {
    // Scale down bounded optimum proportionally
    const refusalPenaltyFactor = Math.min(1, 0.5 / maxBoundRefusal);
    boundedOptimum = Math.round(currentPriceMillimes + (boundedOptimum - currentPriceMillimes) * refusalPenaltyFactor);
  }

  return {
    minMillimes,
    maxMillimes: boundedOptimum, // Use clamped optimum as max recommendation
    label: 'modèle basé sur vos hypothèses',
  };
}

/**
 * Calculate elastic optimum (unconstrained theoretical maximum profit price).
 * With constant elasticity ε < -1, optimal price = unitCost / (1 + 1/ε)
 * Example: elasticity -1.5 → optimal ≈ 3x unit cost
 * 
 * Refusal sensitivity reduces the effective price (customers willing to pay less if refusal risk increases).
 */
export function calculateElasticOptimum(input: ElasticOptimumInput): number {
  const { unitCostMillimes, elasticity } = input;

  if (elasticity >= -1) {
    // Elasticity >= -1 means no finite optimum (profit increases indefinitely with price)
    return unitCostMillimes * 3; // Fallback to 3x
  }

  // Unconstrained optimum
  const optimum = Math.round(unitCostMillimes / (1 + 1 / elasticity));
  return optimum;
}

/**
 * Estimate demand at a new price given elasticity.
 * volume(newPrice) = baseVolume * (newPrice / basePrice) ^ elasticity
 */
export function estimateDemandAtPrice(
  basePriceMillimes: number,
  baseVolume: number,
  newPriceMillimes: number,
  elasticity: number,
): number {
  const priceRatio = newPriceMillimes / basePriceMillimes;
  return Math.round(baseVolume * Math.pow(priceRatio, elasticity));
}
