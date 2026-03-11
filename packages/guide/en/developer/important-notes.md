# Important Notes

This page summarizes the essential points you must understand when integrating SoloPay.

## Why is orderId required?

- `orderId` is an idempotency key that prevents duplicate payments within a merchant's system.
- If you send another request with the same `orderId`, a `DUPLICATE_ORDER` (409) error is returned.
- Follow the principle of one `orderId` per order.

## What happens if the user closes the window during payment?

- `successUrl`/`failUrl` rely on browser redirects, so they will not be reached if the user closes the window.
- You must implement Webhooks (`payment.paid`, `payment.invalid`) to reliably receive payment results.
- Using both Webhooks and Callback URLs together is recommended.
- As a fallback, you can poll using `GET /merchant/payments/:id`.

## Always verify payment results on the server

- URL query parameters (`paymentId`, `status`) can be manipulated by the user.
- You must call `GET /merchant/payments/:id` from your server to confirm the actual payment status.
- Verification checklist:
  - Confirm that `status` is `PAID` (payment success)
  - Confirm that `amount` matches the expected amount **in your order database** (the widget runs client-side and the amount could be tampered with)
  - Confirm that `recipientAddress` matches your merchant wallet address (prevents self-payment attacks where an attacker substitutes the recipient)
  - Confirm that `tokenAddress` matches the expected token
  - Confirm that `orderId` matches the expected value
  - Prevent duplicate processing of the same `paymentId`

## Direct Payment Model

- SoloPay uses a direct payment model where funds are transferred directly to the merchant wallet on-chain.
- There is no escrow step — once the payment is confirmed as **PAID**, the merchant has received the funds.
- If needed, the merchant can request a refund via **POST /refunds** (requires PAID status).

## What should you verify when receiving PAID status?

- Confirm receipt of the `payment.paid` webhook, or verify `status === "PAID"` via `GET /merchant/payments/:id`.
- Match `amount` against the expected amount **in your order database** — since the widget runs client-side, the amount in the payment request could have been tampered with.
- Confirm `recipientAddress` matches your merchant wallet address — an attacker could substitute the recipient to redirect funds to themselves.
- Match `orderId` and `tokenAddress` against your order data.
- Confirm that the payment has not already been processed (prevent duplicate order completion).

## How do refunds work?

SoloPay does not currently provide an automated refund feature. If a refund is needed, **the merchant must handle it manually**.

::: warning Refunds must be handled by the merchant
SoloPay operates on a direct payment model — funds are transferred directly to the merchant wallet at the time of payment. If a refund is required, the merchant must send funds back to the buyer directly or handle it according to their own refund policy.
:::

## Next steps

- [Payment details](/en/payments/) - Full payment API reference
- [Webhook setup](/en/webhooks/) - Receiving payment events
