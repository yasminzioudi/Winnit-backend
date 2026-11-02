import {
  calculateWinnerScore,
  type ProductMetrics,
} from './winners';

describe('Winners Scoring', () => {
  describe('Insufficient data', () => {
    it('< 20 orders returns "Données insuffisantes" with score 0', () => {
      const metrics: ProductMetrics = {
        productId: 'prd_001',
        totalOrders: 15,
        deliveredOrders: 12,
        refusedOrders: 3,
        netMarginPercent: 40,
        breakEvenROAS: 1.5,
        actualROAS: 2.0,
        volumeTrend30Days: 0.2,
      };

      const result = calculateWinnerScore(metrics);

      expect(result.label).toBe('Données insuffisantes');
      expect(result.score).toBe(0);
    });

    it('exactly 20 orders is sufficient', () => {
      const metrics: ProductMetrics = {
        productId: 'prd_001',
        totalOrders: 20,
        deliveredOrders: 18,
        refusedOrders: 2,
        netMarginPercent: 40,
        breakEvenROAS: 1.5,
        actualROAS: 2.0,
        volumeTrend30Days: 0.2,
      };

      const result = calculateWinnerScore(metrics);

      expect(result.label).not.toBe('Données insuffisantes');
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Winner labels', () => {
    it('score >= 75 is labeled "Winner"', () => {
      const metrics: ProductMetrics = {
        productId: 'prd_001',
        totalOrders: 100,
        deliveredOrders: 90,
        refusedOrders: 10,
        netMarginPercent: 45, // high margin
        breakEvenROAS: 1.5,
        actualROAS: 3.0, // 2x breakeven
        volumeTrend30Days: 0.5, // growing
      };

      const result = calculateWinnerScore(metrics);

      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.label).toBe('Winner');
    });

    it('score 50-74 is labeled "À surveiller"', () => {
      const metrics: ProductMetrics = {
        productId: 'prd_002',
        totalOrders: 50,
        deliveredOrders: 40,
        refusedOrders: 10,
        netMarginPercent: 25, // moderate margin
        breakEvenROAS: 1.5,
        actualROAS: 1.8, // slightly above breakeven
        volumeTrend30Days: 0, // flat
      };

      const result = calculateWinnerScore(metrics);

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(75);
      expect(result.label).toBe('À surveiller');
    });

    it('score < 50 is labeled "À couper"', () => {
      const metrics: ProductMetrics = {
        productId: 'prd_003',
        totalOrders: 80,
        deliveredOrders: 40,
        refusedOrders: 40,
        netMarginPercent: 10, // low margin
        breakEvenROAS: 2.0,
        actualROAS: 1.2, // below breakeven
        volumeTrend30Days: -0.5, // declining
      };

      const result = calculateWinnerScore(metrics);

      expect(result.score).toBeLessThan(50);
      expect(result.label).toBe('À couper');
    });
  });

  describe('Score breakdown', () => {
    it('netMargin 0% = 0, 50% = 100', () => {
      const metrics50: ProductMetrics = {
        productId: 'prd_001',
        totalOrders: 50,
        deliveredOrders: 50,
        refusedOrders: 0,
        netMarginPercent: 50,
        breakEvenROAS: 1,
        actualROAS: 1,
        volumeTrend30Days: 0,
      };

      const result50 = calculateWinnerScore(metrics50);
      expect(result50.breakdown.netMarginScore).toBe(100);

      const metrics0: ProductMetrics = {
        ...metrics50,
        netMarginPercent: 0,
      };

      const result0 = calculateWinnerScore(metrics0);
      expect(result0.breakdown.netMarginScore).toBe(0);
    });

    it('delivery rate = delivered / (delivered + refused)', () => {
      const metrics: ProductMetrics = {
        productId: 'prd_001',
        totalOrders: 100,
        deliveredOrders: 80,
        refusedOrders: 20,
        netMarginPercent: 30,
        breakEvenROAS: 1.5,
        actualROAS: 2.0,
        volumeTrend30Days: 0.2,
      };

      const result = calculateWinnerScore(metrics);

      // 80 / (80 + 20) = 0.8 = 80%
      expect(result.breakdown.deliveryRateScore).toBe(80);
    });

    it('ROAS score is proportional to breakeven (1.0x = 50, 2.0x = 100, capped at 100)', () => {
      const metricsBreakeven: ProductMetrics = {
        productId: 'prd_001',
        totalOrders: 50,
        deliveredOrders: 50,
        refusedOrders: 0,
        netMarginPercent: 30,
        breakEvenROAS: 1.5,
        actualROAS: 1.5, // 1x breakeven = 50
        volumeTrend30Days: 0,
      };

      const resultBreakeven = calculateWinnerScore(metricsBreakeven);
      expect(resultBreakeven.breakdown.roasScore).toBe(50);

      const metricsCapped: ProductMetrics = {
        ...metricsBreakeven,
        actualROAS: 3.5, // > 2x breakeven, capped at 100
      };

      const resultCapped = calculateWinnerScore(metricsCapped);
      expect(resultCapped.breakdown.roasScore).toBe(100);
    });

    it('volume trend -1..1 normalizes to 0..100', () => {
      const metricsMinus1: ProductMetrics = {
        productId: 'prd_001',
        totalOrders: 50,
        deliveredOrders: 50,
        refusedOrders: 0,
        netMarginPercent: 30,
        breakEvenROAS: 1.5,
        actualROAS: 2.0,
        volumeTrend30Days: -1, // worst
      };

      const resultMinus1 = calculateWinnerScore(metricsMinus1);
      expect(resultMinus1.breakdown.volumeTrendScore).toBe(0);

      const metricsPlus1: ProductMetrics = {
        ...metricsMinus1,
        volumeTrend30Days: 1, // best
      };

      const resultPlus1 = calculateWinnerScore(metricsPlus1);
      expect(resultPlus1.breakdown.volumeTrendScore).toBe(100);

      const metricsZero: ProductMetrics = {
        ...metricsMinus1,
        volumeTrend30Days: 0, // flat
      };

      const resultZero = calculateWinnerScore(metricsZero);
      expect(resultZero.breakdown.volumeTrendScore).toBe(50);
    });
  });

  describe('Custom weights', () => {
    it('uses custom weights instead of defaults', () => {
      const metrics: ProductMetrics = {
        productId: 'prd_001',
        totalOrders: 50,
        deliveredOrders: 50,
        refusedOrders: 0,
        netMarginPercent: 50,
        breakEvenROAS: 1,
        actualROAS: 1,
        volumeTrend30Days: 0,
      };

      // 100% weight on net margin
      const customWeights = {
        netMarginWeight: 100,
        deliveryRateWeight: 0,
        roasWeight: 0,
        volumeTrendWeight: 0,
      };

      const result = calculateWinnerScore(metrics, customWeights);

      // netMargin 50% = 100 score, 100% weight = 100 total
      expect(result.score).toBe(100);
    });
  });
});
