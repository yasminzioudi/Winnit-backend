import {
  isTransitionAllowed,
  canReopen,
  validateTransition,
} from './order-state-machine';

describe('Order State Machine', () => {
  describe('Allowed transitions', () => {
    it('pending → confirmed is allowed', () => {
      expect(isTransitionAllowed('pending', 'confirmed')).toBe(true);
    });

    it('pending → cancelled is allowed', () => {
      expect(isTransitionAllowed('pending', 'cancelled')).toBe(true);
    });

    it('confirmed → shipped is allowed', () => {
      expect(isTransitionAllowed('confirmed', 'shipped')).toBe(true);
    });

    it('confirmed → cancelled is allowed', () => {
      expect(isTransitionAllowed('confirmed', 'cancelled')).toBe(true);
    });

    it('shipped → delivered is allowed', () => {
      expect(isTransitionAllowed('shipped', 'delivered')).toBe(true);
    });

    it('shipped → refused is allowed', () => {
      expect(isTransitionAllowed('shipped', 'refused')).toBe(true);
    });
  });

  describe('Illegal transitions', () => {
    it('pending → delivered is not allowed', () => {
      expect(isTransitionAllowed('pending', 'delivered')).toBe(false);
    });

    it('confirmed → delivered is not allowed', () => {
      expect(isTransitionAllowed('confirmed', 'delivered')).toBe(false);
    });

    it('delivered → any is not allowed (terminal)', () => {
      expect(isTransitionAllowed('delivered', 'confirmed')).toBe(false);
      expect(isTransitionAllowed('delivered', 'cancelled')).toBe(false);
    });

    it('refused → any is not allowed (terminal except reopen)', () => {
      expect(isTransitionAllowed('refused', 'confirmed')).toBe(false);
      expect(isTransitionAllowed('refused', 'delivered')).toBe(false);
    });

    it('cancelled → any is not allowed (terminal)', () => {
      expect(isTransitionAllowed('cancelled', 'confirmed')).toBe(false);
      expect(isTransitionAllowed('cancelled', 'pending')).toBe(false);
    });
  });

  describe('Reopen rule', () => {
    it('refused can be reopened', () => {
      expect(canReopen('refused')).toBe(true);
    });

    it('other statuses cannot be reopened', () => {
      expect(canReopen('delivered')).toBe(false);
      expect(canReopen('shipped')).toBe(false);
      expect(canReopen('confirmed')).toBe(false);
      expect(canReopen('pending')).toBe(false);
      expect(canReopen('cancelled')).toBe(false);
    });
  });

  describe('Validate transition', () => {
    it('throws on illegal transition', () => {
      expect(() => validateTransition('pending', 'delivered')).toThrow(
        'Illegal state transition: pending → delivered',
      );
    });

    it('does not throw on legal transition', () => {
      expect(() => validateTransition('pending', 'confirmed')).not.toThrow();
    });
  });
});
