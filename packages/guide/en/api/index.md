# API Reference

Full SoloPay REST API specification.

## Base URL

| Environment | URL                                         |
| ----------- | ------------------------------------------- |
| Production  | `https://gateway.solonetwork.io/api/v1`     |
| Staging     | `https://gateway.dev.solonetwork.io/api/v1` |
| Development | `http://localhost:3001/api/v1`              |

## Authentication

| Method     | Header         | Endpoints                                                                            |
| ---------- | -------------- | ------------------------------------------------------------------------------------ |
| Public Key | `x-public-key` | POST /payments, GET /payments/:id, POST /payments/:id/relay, GET /payments/:id/relay |
| API Key    | `x-api-key`    | GET /merchant/\*, POST /merchant/payment-methods, POST /refunds                      |
| None       | -              | GET /chains, GET /chains/tokens                                                      |

---

## Payments

### POST /payments

Create a payment. **Auth**: `x-public-key` + `Origin`

```json
{
  "orderId": "order-001",
  "amount": 10.5,
  "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
  "successUrl": "https://example.com/success",
  "failUrl": "https://example.com/fail",
  "currency": "USD"
}
```

**Response (201)**

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
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

---

### GET /payments/:id

Get payment status. **Auth**: `x-public-key`

**Status values:** CREATED, PAID, REFUND_SUBMITTED, REFUNDED, INVALID, EXPIRED, FAILED. Payment success = PAID (funds transferred directly to merchant).

**Response (200)**

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

- **txHash** — Hash of the pay transaction. Present once the payment is PAID or later.
- **deadline** — Signature deadline (Unix timestamp) for the payment request; used when status is not yet terminal.

---

### POST /payments/:id/relay

Submit a Gasless payment (ERC-2771). **Auth**: `x-public-key` + `Origin`

```json
{
  "paymentId": "0xabc123...",
  "forwarderAddress": "0x...",
  "forwardRequest": {
    "from": "0x...",
    "to": "0x...",
    "value": "0",
    "gas": "200000",
    "nonce": "1",
    "deadline": "1706281200",
    "data": "0x...",
    "signature": "0x..."
  }
}
```

**Response (202)**

```json
{
  "success": true,
  "data": {
    "status": "submitted",
    "message": "Gasless transaction submitted"
  }
}
```

---

### GET /payments/:id/relay

Get relay status. **Auth**: `x-public-key`

```json
{
  "success": true,
  "data": {
    "status": "CONFIRMED",
    "transactionHash": "0xdef789...",
    "errorMessage": null,
    "createdAt": "2024-01-26T12:34:00Z",
    "updatedAt": "2024-01-26T12:35:42Z"
  }
}
```

**Status values**: `QUEUED` → `SUBMITTED` → `CONFIRMED` (or `FAILED`)

---

## Merchant

### GET /merchant

Get merchant info. **Auth**: `x-api-key`

```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": 1,
      "merchant_key": "my-store",
      "name": "My Store",
      "chain_id": 80002,
      "chain": { "id": 1, "network_id": 80002, "name": "Polygon Amoy", "is_testnet": true },
      "webhook_url": null,
      "public_key": "pk_xxx",
      "is_enabled": true,
      "payment_methods": [...]
    },
    "chainTokens": [...]
  }
}
```

---

### GET /merchant/payment-methods

List payment methods. **Auth**: `x-api-key`

---

### POST /merchant/payment-methods

Add a payment method. **Auth**: `x-api-key`

```json
{ "tokenAddress": "0x...", "is_enabled": true }
```

---

### PATCH /merchant/payment-methods/:id

Update a payment method. **Auth**: `x-api-key`

```json
{ "is_enabled": false }
```

---

### GET /merchant/payments

List payments. **Auth**: `x-api-key`. Query: `orderId`

---

### GET /merchant/payments/:id

Get payment detail. **Auth**: `x-api-key`

---

## Chains

### GET /chains

Get supported chains. **No auth required.**

```json
{
  "success": true,
  "data": {
    "chains": [
      { "id": 1, "network_id": 80002, "name": "Polygon Amoy", "is_testnet": true },
      { "id": 2, "network_id": 97, "name": "BSC Testnet", "is_testnet": true },
      { "id": 3, "network_id": 11155111, "name": "Sepolia", "is_testnet": true }
    ]
  }
}
```

---

### GET /chains/tokens

Get all chains with their tokens. **No auth required.**

---

## Health

### GET /health

Server health check. **No auth required.**

```json
{ "status": "ok", "timestamp": "2024-01-26T12:00:00.000Z" }
```

## Next Steps

- [Error Codes](/en/api/errors) - Error handling
