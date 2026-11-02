import {
  calculateBreakEvenPrice,
  calculatePriceForTargetMargin,
  generatePriceCurve,
  calculateRecommendedBand,
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

  describe('Price curve with elasticity', () => {
    it('generates curve with specified steps', () => {
      const curve = generatePriceCurve(28000, 14000, 100000, 100, -1.5, 10);
      expect(curve.length).toBe(11); // 10 steps + 1
    });

    it('higher prices reduce volume with negative elasticity', () => {
      const curve = generatePriceCurve(28000, 14000, 100000, 100, -1.5, 20);

      // With elasticity -1.5, optimal price exists in the middle
      // Profit should peak somewhere in the middle, not at extremes
      const profits = curve.map((c) => c.profitMillimes);
      const maxProfit = Math.max(...profits);
      const maxProfitIndex = profits.indexOf(maxProfit);

      // Max profit should not be at the extreme ends
      expect(maxProfitIndex).toBeGreaterThan(2);
      expect(maxProfitIndex).toBeLessThan(curve.length - 3);
    });

    it('elasticity 0 means constant volume', () => {
      const curve = generatePriceCurve(10000, 5000, 50000, 100, 0, 5);

      // With elasticity 0, profit increases linearly with price
      for (let i = 1; i < curve.length; i++) {
        const margin1 = curve[i].priceMillimes - 15000;
        const margin0 = curve[i - 1].priceMillimes - 15000;
        const profitDiff = curve[i].profitMillimes - curve[i - 1].profitMillimes;
        const expectedDiff = (margin1 - margin0) * 100;
        expect(Math.abs(profitDiff - expectedDiff)).toBeLessThan(1000); // rounding tolerance
      }
    });
  });

  describe('Recommended band', () => {
    it('is 10% above breakEven and targetMargin', () => {
      const band = calculateRecommendedBand(42000, 60000);
      expect(band.minMillimes).toBe(46200); // 42000 * 1.1
      expect(band.maxMillimes).toBe(66000); // 60000 * 1.1
    });
  });
});
