# Event Details

## payment.paid

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

## payment.invalid

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

## Payload Fields

| Field         | Type     | Description                                     |
| ------------- | -------- | ----------------------------------------------- |
| `paymentId`   | `string` | Unique payment identifier (bytes32 hash)        |
| `orderId`     | `string` | Merchant order ID (null if not provided)        |
| `status`      | `string` | Payment status at the time of the event         |
| `txHash`      | `string` | On-chain transaction hash                       |
| `amount`      | `string` | Amount in wei (string for precision)            |
| `tokenSymbol` | `string` | Token symbol (e.g., USDC, SUT)                  |
| `paidAt`      | `string` | ISO-8601 timestamp of the on-chain confirmation |

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

## Next Steps

- [Payment Status](/en/payments/status) - All status values
- [Refunds](/en/payments/refunds) - Request a refund for a completed payment
- [API Reference](/en/api/) - Full API spec
- [Error Codes](/en/api/errors) - Error handling
