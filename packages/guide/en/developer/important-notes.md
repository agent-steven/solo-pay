# Important Notes

This page summarizes the essential points you must understand when integrating SoloPay.

## Why is orderId required?

- `orderId` is an idempotency key that prevents duplicate payments within a merchant's system.
- If you send another request with the same `orderId`, a `DUPLICATE_ORDER` (409) error is returned.
- Follow the principle of one `orderId` per order.

## What happens if the user closes the window during payment?

- `successUrl`/`failUrl` rely on browser redirects, so they will not be reached if the user closes the window.
- You must implement Webhooks (`ESCROWED`, `FINALIZED`, etc.) to reliably receive payment results.
- Using both Webhooks and Callback URLs together is recommended.
- As a fallback, you can poll using `GET /payments/:id`.

## Always verify payment results on the server

- URL query parameters (`paymentId`, `status`) can be manipulated by the user.
- You must call `GET /payments/:id` from your server to confirm the actual payment status.
- Verification checklist:
  - Confirm that `status` is `ESCROWED` (payment success)
  - Confirm that `amount` matches the order amount
  - Confirm that `tokenAddress` matches the expected token
  - Confirm that `orderId` matches the expected value
  - Prevent duplicate processing of the same `paymentId`
  - Call finalize, then complete the order only after confirming `FINALIZED` status

## Why you must call Finalize/Cancel

- Once a payment reaches the `ESCROWED` state, funds are locked in the smart contract.
- The merchant must explicitly call finalize (release funds) or cancel (refund to buyer).
- If neither is called, funds remain locked until the escrow deadline (default: 5 minutes) expires.

## What happens if you do not call Finalize?

- If finalize is not called within the escrow deadline (default: 300 seconds = 5 minutes):
  - The API returns `ESCROW_EXPIRED` and finalize is no longer possible.
  - Permissionless cancel is activated on the contract, allowing anyone (including the buyer) to call cancel on-chain.
- Funds are NOT automatically returned. Someone must call cancel for the funds to be refunded to the buyer.
- This results in lost revenue for the merchant.

## What happens if you do not call Cancel?

- After escrow expiry, permissionless cancel is activated, so the buyer or a third party can call cancel directly on-chain.
- Until someone calls cancel, funds remain locked in the contract. They are not automatically refunded.
- Funds are not permanently locked, but the waiting period degrades the user experience.

## What should you verify before calling Finalize?

- Confirm receipt of the `ESCROWED` webhook, or verify `status === "ESCROWED"` via `GET /payments/:id`.
- Confirm that `amount` matches the merchant's order amount.
- Confirm that `orderId` matches the merchant's records.
- Confirm that the payment has not already been processed (prevent duplicate finalize calls).

## Next steps

- [Payment details](/en/payments/) - Full payment API reference
- [Webhook setup](/en/webhooks/) - Receiving payment events
