export const OrderStatus = Object.freeze({
  CUTTING: 'CUTTING_IN_PROGRESS',
  PENDING: 'PENDING_VERIFICATION',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  SEWING: 'SEWING'
});

export class DomainError extends Error {
  constructor(message, status = 422, code = 'DOMAIN_RULE_VIOLATION') {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}

export function componentStatus(actual, expected) {
  if (actual === expected) return 'GREEN';
  return actual > expected ? 'YELLOW' : 'RED';
}

export function requirePending(order) {
  if (!order || order.status !== OrderStatus.PENDING) {
    throw new DomainError('Order is not pending verification', 409, 'INVALID_ORDER_STATE');
  }
}

export function requireApprovable(verificationItems) {
  if (!verificationItems.length || verificationItems.some(item => item.actual_qty === null || !item.status || item.status === 'RED')) {
    throw new DomainError('All components must be counted with no shortages', 422, 'VERIFICATION_HARD_STOP');
  }
}
