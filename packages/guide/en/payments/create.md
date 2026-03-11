# Create Payment

Create a payment and receive a unique payment ID.

## Overview

When using the SoloPay widget, **payment creation is handled automatically by the widget**. This page is a reference API spec for understanding the internals or for custom implementations.

Created payments **expire automatically after 5 minutes**.

- Auth: `x-public-key` header required (pk_xxx)
- Chain and recipient address are determined by merchant configuration
- `tokenAddress` must be whitelisted and enabled for the merchant

## REST API

```bash
curl -X POST https://gateway.dev.solonetwork.io/api/v1/payments \
  -H "x-public-key: pk_xxxxx" \
  -H "Origin: https://yourshop.com" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-001",
    "amount": 10.5,
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail"
  }'
```

## Request Parameters

| Field          | Type      | Req. | Description                                                        |
| -------------- | --------- | ---- | ------------------------------------------------------------------ |
| `orderId`      | `string`  | ✓    | Merchant order ID (no duplicates per merchant)                     |
| `amount`       | `number`  | ✓    | Payment amount (token units or fiat units)                         |
| `tokenAddress` | `address` | ✓    | ERC-20 token contract address (whitelisted & enabled for merchant) |
| `successUrl`   | `string`  | ✓    | Redirect URL on success                                            |
| `failUrl`      | `string`  | ✓    | Redirect URL on failure                                            |
| `currency`     | `string`  |      | Fiat currency code (e.g., `USD`, `KRW`). Triggers price conversion |

::: tip currency option
When `currency` is provided, `amount` is treated as a fiat amount. The server fetches the token price and converts automatically.
Example: `amount: 10, currency: "USD"` → pays 10 USD worth of tokens
:::

## Response

### Success (201 Created)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123def456...",
    "orderId": "order-001",
    "chainId": 80002,
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "tokenSymbol": "SUT",
    "tokenDecimals": 18,
    "gatewayAddress": "0x...",
    "forwarderAddress": "0x...",
    "amount": "10500000000000000000",
    "recipientAddress": "0xMerchantWallet...",
    "merchantId": "0x...",
    "deadline": "1706281200",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail",
    "expiresAt": "2024-01-26T12:35:00.000Z",
    "tokenPermitSupported": true,
    "currency": "USD",
    "fiatAmount": 10.5,
    "tokenPrice": 1.0
  }
}
```

### Error Responses

| HTTP | Code                       | Cause                                     |
| ---- | -------------------------- | ----------------------------------------- |
| 400  | `TOKEN_NOT_ENABLED`        | Token is not enabled for this merchant    |
| 404  | `TOKEN_NOT_FOUND`          | Token not in whitelist                    |
| 400  | `UNSUPPORTED_CHAIN`        | Unsupported chain                         |
| 400  | `CHAIN_NOT_CONFIGURED`     | Merchant has no chain configured          |
| 400  | `RECIPIENT_NOT_CONFIGURED` | Merchant recipient address not configured |
| 400  | `VALIDATION_ERROR`         | Input validation failed                   |
| 409  | `DUPLICATE_ORDER`          | orderId already used                      |

## Response Fields

| Field                  | Type       | Description                                                                                           |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `paymentId`            | `string`   | Unique payment identifier (bytes32 hash)                                                              |
| `amount`               | `string`   | Amount in wei                                                                                         |
| `gatewayAddress`       | `address`  | PaymentGateway contract address                                                                       |
| `forwarderAddress`     | `address`  | ERC2771 Forwarder address (for Gasless)                                                               |
| `merchantId`           | `string`   | Merchant ID (bytes32)                                                                                 |
| `deadline`             | `string`   | Server signature deadline (Unix timestamp); required for `pay()` and gasless. Default: 1 hour (3600s) |
| `expiresAt`            | `datetime` | Payment expiry (5 minutes from creation)                                                              |
| `tokenPermitSupported` | `boolean`  | Whether the token supports EIP-2612 Permit                                                            |
| `currency`             | `string`   | Fiat currency code (included only when requested)                                                     |
| `fiatAmount`           | `number`   | Original fiat amount (included only when requested)                                                   |
| `tokenPrice`           | `number`   | Token price at creation time (included only when requested)                                           |

## When Using the Widget

When using the widget (`@solo-pay/widget-js` / `@solo-pay/widget-react`), there is no need to call this API directly — the widget handles it automatically.

See [Widget Integration Guide](/en/widget/)

## Next Steps

- [Payment Status](/en/payments/status) - Check payment progress
- [How Payments Work](/en/developer/how-it-works) - Gasless architecture
