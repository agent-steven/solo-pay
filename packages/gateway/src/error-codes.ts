/**
 * Centralized error codes for the gateway API.
 * Use these constants instead of hardcoded strings in route handlers.
 *
 * The widget maps these codes to locale-specific messages (see widget i18n.ts).
 */
export const ErrorCodes = {
  // ── Authentication / Authorization ─────────────────────────────────
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // ── Input Validation ───────────────────────────────────────────────
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_CURRENCY: 'INVALID_CURRENCY',

  // ── Payment ────────────────────────────────────────────────────────
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
  INVALID_PAYMENT_STATUS: 'INVALID_PAYMENT_STATUS',
  INVALID_STATUS: 'INVALID_STATUS',
  DUPLICATE_ORDER: 'DUPLICATE_ORDER',
  PAYMENT_NOT_PAID: 'PAYMENT_NOT_PAID',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  PAYMENT_ALREADY_REFUNDED: 'PAYMENT_ALREADY_REFUNDED',
  CONFLICT: 'CONFLICT',

  // ── Chain / Network ────────────────────────────────────────────────
  CHAIN_NOT_FOUND: 'CHAIN_NOT_FOUND',
  CHAIN_NOT_CONFIGURED: 'CHAIN_NOT_CONFIGURED',
  CHAIN_CONFIG_ERROR: 'CHAIN_CONFIG_ERROR',
  UNSUPPORTED_CHAIN: 'UNSUPPORTED_CHAIN',
  CHAIN_MISMATCH: 'CHAIN_MISMATCH',

  // ── Token ──────────────────────────────────────────────────────────
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  TOKEN_NOT_ENABLED: 'TOKEN_NOT_ENABLED',
  UNSUPPORTED_TOKEN: 'UNSUPPORTED_TOKEN',
  TOKEN_INFO_ERROR: 'TOKEN_INFO_ERROR',

  // ── Merchant / Configuration ───────────────────────────────────────
  MERCHANT_CHAIN_NOT_CONFIGURED: 'MERCHANT_CHAIN_NOT_CONFIGURED',
  RECIPIENT_NOT_CONFIGURED: 'RECIPIENT_NOT_CONFIGURED',
  PAYMENT_METHOD_EXISTS: 'PAYMENT_METHOD_EXISTS',
  PRICE_SERVICE_NOT_CONFIGURED: 'PRICE_SERVICE_NOT_CONFIGURED',

  // ── Relay / Gasless ────────────────────────────────────────────────
  RELAY_ALREADY_SUBMITTED: 'RELAY_ALREADY_SUBMITTED',
  RELAY_NOT_FOUND: 'RELAY_NOT_FOUND',
  RELAYER_NOT_CONFIGURED: 'RELAYER_NOT_CONFIGURED',
  RELAYER_ERROR: 'RELAYER_ERROR',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',

  // ── Signature / Signing ────────────────────────────────────────────
  SIGNATURE_ERROR: 'SIGNATURE_ERROR',
  SIGNING_SERVICE_ERROR: 'SIGNING_SERVICE_ERROR',
  PAYER_ADDRESS_NOT_FOUND: 'PAYER_ADDRESS_NOT_FOUND',

  // ── Refund ─────────────────────────────────────────────────────────
  REFUND_NOT_FOUND: 'REFUND_NOT_FOUND',
  REFUND_IN_PROGRESS: 'REFUND_IN_PROGRESS',

  // ── General ────────────────────────────────────────────────────────
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
