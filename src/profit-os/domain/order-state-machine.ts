/**
 * Order state machine: allowed transitions, reopen rule.
 * ZERO Nest/Mongoose imports.
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'refused'
  | 'cancelled';

/**
 * State machine rules:
 * - pending → confirmed | cancelled
 * - confirmed → shipped | cancelled
 * - shipped → delivered | refused
 * - delivered and refused are terminal (except reopen)
 * - cancelled is terminal
 */
export function isTransitionAllowed(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['delivered', 'refused'],
    delivered: [],
    refused: [],
    cancelled: [],
  };

  return transitions[from]?.includes(to) ?? false;
}

/**
 * Reopen rule: refused → delivered (audited action only, never automatic)
 */
export function canReopen(status: OrderStatus): boolean {
  return status === 'refused';
}

/**
 * Validate transition or throw
 */
export function validateTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!isTransitionAllowed(from, to)) {
    throw new Error(
      `Illegal state transition: ${from} → ${to}`,
    );
  }
}
