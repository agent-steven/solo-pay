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
    "serverSignature": "0x...",
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
    "escrowDuration": "300",
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

| HTTP | Code                       | Cause                                     |
| ---- | -------------------------- | ----------------------------------------- |
| 400  | `TOKEN_NOT_ENABLED`        | Token is not enabled for this merchant    |
| 404  | `TOKEN_NOT_FOUND`          | Token not in whitelist                    |
| 400  | `UNSUPPORTED_CHAIN`        | Unsupported chain                         |
| 400  | `CHAIN_NOT_CONFIGURED`     | Merchant has no chain configured          |
| 400  | `RECIPIENT_NOT_CONFIGURED` | Merchant recipient address not configured |
| 400  | `VALIDATION_ERROR`         | Input validation failed                   |
| 409  | `DUPLICATE_ORDER`          | orderId already used                      |

### Response Fields

| Field                  | Type       | Description                                                                                           |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `paymentId`            | `string`   | Unique payment identifier (bytes32 hash)                                                              |
| `serverSignature`      | `string`   | Server EIP-712 signature for contract auth                                                            |
| `amount`               | `string`   | Amount in wei                                                                                         |
| `gatewayAddress`       | `address`  | PaymentGateway contract address                                                                       |
| `forwarderAddress`     | `address`  | ERC2771 Forwarder address (for Gasless)                                                               |
| `merchantId`           | `string`   | Merchant ID (bytes32)                                                                                 |
| `deadline`             | `string`   | Server signature deadline (Unix timestamp); required for `pay()` and gasless. Default: 1 hour (3600s) |
| `escrowDuration`       | `string`   | Escrow hold duration in seconds; required for `pay()` and gasless. Default: 5 minutes (300s)          |
| `expiresAt`            | `datetime` | Payment expiry (5 minutes from creation)                                                              |
| `tokenPermitSupported` | `boolean`  | Whether the token supports EIP-2612 Permit                                                            |
| `currency`             | `string`   | Fiat currency code (included only when requested)                                                     |
| `fiatAmount`           | `number`   | Original fiat amount (included only when requested)                                                   |
| `tokenPrice`           | `number`   | Token price at creation time (included only when requested)                                           |

### When Using the Widget

When using the widget (`@solo-pay/widget-js` / `@solo-pay/widget-react`), there is no need to call this API directly — the widget handles it automatically.

See [Client-Side Integration Guide](/en/developer/client-side)

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
    "status": "ESCROWED",
    "amount": "10500000000000000000",
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "tokenSymbol": "SUT",
    "payerAddress": "0x...",
    "treasuryAddress": "0xMerchantWallet...",
    "transactionHash": "0xdef789...",
    "releaseTxHash": null,
    "deadline": "1706281200",
    "escrowDuration": "300",
    "createdAt": "2024-01-26T12:30:00Z",
    "updatedAt": "2024-01-26T12:35:42Z",
    "payment_hash": "0xabc123...",
    "network_id": 80002,
    "token_symbol": "SUT"
  }
}
```

- **transactionHash** — Escrow (pay) transaction hash.
- **releaseTxHash** — Finalize or cancel transaction hash; present when status is FINALIZE_SUBMITTED, FINALIZED, CANCEL_SUBMITTED, or CANCELLED.
- **escrowDuration** — Escrow duration in seconds. The API does not return the exact escrow deadline (ISO datetime); use this value to know how long the merchant has to finalize after the payment is escrowed.

### Status Flow

```
CREATED ──► ESCROWED ──► FINALIZE_SUBMITTED ──► FINALIZED
                    └──► CANCEL_SUBMITTED   ──► CANCELLED ──► REFUND_SUBMITTED ──► REFUNDED

