# Payments

Complete API reference for SoloPay payments.

## Create Payment

Create a payment and receive a unique payment ID.

### Overview

When using the SoloPay widget, **payment creation is handled automatically by the widget**. This page is a reference API spec for understanding the internals or for custom implementations.

Created payments **expire automatically after 5 minutes**.

- Auth: `x-public-key` header required (pk_xxx)
- Chain and recipient address are determined by merchant configuration
- `tokenAddress` must be whitelisted and enabled for the merchant

### REST API

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

### Request Parameters

| Field          | Type      | Req. | Description                                                        |
| -------------- | --------- | ---- | ------------------------------------------------------------------ |
| `orderId`      | `string`  | ✓    | Merchant order ID (no duplicates per merchant)                     |
| `amount`       | `number`  | ✓    | Payment amount (token units or fiat units). Max 2 decimal places   |
| `tokenAddress` | `address` | ✓    | ERC-20 token contract address (whitelisted & enabled for merchant) |
| `successUrl`   | `string`  | ✓    | Redirect URL on success                                            |
| `failUrl`      | `string`  | ✓    | Redirect URL on failure                                            |
| `currency`     | `string`  |      | Fiat currency code (e.g., `USD`, `KRW`). Triggers price conversion |

::: tip currency option
When `currency` is provided, `amount` is treated as a fiat amount. The server fetches the token price and converts automatically.
Example: `amount: 10, currency: "USD"` → pays 10 USD worth of tokens
:::

::: warning amount decimal restriction
`amount` allows a maximum of **2 decimal places** (e.g., `10.50` ✓, `10.123` ✗). Without `currency`, the value is used directly as the token amount. With `currency`, the fiat amount is converted to token units and truncated to 2 decimal places. The minimum token amount is `0.01`.
:::

### Response

#### Success (201 Created)

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

#### Error Responses

| HTTP | Code                           | Cause                                     |
| ---- | ------------------------------ | ----------------------------------------- |
| 400  | `TOKEN_NOT_ENABLED`            | Token is not enabled for this merchant    |
| 404  | `TOKEN_NOT_FOUND`              | Token not in whitelist                    |
| 400  | `UNSUPPORTED_CHAIN`            | Unsupported chain                         |
| 400  | `CHAIN_NOT_CONFIGURED`         | Merchant has no chain configured          |
| 400  | `RECIPIENT_NOT_CONFIGURED`     | Merchant recipient address not configured |
| 400  | `CHAIN_MISMATCH`               | Token does not belong to merchant chain   |
| 400  | `UNSUPPORTED_TOKEN`            | Token not supported on this chain         |
| 400  | `PRICE_SERVICE_NOT_CONFIGURED` | Currency conversion unavailable           |
| 400  | `VALIDATION_ERROR`             | Input validation failed                   |
| 409  | `DUPLICATE_ORDER`              | orderId already used                      |

### Response Fields

| Field                  | Type       | Description                                                                                         |
| ---------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `paymentId`            | `string`   | Unique payment identifier (bytes32 hash)                                                            |
| `amount`               | `string`   | Amount in wei                                                                                       |
| `gatewayAddress`       | `address`  | PaymentGateway contract address                                                                     |
| `forwarderAddress`     | `address`  | ERC2771 Forwarder address (for Gasless)                                                             |
| `merchantId`           | `string`   | Merchant ID (bytes32)                                                                               |
| `deadline`             | `string`   | Payment deadline (Unix timestamp); pay() must be called before this time. Default: 5 minutes (300s) |
| `expiresAt`            | `datetime` | Payment expiry (5 minutes from creation)                                                            |
| `tokenPermitSupported` | `boolean`  | Whether the token supports EIP-2612 Permit                                                          |
| `currency`             | `string`   | Fiat currency code (included only when requested)                                                   |
| `fiatAmount`           | `number`   | Original fiat amount (included only when requested)                                                 |
| `tokenPrice`           | `number`   | Token price at creation time (included only when requested)                                         |

### When Using the Widget

When using the widget (`@solo-pay/widget-js` / `@solo-pay/widget-react`), there is no need to call this API directly — the widget handles it automatically.

See [Widget Integration Guide](/en/widget/)

---

## Payment Status

Query the current status of a payment.

- Auth: `x-public-key` header required
- For GET requests, use `x-origin` header instead of `Origin` in proxy environments

### REST API

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

### Response

#### Success (200 OK)

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

- **txHash** — Pay transaction hash. Present once payment is PAID or later.

### Status Flow

```
CREATED ──► PAID ──► REFUND_SUBMITTED ──► REFUNDED
CREATED ──► EXPIRED
CREATED ──► FAILED
CREATED ──► INVALID
```

### Status Descriptions

| Status             | Description                                    | Next Action                     |
| ------------------ | ---------------------------------------------- | ------------------------------- |
| `CREATED`          | Payment created, awaiting on-chain transaction | User initiates payment          |
| `PAID`             | Payment confirmed on-chain                     | None (terminal for normal flow) |
| `REFUND_SUBMITTED` | Refund transaction submitted                   | Wait for REFUNDED               |
| `REFUNDED`         | Refund completed, funds returned to buyer      | None (terminal)                 |
| `INVALID`          | Payment validation failed                      | Create new payment              |
| `FAILED`           | Transaction failed                             | Create new payment              |
| `EXPIRED`          | Expired (5 minutes exceeded)                   | Create new payment              |

::: tip On-chain Sync
GET /payments/:id syncs blockchain and database status in real-time. For a successful payment, status is **PAID** (payment confirmed on-chain, funds transferred directly to the merchant).
:::

---

## Payment History

Query merchant payment history. Requires API Key authentication.

### REST API

```bash
# Query by orderId
curl "https://gateway.dev.solonetwork.io/api/v1/merchant/payments?orderId=order-001" \
  -H "x-api-key: sk_xxxxx"

# Query by paymentId
curl "https://gateway.dev.solonetwork.io/api/v1/merchant/payments/0xabc123..." \
  -H "x-api-key: sk_xxxxx"
```

### Response

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "orderId": "order-001",
    "status": "PAID",
    "amount": "10500000000000000000",
    "tokenSymbol": "SUT",
    "tokenDecimals": 18,
    "txHash": "0xdef789...",
    "payerAddress": "0x1234...",
    "createdAt": "2024-01-26T12:30:00Z",
    "confirmedAt": "2024-01-26T12:35:42Z",
    "expiresAt": "2024-01-26T12:35:00Z"
  }
}
```

### Response Fields

| Field           | Type     | Description                                                         |
| --------------- | -------- | ------------------------------------------------------------------- |
| `paymentId`     | `string` | Unique payment identifier (bytes32 hash)                            |
| `orderId`       | `string` | Merchant order ID                                                   |
| `status`        | `string` | CREATED, PAID, REFUND_SUBMITTED, REFUNDED, INVALID, EXPIRED, FAILED |
| `amount`        | `string` | Amount in wei                                                       |
| `tokenSymbol`   | `string` | Token symbol                                                        |
| `tokenDecimals` | `number` | Token decimals                                                      |
| `txHash`        | `string` | On-chain transaction hash (present after confirmation)              |
| `payerAddress`  | `string` | Payer wallet address (present after confirmation)                   |
| `confirmedAt`   | `string` | Payment confirmation timestamp                                      |
| `expiresAt`     | `string` | Payment expiry timestamp                                            |
