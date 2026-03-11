/**
 * Generic webhook body for any payment status change.
 * Fields are a superset – only relevant fields will be populated per event.
 */
export interface PaymentWebhookBody {
  paymentId: string;
  orderId: string | null;
  status: string;
  txHash: string | null;
  amount: string;
  tokenSymbol: string;
  /** ISO-8601 timestamp (present on PAID) */
  paidAt?: string;
}

/**
 * Job data for webhook queue: URL and body to POST.
 */
export interface WebhookJobData {
  url: string;
  body: PaymentWebhookBody;
}

export const WEBHOOK_QUEUE_NAME = 'solo-pay-webhook';

// Job name constants
export const JOB_NAME_PAYMENT_PAID = 'payment.paid';
export const JOB_NAME_PAYMENT_INVALID = 'payment.invalid';
