# Payment Status

Query the current status of a payment.

- Auth: `x-public-key` header required
- For GET requests, use `x-origin` header instead of `Origin` in proxy environments

## REST API

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

## Response

### Success (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "orderId": "order-001",
    "status": "PAID",
    "chainId": 80002,
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "tokenSymbol": "SUT",
    "tokenDecimals": 18,
    "tokenPermitSupported": true,
    "gatewayAddress": "0x...",
    "forwarderAddress": "0x...",
    "amount": "10500000000000000000",
    "recipientAddress": "0xMerchantWallet...",
    "merchantId": "0x...",
    "deadline": "1706281200",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail",
    "expiresAt": "2024-01-26T12:35:00.000Z",
    "txHash": "0xdef789...",
    "payerAddress": "0x...",
    "createdAt": "2024-01-26T12:30:00Z",
    "currency": "USD",
    "fiatAmount": 10.5,
    "tokenPrice": 1.0
  }
}
```

- **txHash** -- Payment transaction hash. Present once the payment is confirmed on-chain (status is PAID or later).
- **deadline** -- Unix timestamp deadline for the payment transaction. The payment must be submitted before this time.

## Status Flow

```
CREATED ──► PAID
CREATED ──► INVALID
CREATED ──► EXPIRED
CREATED ──► FAILED
PAID    ──► REFUND_SUBMITTED ──► REFUNDED (coming soon)
```

## Status Descriptions

| Status             | Description                                                          | Next Action        |
| ------------------ | -------------------------------------------------------------------- | ------------------ |
| `CREATED`          | Payment created, awaiting on-chain transaction                       | User pays on-chain |
| `PAID`             | Payment confirmed on-chain, funds sent to merchant                   | None (terminal)    |
| `REFUND_SUBMITTED` | Refund request submitted (coming soon)                               | Wait for REFUNDED  |
| `REFUNDED`         | Refund completed (coming soon)                                       | None (terminal)    |
| `INVALID`          | On-chain payment validation failed (amount/token/recipient mismatch) | Contact support    |
| `EXPIRED`          | Payment expired (5 minutes exceeded)                                 | Create new payment |
| `FAILED`           | Transaction failed                                                   | Create new payment |

::: tip On-chain Sync
GET /payments/:id syncs blockchain and database status in real-time. For a successful payment, the status transitions directly from **CREATED** to **PAID** once the on-chain transaction is confirmed. No additional merchant action is required to release funds.
:::

## Next Steps

- [Refunds](/en/payments/refunds) - Request a refund for a completed payment
- [How Payments Work](/en/developer/how-it-works) - Gasless architecture
- [Error Codes](/en/api/errors) - Error handling
