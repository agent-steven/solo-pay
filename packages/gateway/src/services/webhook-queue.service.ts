import type { Payment } from '@solo-pay/database';
import type { Merchant } from '@solo-pay/database';
import type { PaymentWebhookBody, WebhookJobData } from '@solo-pay/webhook-manager';
import { JOB_NAME_PAYMENT_PAID, JOB_NAME_PAYMENT_INVALID } from '@solo-pay/webhook-manager';

export interface WebhookQueueAdapter {
  addPaymentEvent(jobName: string, data: WebhookJobData): Promise<void>;
}

/**
 * Callback when webhook enqueue fails (for logging). Receives error and payment hash.
 */
export type WebhookEnqueueErrorLogger = (err: unknown, paymentId: string) => void;

/** Map payment status to BullMQ job name */
const STATUS_JOB_MAP: Record<string, string | undefined> = {
  PAID: JOB_NAME_PAYMENT_PAID,
  INVALID: JOB_NAME_PAYMENT_INVALID,
};

/**
 * Generic webhook enqueue: resolves URL, builds body, and enqueues (fire-and-forget).
 * Automatically selects the correct job name based on payment.status.
 */
export function enqueuePaymentWebhook(
  webhookQueue: WebhookQueueAdapter,
  payment: Payment,
  merchant: Merchant | null,
  onError: WebhookEnqueueErrorLogger
): void {
  const webhookUrl = resolveWebhookUrl(payment, merchant);
  if (!webhookUrl) return;

  const jobName = STATUS_JOB_MAP[payment.status];
  if (!jobName) return;

  webhookQueue
    .addPaymentEvent(jobName, {
      url: webhookUrl,
      body: buildPaymentWebhookBody(payment),
    })
    .catch((err) => onError(err, payment.payment_hash));
}

/**
 * Resolve webhook URL: payment.webhook_url ?? merchant.webhook_url.
 * Returns null if neither is set.
 */
export function resolveWebhookUrl(payment: Payment, merchant: Merchant | null): string | null {
  if (payment.webhook_url) return payment.webhook_url;
  if (merchant?.webhook_url) return merchant.webhook_url;
  return null;
}

/**
 * Build generic webhook body from a Payment record.
 */
export function buildPaymentWebhookBody(payment: Payment): PaymentWebhookBody {
  return {
    paymentId: payment.payment_hash,
    orderId: payment.order_id ?? null,
    status: payment.status,
    txHash: payment.tx_hash ?? null,
    amount: payment.amount.toString(),
    tokenSymbol: payment.token_symbol,
    paidAt: payment.confirmed_at ? new Date(payment.confirmed_at).toISOString() : undefined,
  };
}
