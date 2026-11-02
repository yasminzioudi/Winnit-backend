import {
  checkRefusalRate,
  checkROASBelowBreakEven,
  checkPendingPayoutsAge,
} from './insights';

describe('Insights Rules', () => {
  describe('Refusal rate check', () => {
    it('returns insight when rate exceeds threshold', () => {
      const insight = checkRefusalRate(70, 30, 'Aramex', 0.25);

      expect(insight).not.toBeNull();
      expect(insight!.severity).toBe('warning');
      expect(insight!.title).toContain('Taux de refus élevé');
      expect(insight!.evidence).toContain('30%');
    });

    it('returns null when rate is below threshold', () => {
      const insight = checkRefusalRate(80, 20, 'Yalidine', 0.25);

      expect(insight).toBeNull();
    });

    it('returns null when total is zero', () => {
      const insight = checkRefusalRate(0, 0, 'Aramex', 0.25);

      expect(insight).toBeNull();
    });
  });

  describe('ROAS below break-even check', () => {
    it('returns critical insight when ROAS is below threshold', () => {
      const insight = checkROASBelowBreakEven(
        'prd_001',
        'Test Product',
        1.2,
        2.0,
        0.9,
      );

      expect(insight).not.toBeNull();
      expect(insight!.severity).toBe('critical');
      expect(insight!.title).toContain('ROAS sous le seuil');
      expect(insight!.evidence).toContain('1.20');
    });

    it('returns null when ROAS is above threshold', () => {
      const insight = checkROASBelowBreakEven(
        'prd_001',
        'Test Product',
        1.9,
        2.0,
        0.9,
      );

      expect(insight).toBeNull();
    });
  });

  describe('Pending payouts age check', () => {
    it('returns warning when payouts are old', () => {
      const insight = checkPendingPayoutsAge(500000, 20, 14);

      expect(insight).not.toBeNull();
      expect(insight!.severity).toBe('warning');
      expect(insight!.title).toContain('Paiements en attente');
      expect(insight!.evidence).toContain('20 jours');
    });

    it('returns null when age is below threshold', () => {
      const insight = checkPendingPayoutsAge(500000, 10, 14);

      expect(insight).toBeNull();
    });

    it('returns null when pending amount is zero', () => {
      const insight = checkPendingPayoutsAge(0, 20, 14);

      expect(insight).toBeNull();
    });
  });
});