CREATED ──► EXPIRED
CREATED ──► FAILED
```

### Status Descriptions

| Status               | Description                                    | Next Action                                                            |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `CREATED`            | Payment created, awaiting on-chain transaction | User initiates payment                                                 |
| `ESCROWED`           | Payment escrowed on-chain                      | Merchant: call [Finalize & Cancel](#finalize--cancel) to release funds |
| `FINALIZE_SUBMITTED` | Finalize transaction submitted                 | Wait for FINALIZED (poll or webhook)                                   |
| `FINALIZED`          | Funds released to merchant                     | None (terminal)                                                        |
| `CANCEL_SUBMITTED`   | Cancel transaction submitted                   | Wait for CANCELLED                                                     |
| `CANCELLED`          | Funds returned to buyer                        | None (terminal)                                                        |
| `REFUND_SUBMITTED`   | Refund transaction submitted                   | Wait for REFUNDED                                                      |
| `REFUNDED`           | Refund completed                               | None (terminal)                                                        |
| `FAILED`             | Transaction failed                             | Create new payment                                                     |
| `EXPIRED`            | Expired (5 minutes exceeded)                   | Create new payment                                                     |

::: tip On-chain Sync
GET /payments/:id syncs blockchain and database status in real-time. For a successful payment, status is **ESCROWED** (user paid, finalize required). After finalize, status becomes **FINALIZED** (funds released to merchant).
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
    "status": "FINALIZED",
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

| Field           | Type     | Description                                                                                                                |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `paymentId`     | `string` | Unique payment identifier (bytes32 hash)                                                                                   |
| `orderId`       | `string` | Merchant order ID                                                                                                          |
| `status`        | `string` | CREATED, ESCROWED, FINALIZE_SUBMITTED, FINALIZED, CANCEL_SUBMITTED, CANCELLED, REFUND_SUBMITTED, REFUNDED, EXPIRED, FAILED |
| `amount`        | `string` | Amount in wei                                                                                                              |
| `tokenSymbol`   | `string` | Token symbol                                                                                                               |
| `tokenDecimals` | `number` | Token decimals                                                                                                             |
| `txHash`        | `string` | On-chain transaction hash (present after confirmation)                                                                     |
| `payerAddress`  | `string` | Payer wallet address (present after confirmation)                                                                          |
| `confirmedAt`   | `string` | Payment confirmation timestamp                                                                                             |
| `expiresAt`     | `string` | Payment expiry timestamp                                                                                                   |

### On-chain Query via Subgraph

You can also query on-chain payment events directly via Subgraph.

```graphql
query PaymentHistory($payer: Bytes!) {
  paymentReceivedEvents(
    where: { payer: $payer }
    orderBy: blockTimestamp
    orderDirection: desc
    first: 10
  ) {
    id
    paymentId
    payer
    token
    amount
    transactionHash
    blockTimestamp
  }
}
```

::: tip Subgraph Usage
Use Subgraph for bulk history queries or complex filtering.
:::

---

## Finalize & Cancel

After a payment reaches **ESCROWED** status, the merchant must choose: **finalize** (release funds to the merchant wallet) or **cancel** (return funds to the buyer). Both actions are performed from your **merchant server** using the API key.

### Who Can Call

- **POST /payments/:id/finalize** — Only the **merchant** that owns the payment (authenticated with `x-api-key`). Must be called before the **escrow deadline**; after the deadline the API returns `ESCROW_EXPIRED`.
- **POST /payments/:id/cancel** — Only the **merchant** that owns the payment (authenticated with `x-api-key`). Valid while payment is ESCROWED. After the **escrow deadline**, anyone can cancel the payment **on-chain** (directly on the contract) without using this API; the API is for the merchant to cancel before or within the deadline.

### Expiry vs Escrow Deadline

- **Payment EXPIRED** — The payment was never completed within the creation expiry window (e.g. 5 minutes exceeded). Status becomes `EXPIRED`; no escrow occurred. Create a new payment to retry.
- **Escrow deadline** — Once a payment is ESCROWED, the merchant has until the escrow deadline to **finalize** (release funds). After the escrow deadline, finalize via API returns `ESCROW_EXPIRED`, and the contract may allow **permissionless cancel** on-chain (anyone can call cancel on the contract, and upon calling, funds are returned to the buyer).

### When to Call

- After you receive the **payment.escrowed** webhook, or
- After **GET /payments/:id** returns `status: "ESCROWED"`

Then call **POST /payments/:id/finalize** to release funds to your wallet, or **POST /payments/:id/cancel** to return funds to the buyer.

### Finalize (Release to Merchant)

**Endpoint:** `POST /payments/:id/finalize`
**Auth:** `x-api-key` (API key only; not public key)

No request body. The payment ID is in the URL path.

#### Example

```bash
curl -X POST https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123.../finalize \
  -H "x-api-key: sk_xxxxx"
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "relayRequestId": "uuid-...",
    "transactionHash": null,
    "status": "submitted"
  }
}
```

The response `data.status` is the **relay submission state** (`submitted` or `pending`), not the payment status. The payment status in the database becomes **FINALIZE_SUBMITTED**; after the on-chain transaction confirms it becomes **FINALIZED** and you receive the **payment.finalized** webhook. Poll **GET /payments/:id** until `status === "FINALIZED"` to confirm.

::: tip Escrow Deadline (default: 5 minutes)
Finalize must be called within the escrow deadline (default 300 seconds = 5 minutes). The countdown starts from the on-chain escrow moment (when the `pay()` transaction is confirmed). After the deadline, the API returns `ESCROW_EXPIRED` and the contract allows anyone to cancel on-chain (permissionless).
:::

### Cancel (Return to Buyer)

**Endpoint:** `POST /payments/:id/cancel`
**Auth:** `x-api-key` (merchant only; payment must belong to this merchant)

No request body. Same pattern as finalize. After the escrow deadline, anyone may cancel on-chain without this API.

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "relayRequestId": "uuid-...",
    "transactionHash": null,
    "status": "submitted"
  }
}
```

