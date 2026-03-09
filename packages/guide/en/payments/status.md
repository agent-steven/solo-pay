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
    "status": "ESCROWED",
    "chainId": 80002,
    "serverSignature": "0x...",
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
    "escrowDuration": "300",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail",
    "expiresAt": "2024-01-26T12:35:00.000Z",
    "txHash": "0xdef789...",
    "releaseTxHash": null,
    "payerAddress": "0x...",
    "createdAt": "2024-01-26T12:30:00Z",
    "currency": "USD",
    "fiatAmount": 10.5,
    "tokenPrice": 1.0
  }
}
```

- **txHash** — Escrow (pay) transaction hash. Present once the user has paid and the payment is ESCROWED or later.
- **releaseTxHash** — Finalize or cancel transaction hash. Present when status is FINALIZE_SUBMITTED, FINALIZED, CANCEL_SUBMITTED, or CANCELLED.
- **serverSignature** — Fresh EIP-712 server signature for non-terminal statuses. Empty for terminal statuses (FINALIZED, CANCELLED, EXPIRED, FAILED).
- **escrowDuration** — Escrow duration in seconds. The merchant must call finalize before this duration elapses after the payment is escrowed.

## Status Flow

```
CREATED ──► ESCROWED ──► FINALIZE_SUBMITTED ──► FINALIZED
                    └──► CANCEL_SUBMITTED   ──► CANCELLED
CREATED ──► EXPIRED
CREATED ──► FAILED
```

## Status Descriptions

| Status               | Description                                    | Next Action                       |
| -------------------- | ---------------------------------------------- | --------------------------------- |
| `CREATED`            | Payment created, awaiting on-chain transaction | User initiates payment            |
| `ESCROWED`           | Payment escrowed on-chain                      | Merchant: call Finalize or Cancel |
| `FINALIZE_SUBMITTED` | Finalize transaction submitted                 | Wait for FINALIZED                |
| `FINALIZED`          | Funds released to merchant                     | None (terminal)                   |
| `CANCEL_SUBMITTED`   | Cancel transaction submitted                   | Wait for CANCELLED                |
| `CANCELLED`          | Funds returned to buyer                        | None (terminal)                   |
| `FAILED`             | Transaction failed                             | Create new payment                |
| `EXPIRED`            | Expired (5 minutes exceeded)                   | Create new payment                |

::: tip On-chain Sync
GET /payments/:id syncs blockchain and database status in real-time. For a successful payment, status is **ESCROWED** (user paid, finalize required). After finalize, status becomes **FINALIZED** (funds released to merchant).
:::

## Next Steps

- [Finalize & Cancel](/en/payments/finalize) - Release or cancel escrowed payments
- [How Payments Work](/en/developer/how-it-works) - Gasless architecture
- [Error Codes](/en/api/errors) - Error handling
