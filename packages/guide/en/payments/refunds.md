# Refunds

Refunds are for payments that are already **finalized** (funds have been released to the merchant). To return funds to the buyer after a completed payment, use the Refunds API.

::: info Refund vs Cancel

- **Cancel** — Use when the payment is still **ESCROWED**. Call **POST /payments/:id/cancel** to return funds to the buyer before finalizing. See [Finalize & Cancel](/en/payments/finalize).
- **Refund** — Use when the payment is already **FINALIZED**. Call **POST /refunds** to refund the buyer. This page describes the Refund flow.
  :::

## When to use

- The payment status is **FINALIZED** (merchant has received the funds).
- You need to return the full or partial amount to the buyer (e.g. customer request, order cancellation after fulfillment).

## Before refund: merchant must approve

Before the on-chain refund transaction can succeed, the **merchant's wallet (recipient address)** must have **approved** the Payment Gateway contract to spend the refund amount of the payment token. This is done by calling the ERC20 `approve(gatewayAddress, amount)` on the token contract. The gateway does not perform this step; the merchant must do it (or use ERC20 Permit if supported). If the merchant has not approved, the on-chain refund transaction will fail. The Refund API does not check approval on-chain; it only validates auth and payment state and returns the server signature.

## Flow

1. Payment is **FINALIZED** (funds with merchant).
2. Merchant ensures the recipient wallet has **approved** the gateway for the token (see above).
3. Merchant server calls **POST /refunds** with `paymentId` and optional `reason`. Auth: `x-api-key`. The API returns a refund record and **server signature**; it does not submit the transaction to a relayer.
4. Merchant (or a relayer) submits the on-chain refund transaction by calling the gateway contract's `refund(paymentId, serverSignature, permit)`.
5. Refund status moves: **PENDING** → **SUBMITTED** → **CONFIRMED** (or **FAILED**) as the transaction is submitted and confirmed.
6. Use **GET /refunds/:refundId** or **GET /refunds** to track status.

Payment status will show **REFUND_SUBMITTED** then **REFUNDED** when the on-chain refund is confirmed.

## API summary

| Action            | Endpoint                   | Auth        |
| ----------------- | -------------------------- | ----------- |
| Request refund    | **POST /refunds**          | `x-api-key` |
| Get refund status | **GET /refunds/:refundId** | `x-api-key` |
| List refunds      | **GET /refunds**           | `x-api-key` |

Request body for **POST /refunds**: `{ "paymentId": "0x...", "reason": "Customer request" }` (reason optional).

## Full API spec

For request/response schemas, status values, and error codes, see the [Refunds section](/en/api/#refunds) in the full API spec.

## Next steps

- [Finalize & Cancel](/en/payments/finalize) — Release or cancel escrowed payments (before finalized)
- [Payment Status](/en/payments/status) — Status values including REFUND_SUBMITTED, REFUNDED
- [Error Codes](/en/api/errors) — API error handling
