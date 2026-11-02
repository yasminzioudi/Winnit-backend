import {
  calculateBreakEvenPrice,
  calculatePriceForTargetMargin,
  generatePriceCurve,
  recommendPriceBand,
  calculateElasticOptimum,
  estimateDemandAtPrice,
} from './pricing';

describe('Pricing Optimizer', () => {
  describe('Break-even price', () => {
    it('equals COGS + logistics', () => {
      const breakEven = calculateBreakEvenPrice(28000, 14000);
      expect(breakEven).toBe(42000);
    });
  });

  describe('Price for target margin', () => {
    it('calculates price for 30% margin', () => {
      // 30% margin: price = (28 + 14) / (1 - 0.3) = 42 / 0.7 = 60
      const price = calculatePriceForTargetMargin(28000, 14000, 30);
      expect(price).toBe(60000);
    });

    it('calculates price for 50% margin', () => {
      // 50% margin: price = 42 / 0.5 = 84
      const price = calculatePriceForTargetMargin(28000, 14000, 50);
      expect(price).toBe(84000);
    });

    it('returns 0 for invalid margin >= 100%', () => {
      const price = calculatePriceForTargetMargin(28000, 14000, 100);
      expect(price).toBe(0);
    });

    it('returns 0 for negative margin', () => {
      const price = calculatePriceForTargetMargin(28000, 14000, -10);
      expect(price).toBe(0);
    });
  });

  describe('Price curve with elasticity and refusal sensitivity', () => {
    it('generates curve with specified steps', () => {
      const curve = generatePriceCurve(28000, 14000, 100000, 100, -1.5, 10);
      expect(curve.length).toBe(11); // 10 steps + 1
    });

    it('higher prices increase refusal rate', () => {
      const curve = generatePriceCurve(28000, 14000, 100000, 100, -1.5, 20, 0.2, 0.005);

      // Refusal rate should increase with price
      const lowPriceEntry = curve[0]; // Lowest price
      const highPriceEntry = curve[curve.length - 1]; // Highest price

      expect(highPriceEntry.refusalRate).toBeGreaterThan(lowPriceEntry.refusalRate);
    });

    it('higher refusal sensitivity reduces profit at high prices', () => {
      // Low sensitivity
      const curveLowSens = generatePriceCurve(28000, 14000, 100000, 100, -1.5, 20, 0.2, 0.001);
      // High sensitivity
      const curveHighSens = generatePriceCurve(28000, 14000, 100000, 100, -1.5, 20, 0.2, 0.01);

      // At high price point, high sensitivity should have lower profit
      const highPriceIdxLow = curveLowSens[curveLowSens.length - 1];
      const highPriceIdxHigh = curveHighSens[curveHighSens.length - 1];

      expect(highPriceIdxHigh.profitMillimes).toBeLessThan(highPriceIdxLow.profitMillimes);
    });

    it('refusal rate is bounded to [0, 1]', () => {
      const curve = generatePriceCurve(28000, 14000, 100000, 100, -1.5, 20, 0.2, 0.05);

      curve.forEach((point) => {
        expect(point.refusalRate).toBeGreaterThanOrEqual(0);
        expect(point.refusalRate).toBeLessThanOrEqual(1);
      });
    });

    it('elasticity 0 means constant volume before refusals', () => {
      const curve = generatePriceCurve(10000, 5000, 50000, 100, 0, 5, 0, 0);

      // With elasticity 0 and no refusals, profit increases linearly with price
      for (let i = 1; i < curve.length; i++) {
        const margin1 = curve[i].priceMillimes - 15000;
        const margin0 = curve[i - 1].priceMillimes - 15000;
        const profitDiff = curve[i].profitMillimes - curve[i - 1].profitMillimes;
        const expectedDiff = (margin1 - margin0) * 100;
        expect(Math.abs(profitDiff - expectedDiff)).toBeLessThan(1000); // rounding tolerance
      }
    });
  });

  describe('Elastic optimum (unconstrained)', () => {
    it('with elasticity -1.5, optimum ≈ 3x unit cost', () => {
      const unitCost = 42000; // 28 + 14
      const optimum = calculateElasticOptimum({
        unitCostMillimes: unitCost,
        baseRefusalRate: 0.2,
        refusalSensitivity: 0.002,
        elasticity: -1.5,
      });

      // Formula: unitCost / (1 + 1/(-1.5)) = unitCost / (1 - 0.667) = unitCost / 0.333 ≈ 3x
      const expected = Math.round(unitCost / (1 + 1 / -1.5));
      expect(optimum).toBe(expected);
      expect(optimum).toBeGreaterThan(unitCost * 2.5);
      expect(optimum).toBeLessThan(unitCost * 3.5);
    });

    it('with elasticity -2, optimum = 2x unit cost', () => {
      const unitCost = 50000;
      const optimum = calculateElasticOptimum({
        unitCostMillimes: unitCost,
        baseRefusalRate: 0.15,
        refusalSensitivity: 0.001,
        elasticity: -2,
      });

      // Formula: unitCost / (1 + 1/(-2)) = unitCost / 0.5 = 2x
      expect(optimum).toBe(unitCost * 2);
    });

    it('with elasticity >= -1, returns 3x fallback', () => {
      const unitCost = 30000;
      const optimum = calculateElasticOptimum({
        unitCostMillimes: unitCost,
        baseRefusalRate: 0.25,
        refusalSensitivity: 0.003,
        elasticity: -0.8,
      });

      // No finite optimum, fallback to 3x
      expect(optimum).toBe(unitCost * 3);
    });
  });

  describe('Recommended price band (bounded, with refusal sensitivity)', () => {
    it('bounds optimum to realistic range around current price', () => {
      const currentPrice = 129000;
      const unitCost = 42000;
      const band = recommendPriceBand(currentPrice, -1.5, unitCost);

      // Default constraints: -20% to +30% of current
      expect(band.minMillimes).toBe(Math.round(currentPrice * 0.8)); // 103200
      expect(band.maxMillimes).toBeLessThanOrEqual(Math.round(currentPrice * 1.3)); // <= 167700
      expect(band.maxMillimes).toBeGreaterThanOrEqual(band.minMillimes);
      expect(band.label).toBe('modèle basé sur vos hypothèses');
    });

    it('higher refusal sensitivity lowers recommended max price', () => {
      const currentPrice = 100000;
      const unitCost = 35000;

      // Low sensitivity: 0.1% refusal increase per TND
      const bandLowSens = recommendPriceBand(currentPrice, -1.5, unitCost, 0.15, 0.001);
      // High sensitivity: 2% refusal increase per TND  
      const bandHighSens = recommendPriceBand(currentPrice, -1.5, unitCost, 0.15, 0.02);

      // At +30k (130k total), low sens: 0.15 + 0.001 * 30 = 0.18 (18% refusal)
      // At +30k (130k total), high sens: 0.15 + 0.02 * 30 = 0.75 (75% refusal)
      // High sensitivity should trigger the 50% refusal penalty and reduce max
      expect(bandHighSens.maxMillimes).toBeLessThan(bandLowSens.maxMillimes);
    });

    it('clamps unconstrained optimum if it exceeds bounds', () => {
      const currentPrice = 50000; // Very low current price
      const unitCost = 42000;
      const band = recommendPriceBand(currentPrice, -1.5, unitCost);

      // Unconstrained optimum ≈ 126k, but max bound is 50k * 1.3 = 65k
      expect(band.maxMillimes).toBeLessThanOrEqual(65000);
    });

    it('uses custom constraints when provided', () => {
      const currentPrice = 100000;
      const unitCost = 35000;
      const band = recommendPriceBand(currentPrice, -1.5, unitCost, 0.2, 0.002, {
        minRelativeToCurrent: 0.9, // -10%
        maxRelativeToCurrent: 1.2, // +20%
      });

      expect(band.minMillimes).toBe(90000);
      expect(band.maxMillimes).toBeLessThanOrEqual(120000);
    });

    it('refusal sensitivity reduces max when projected refusal exceeds 50%', () => {
      const currentPrice = 100000;
      const unitCost = 40000;
      
      // Very high sensitivity: at +30%, refusal would be 0.2 + 0.02 * 30 = 0.8 (80%)
      const bandHighSens = recommendPriceBand(currentPrice, -1.5, unitCost, 0.2, 0.02);
      
      // Should be significantly reduced from the 130k max bound
      expect(bandHighSens.maxMillimes).toBeLessThan(120000);
    });
  });

  describe('Estimate demand at new price', () => {
    it('with elasticity -1.5, 10% price increase → 15% volume decrease', () => {
      const basePrice = 100000;
      const baseVolume = 100;
      const newPrice = 110000; // +10%
      const elasticity = -1.5;

      const newVolume = estimateDemandAtPrice(basePrice, baseVolume, newPrice, elasticity);

      // (1.1)^(-1.5) ≈ 0.852, so volume ≈ 85.2
      expect(newVolume).toBeGreaterThan(80);
      expect(newVolume).toBeLessThan(90);
    });

    it('with elasticity 0, volume remains constant', () => {
      const baseVolume = 100;
      const newVolume = estimateDemandAtPrice(100000, baseVolume, 150000, 0);
      expect(newVolume).toBe(baseVolume);
    });
  });
});
