import { PricingService } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  it('should optimize pricing with default elasticity and refusal sensitivity', () => {
    const res = service.optimize({
      basePriceMillimes: 129000,
      cogsMillimes: 28000,
      logisticsMillimes: 14000,
      baseVolume: 100,
      elasticity: -1.5,
      baseRefusalRate: 0.2,
      refusalSensitivity: 0.002,
      targetMarginPercent: 50,
    });

    expect(res.basePriceMillimes).toBe(129000);
    expect(res.unitCostMillimes).toBe(42000);
    expect(res.breakEvenPriceMillimes).toBe(42000);
    expect(res.targetMarginPriceMillimes).toBe(84000); // 42000 / (1 - 0.5) = 84000
    expect(res.recommendedBand.minMillimes).toBeLessThanOrEqual(res.basePriceMillimes);
    expect(res.recommendedBand.label).toBe('modèle basé sur vos hypothèses');
    expect(res.disclaimer).toBe('modèle basé sur vos hypothèses');
    expect(res.curve.length).toBeGreaterThan(10);

    // Verify optimum == argmax(curve)
    const curveMax = res.curve.reduce((best, pt) =>
      pt.profitMillimes > best.profitMillimes ? pt : best,
    res.curve[0]);
    expect(res.elasticOptimumMillimes).toBe(curveMax.priceMillimes);

    // Verify refusalRate has at most 4 decimals
    for (const point of res.curve) {
      expect(Math.round(point.refusalRate * 10000) / 10000).toBe(point.refusalRate);
    }
  });

  it('optimum matches argmax(curve) when CPA is provided', () => {
    const res = service.optimize({
      basePriceMillimes: 129000,
      cogsMillimes: 28000,
      logisticsMillimes: 14000,
      cpaMillimes: 20000,
      baseVolume: 100,
      elasticity: -1.8,
      baseRefusalRate: 0.22,
      refusalSensitivity: 0.003,
    });

    const curveMax = res.curve.reduce((best, pt) =>
      pt.profitMillimes > best.profitMillimes ? pt : best,
    res.curve[0]);
    expect(res.elasticOptimumMillimes).toBe(curveMax.priceMillimes);
    expect(res.unitCostMillimes).toBe(62000); // 28000 + 14000 + 20000
  });
});

