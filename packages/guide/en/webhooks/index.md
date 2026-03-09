# Webhook

Receive real-time notifications when payment status changes.

## Webhook Overview

When configured, Webhooks send HTTP POST requests to your URL on payment status changes.

## Event Types

| Event               | Description       | When                       |
| ------------------- | ----------------- | -------------------------- |
| `payment.created`   | Payment created   | Immediately after creation |
| `payment.escrowed`  | Payment escrowed  | User paid; funds in escrow |
| `payment.finalized` | Payment finalized | Funds released to merchant |
| `payment.cancelled` | Payment cancelled | Funds returned to buyer    |
| `payment.failed`    | Payment failed    | On TX failure              |
| `payment.expired`   | Payment expired   | After 5 minutes exceeded   |

On **payment.escrowed**, verify the order details and call finalize. On **payment.finalized**, complete the order.

## Payload Structure

```json
{
  "event": "payment.finalized",
  "timestamp": "2024-01-26T12:35:42Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "FINALIZED",
    "amount": "10500000000000000000",
    "tokenSymbol": "SUT",
    "txHash": "0xdef789...",
    "orderId": "order-001",
    "finalizedAt": "2024-01-26T12:35:42Z"
  }
}
```

## Headers

| Header         | Description        |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

## Per-Event Payload Details

### payment.created

```json
{
  "event": "payment.created",
  "timestamp": "2024-01-26T12:30:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "CREATED",
    "amount": "10500000000000000000",
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "tokenSymbol": "SUT",
    "orderId": "order-001",
    "expiresAt": "2024-01-26T12:35:00Z",
    "createdAt": "2024-01-26T12:30:00Z"
  }
}
```

### payment.escrowed

Payment escrowed on-chain; user has paid and funds are held in escrow. Merchant can finalize (release to merchant) or cancel (return to buyer).

```json
{
  "event": "payment.escrowed",
  "timestamp": "2024-01-26T12:35:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "ESCROWED",
    "amount": "10500000000000000000",
    "tokenSymbol": "SUT",
    "payerAddress": "0x1234567890abcdef...",
    "txHash": "0xdef789...",
    "orderId": "order-001",
    "escrowedAt": "2024-01-26T12:35:00Z"
  }
}
```

### payment.finalized

Funds released to merchant. Terminal success state for the finalize flow.

```json
{
  "event": "payment.finalized",
  "timestamp": "2024-01-26T12:36:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "FINALIZED",
    "amount": "10500000000000000000",
    "tokenSymbol": "SUT",
    "payerAddress": "0x1234567890abcdef...",
    "txHash": "0xdef789...",
    "orderId": "order-001",
    "finalizedAt": "2024-01-26T12:36:00Z"
  }
}
```

### payment.cancelled

Escrowed payment was cancelled; funds returned to buyer.

```json
{
  "event": "payment.cancelled",
  "timestamp": "2024-01-26T12:36:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "CANCELLED",
    "orderId": "order-001",
    "cancelledAt": "2024-01-26T12:36:00Z"
  }
}
```

### payment.failed

```json
{
  "event": "payment.failed",
  "timestamp": "2024-01-26T12:35:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "FAILED",
    "amount": "10500000000000000000",
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "payerAddress": "0x1234567890abcdef...",
    "txHash": "0xdef789...",
    "orderId": "order-001",
    "failureReason": "Transaction reverted"
  }
}
```

### payment.expired

```json
{
  "event": "payment.expired",
  "timestamp": "2024-01-26T12:35:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "EXPIRED",
    "orderId": "order-001",
    "expiredAt": "2024-01-26T12:35:00Z"
  }
}
```

## Event Handler Example

```typescript
async function handleWebhook(event: any) {
  const { event: eventType, data } = event;

  switch (eventType) {
    case 'payment.created':
      await updateOrderStatus(data.orderId, 'PENDING_PAYMENT');
      break;
    case 'payment.escrowed':
      await updateOrderStatus(data.orderId, 'PAID_ESCROW');
      // Optionally complete order here, or wait for payment.finalized
      break;
    case 'payment.finalized':
      await completeOrder(data.orderId);
      await sendNotification(data.payerAddress, 'Payment complete');
      break;
    case 'payment.cancelled':
      await cancelOrder(data.orderId);
      break;
    case 'payment.failed':
      await updateOrderStatus(data.orderId, 'PAYMENT_FAILED');
      break;
    case 'payment.expired':
      await cancelOrder(data.orderId);
      break;
  }
}
```

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
