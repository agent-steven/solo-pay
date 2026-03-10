# Webhook

Receive real-time notifications when payment status changes.

## Webhook Overview

When configured, Webhooks send HTTP POST requests to your URL on payment status changes.

## Event Types

| Event             | Status Value | Description                        | When                                   |
| ----------------- | ------------ | ---------------------------------- | -------------------------------------- |
| `payment.paid`    | `PAID`       | Payment confirmed on-chain         | Funds transferred directly to merchant |
| `payment.invalid` | `INVALID`    | On-chain payment validation failed | Amount, token, or recipient mismatch   |

On **PAID**, verify the order details and complete the order. On **INVALID**, flag the order for review.

## Payload Structure

Webhook payloads are sent as a flat JSON object (no wrapper). The `Content-Type` header is `application/json`.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "PAID",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "paidAt": "2024-01-26T12:35:42.000Z"
}
```

## Headers

| Header         | Description        |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

## Per-Event Payload Details

### payment.paid

Payment confirmed on-chain. Funds have been transferred directly to the merchant wallet. This is the terminal success state.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "PAID",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "paidAt": "2024-01-26T12:35:42.000Z"
}
```

### payment.invalid

Payment detected on-chain but validation failed. The on-chain transaction did not match the expected payment parameters (amount, token, or recipient mismatch).

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "INVALID",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "paidAt": "2024-01-26T12:35:42.000Z"
}
```

## Event Handler Example

```typescript
async function handleWebhook(payload: any) {
  const { status, orderId, paymentId } = payload;

  switch (status) {
    case 'PAID':
      await completeOrder(orderId);
      break;
    case 'INVALID':
      await flagOrderForReview(orderId, paymentId);
      break;
  }
}
```

## Retry Policy

Webhooks are retried up to 3 times with delays of 10s, 30s, and 90s between retries. A delivery is considered successful when your endpoint returns an HTTP 2xx status code.

## Payment Result Verification

How to verify payment information from Webhook events.

### Server-Side Verification

Use the `paymentId` in the Webhook payload to call the SoloPay API directly from your server and confirm the payment status.

::: warning Always Verify from the Server
Do not trust Webhook payload contents directly. Always re-confirm the actual payment status via the API.
:::

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

### Verification Checklist

- [ ] Confirm `status === 'PAID'` (payment success)
- [ ] Confirm `amount` matches the expected amount **in your order database** (the widget runs client-side and the amount could be tampered with)
- [ ] Confirm `orderId` matches orderId stored in DB
- [ ] Prevent duplicate processing for the same `paymentId`
- [ ] Complete the order after confirming `PAID` status

### Idempotency

The same event may be sent multiple times. Use `paymentId` to prevent duplicate processing.

```typescript
// Check if this paymentId was already processed (DB lookup)
const alreadyProcessed = await db.orders.isPaymentProcessed(data.paymentId);
if (alreadyProcessed) {
  return res.status(200).json({ received: true }); // Ignore duplicate event
}
```

## Merchant Webhook URL

The merchant data model has a `webhook_url` field. Contact admin to configure it.

## Next Steps

- [Event Details](/en/webhooks/events) - Detailed event payload documentation
- [Payment Status](/en/payments/status) - Check status via polling
- [Refunds](/en/payments/refunds) - Request a refund for a completed payment
- [API Reference](/en/api/) - Full API spec
- [Error Codes](/en/api/errors) - Error handling