As with finalize, `data.status` is the relay submission state. The payment status becomes **CANCEL_SUBMITTED** then **CANCELLED** after on-chain confirmation; you then receive the **payment.cancelled** webhook.

### Error Codes

| HTTP | Code                                                                     | Meaning                                             |
| ---- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| 400  | INVALID_STATUS                                                           | Payment is not ESCROWED                             |
| 400  | ESCROW_EXPIRED                                                           | Escrow deadline passed (finalize only)              |
| 403  | FORBIDDEN                                                                | Payment does not belong to this merchant            |
| 404  | PAYMENT_NOT_FOUND                                                        | Payment not found                                   |
| 409  | CONFLICT                                                                 | Concurrent finalize/cancel (e.g. already submitted) |
| 500  | CHAIN_CONFIG_ERROR, SIGNING_SERVICE_ERROR, RELAYER_ERROR, INTERNAL_ERROR | Server or chain issue                               |

See [Error Codes](/en/api/errors) for full details.

---

## Refunds

Refunds are for payments that are already **finalized** (funds have been released to the merchant). To return funds to the buyer after a completed payment, use the Refunds API.

::: info Refund vs Cancel

- **Cancel** — Use when the payment is still **ESCROWED**. Call **POST /payments/:id/cancel** to return funds to the buyer before finalizing. See [Finalize & Cancel](#finalize--cancel).
- **Refund** — Use when the payment is already **FINALIZED**. Call **POST /refunds** to refund the buyer. This section describes the Refund flow.
  :::

### When to use

- The payment status is **FINALIZED** (merchant has received the funds).
- You need to return the full or partial amount to the buyer (e.g. customer request, order cancellation after fulfillment).

### Before refund: merchant must approve

Before the on-chain refund transaction can succeed, the **merchant's wallet (recipient address)** must have **approved** the Payment Gateway contract to spend the refund amount of the payment token. This is done by calling the ERC20 `approve(gatewayAddress, amount)` on the token contract. The gateway does not perform this step; the merchant must do it (or use ERC20 Permit if supported). If the merchant has not approved, the on-chain refund transaction will fail. The Refund API does not check approval on-chain; it only validates auth and payment state and returns the server signature.

### Flow

1. Payment is **FINALIZED** (funds with merchant).
2. Merchant ensures the recipient wallet has **approved** the gateway for the token (see above).
3. Merchant server calls **POST /refunds** with `paymentId` and optional `reason`. Auth: `x-api-key`. The API returns a refund record and **server signature**; it does not submit the transaction to a relayer.
4. Merchant (or a relayer) submits the on-chain refund transaction by calling the gateway contract's `refund(paymentId, serverSignature, permit)`.
5. Refund status moves: **PENDING** → **SUBMITTED** → **CONFIRMED** (or **FAILED**) as the transaction is submitted and confirmed.
6. Use **GET /refunds/:refundId** or **GET /refunds** to track status.

Payment status will show **REFUND_SUBMITTED** then **REFUNDED** when the on-chain refund is confirmed.

### API summary

| Action            | Endpoint                   | Auth        |
| ----------------- | -------------------------- | ----------- |
| Request refund    | **POST /refunds**          | `x-api-key` |
| Get refund status | **GET /refunds/:refundId** | `x-api-key` |
| List refunds      | **GET /refunds**           | `x-api-key` |

Request body for **POST /refunds**: `{ "paymentId": "0x...", "reason": "Customer request" }` (reason optional).

### Full API spec

For request/response schemas, status values, and error codes, see the [Refunds section](/en/api/#refunds) in the full API spec.
