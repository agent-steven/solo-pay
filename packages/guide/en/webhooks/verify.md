# Payment Result Verification

How to verify payment results received from Webhooks or callback URLs.

## Verification Flow

Whether you receive a payment result via **Webhook** or **callback URL**, the verification process is the same:

```
1. Receive orderId (from webhook payload or callback URL parameter)
       ↓
2. Query payment API using orderId to get the authoritative payment status
       ↓
3. Compare API response against your DB order record
       ↓
4. If valid, link paymentId to the order and update order status
```

::: warning Always Verify via API
Never trust webhook payloads or callback URL parameters directly. Always call the SoloPay API from your server to confirm the actual payment status.
:::

## Step 1: Query Payment by orderId

```bash
curl https://pay-api.staging.sut.com/api/v1/payments?orderId=order-001 \
  -H "x-api-key: sk_test_xxxxx"
```

## Step 2: Verify and Link

```typescript
async function verifyPayment(orderId: string) {
  // 1. Fetch payment from SoloPay API using orderId
  const payment = await solopayApi.getPaymentByOrderId(orderId);

  // 2. Find the matching order in your DB
  const order = await db.orders.findByOrderId(orderId);
  if (!order) throw new Error('Order not found');

  // 3. Verify payment details match your order
  if (payment.amount !== order.expectedAmount) throw new Error('Amount mismatch');
  if (payment.tokenAddress !== order.expectedToken) throw new Error('Token mismatch');

  // 4. Check payment status
  if (payment.status !== 'ESCROWED' && payment.status !== 'FINALIZED') {
    return; // Payment not yet complete
  }

  // 5. Link paymentId to the order and update status
  await db.orders.update(orderId, {
    paymentId: payment.paymentId,
    status: 'PAID',
    paidAt: new Date(),
  });
}
```

**Verification Checklist**

- [ ] Query payment API using `orderId` — do not rely on payload/URL values
- [ ] Confirm `status === 'ESCROWED'` or `status === 'FINALIZED'`
- [ ] Confirm `amount` and `tokenAddress` match your order record
- [ ] Link `paymentId` to the order in your DB
- [ ] Prevent duplicate processing for the same `paymentId`

## Idempotency

The same event may be sent multiple times. Use `paymentId` to prevent duplicate processing.

```typescript
const alreadyProcessed = await db.orders.isPaymentProcessed(data.paymentId);
if (alreadyProcessed) {
  return res.status(200).json({ received: true });
}
```

## Callback URL vs Webhook

Both callback URLs and webhooks can trigger the same verification flow. The difference is reliability:

| | Callback URL | Webhook |
|---|---|---|
| **Trigger** | Browser redirect to `successUrl`/`failUrl` | Server-to-server HTTP POST |
| **Reliability** | Can fail if user closes browser | Reliable with retry mechanism |
| **Use for** | Immediate UI feedback + verification | Background order processing + verification |

::: tip
For maximum reliability, implement the verification flow in **both** your callback handler and webhook handler. This way, whichever fires first processes the order, and the other is handled by idempotency.
:::

## Next Steps

- [Event Details](/en/webhooks/events) - Per-event processing
- [API Reference](/en/api/) - Full API spec
