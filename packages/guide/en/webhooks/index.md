# Webhook

Receive real-time notifications when payment status changes.

## Webhook Overview

When configured, Webhooks send HTTP POST requests to your URL on payment status changes.

## Event Types

| status value | Description       | When                       |
| ------------ | ----------------- | -------------------------- |
| `ESCROWED`   | Payment escrowed  | User paid; funds in escrow |
| `FINALIZED`  | Payment finalized | Funds released to merchant |
| `CANCELLED`  | Payment cancelled | Funds returned to buyer    |

On **ESCROWED**, verify the order details and call finalize. On **FINALIZED**, complete the order.

## Payload Structure

Webhook payloads are sent as a flat JSON object (no wrapper). The `Content-Type` header is `application/json`.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "FINALIZED",
  "txHash": "0xdef789...",
  "releaseTxHash": "0xrelease123...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "finalizedAt": "2024-01-26T12:35:42.000Z"
}
```

## Headers

| Header         | Description        |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

## Per-Event Payload Details

### ESCROWED

Payment escrowed on-chain; user has paid and funds are held in escrow. Merchant can finalize (release to merchant) or cancel (return to buyer).

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "ESCROWED",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "escrowedAt": "2024-01-26T12:35:00.000Z"
}
```

### FINALIZED

Funds released to merchant. Terminal success state for the finalize flow.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "FINALIZED",
  "txHash": "0xdef789...",
  "releaseTxHash": "0xrelease123...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "finalizedAt": "2024-01-26T12:36:00.000Z"
}
```

### CANCELLED

Escrowed payment was cancelled; funds returned to buyer.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "CANCELLED",
  "txHash": "0xdef789...",
  "releaseTxHash": "0xcancel123...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "cancelledAt": "2024-01-26T12:36:00.000Z"
}
```

## Event Handler Example

```typescript
async function handleWebhook(payload: any) {
  const { status, orderId, paymentId } = payload;

  switch (status) {
    case 'ESCROWED':
      await updateOrderStatus(orderId, 'PAID_ESCROW');
      // Optionally complete order here, or wait for FINALIZED
      break;
    case 'FINALIZED':
      await completeOrder(orderId);
      break;
    case 'CANCELLED':
      await cancelOrder(orderId);
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

- [ ] Confirm `status === 'ESCROWED'` (payment success)
- [ ] Confirm `amount` matches order amount
- [ ] Confirm `orderId` matches orderId stored in DB
- [ ] Prevent duplicate processing for the same `paymentId`
- [ ] Call finalize, then complete the order only after confirming `FINALIZED` status

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

- [Payment Status](/en/payments/status) - Check status via polling
- [Finalize & Cancel](/en/payments/finalize) - Release or cancel after escrowed
- [API Reference](/en/api/) - Full API spec
- [Error Codes](/en/api/errors) - Error handling
