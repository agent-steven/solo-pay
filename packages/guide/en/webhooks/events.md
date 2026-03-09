# Event Details

## ESCROWED

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

## FINALIZED

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

## CANCELLED

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

## Payload Fields

| Field          | Type     | Description                                                        |
| -------------- | -------- | ------------------------------------------------------------------ |
| `paymentId`    | `string` | Unique payment identifier (bytes32 hash)                           |
| `orderId`      | `string` | Merchant order ID (null if not provided)                           |
| `status`       | `string` | Payment status at the time of the event                            |
| `txHash`       | `string` | Escrow (pay) transaction hash                                      |
| `releaseTxHash`| `string` | Finalize or cancel transaction hash (finalized/cancelled only)     |
| `amount`       | `string` | Amount in wei (string for precision)                               |
| `tokenSymbol`  | `string` | Token symbol (e.g., USDC, SUT)                                     |
| `escrowedAt`   | `string` | ISO-8601 timestamp (escrowed event only)                           |
| `finalizedAt`  | `string` | ISO-8601 timestamp (finalized event only)                          |
| `cancelledAt`  | `string` | ISO-8601 timestamp (cancelled event only)                          |

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

## Next Steps

- [Payment Status](/en/payments/status) - All status values
- [Finalize & Cancel](/en/payments/finalize) - Release or cancel after escrowed
- [API Reference](/en/api/) - Full API spec
- [Error Codes](/en/api/errors) - Error handling
