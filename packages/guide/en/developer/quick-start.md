# Quick Start

Get SoloPay integrated in 5 minutes.

## Prerequisites

- API Key and Public Key (provided by admin)
- Node.js 18 or higher

## Step 1: Open Payment Widget

Open the payment widget with `@solo-pay/widget-js`. The widget handles payment creation, wallet connection, signing, and processing.

```bash
npm install @solo-pay/widget-js
```

```typescript
import { SoloPay } from '@solo-pay/widget-js';

const solopay = new SoloPay({
  publicKey: 'pk_xxxxx',
});

solopay.requestPayment({
  orderId: 'order-001',
  amount: '10.5',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  successUrl: 'https://yourshop.com/payment/success',
  failUrl: 'https://yourshop.com/payment/fail',
});
```

For React projects, using the [`useWidget` hook from `@solo-pay/widget-react`](/en/widget/) is recommended.

For Vanilla JS or other frameworks, you can use the CDN directly.

```html
<script src="https://cdn.jsdelivr.net/npm/@solo-pay/widget-js/dist/widget.min.js"></script>
<script>
  const solopay = new SoloPay({ publicKey: 'pk_xxxxx' });
  solopay.requestPayment({
    orderId: 'order-001',
    amount: '10.5',
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    successUrl: 'https://yourshop.com/payment/success',
    failUrl: 'https://yourshop.com/payment/fail',
  });
</script>
```

## Step 2: Receive Payment Results

After payment completes, results are delivered through two channels.

### Callback URL (Frontend)

The user is redirected to the `successUrl` or `failUrl` specified in Step 1. `paymentId`, `orderId`, and `status` are passed as query parameters.

- `successUrl` — `status=success` (payment succeeded)
- `failUrl` — `status=fail` (payment failed) or `status=closed` (user closed the widget)

```
https://yourshop.com/payment/success?paymentId=0xabc123...&orderId=order-001&status=success
https://yourshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=closed
```

::: warning Callback URL alone is not sufficient
Callbacks are browser-redirect based and can be lost due to network issues. Always use Webhook together.
:::

### Webhook (Server)

Register a Webhook URL with your account admin to receive HTTP POST notifications whenever the payment status changes.

Key events:

- `ESCROWED` — User payment completed, held in escrow
- `FINALIZED` — Funds released to merchant wallet

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

See the [Webhook Guide](/en/webhooks/) for details.

## Step 3: Verify Payment Status (Required)

Whether from Callback or Webhook, always verify the final status by calling the API from your server. Never trust URL parameters or Webhook payload directly.

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

When `status` is `ESCROWED` and `amount`, `tokenAddress`, `orderId` match your order data, the payment is valid. Call finalize in Step 4 to confirm the payment.

## Step 4: Finalize or Cancel Payment

After payment reaches **ESCROWED** status, verify the order details and call finalize or cancel.

- **Finalize** — Release funds to the merchant wallet.
- **Cancel** — Refund funds to the buyer (e.g. out of stock, order mismatch).

```bash
# Finalize
curl -X POST https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123.../finalize \
  -H "x-api-key: sk_xxxxx"

# Cancel
curl -X POST https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123.../cancel \
  -H "x-api-key: sk_xxxxx"
```

::: warning Always call finalize or cancel
After escrow expiry, finalize is no longer possible and anyone can call cancel on-chain to refund the buyer.
:::

See [Finalize & Cancel](/en/payments/finalize) for details.

## Step 5: Complete Order After FINALIZED

::: danger Never complete the order before FINALIZED
Even after calling finalize, the blockchain transaction can fail due to network issues. You must confirm `FINALIZED` status before completing the order.
:::

After calling finalize, the status transitions from `FINALIZE_SUBMITTED` to `FINALIZED`. Confirm `FINALIZED` using one of the following methods.

- **Webhook** — On receiving the `FINALIZED` event, call `GET /payments/:id` to re-confirm `FINALIZED` status
- **API Polling** — Periodically call `GET /payments/:id` and confirm `status === 'FINALIZED'`

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

Only after confirming `FINALIZED` status should you proceed with order fulfillment such as shipping products or activating services.

## Payment Status Flow

```
CREATED ──► ESCROWED ──► FINALIZE_SUBMITTED ──► FINALIZED
                    └──► CANCEL_SUBMITTED   ──► CANCELLED
CREATED ──► EXPIRED
CREATED ──► FAILED
```

| Status      | Description                  |
| ----------- | ---------------------------- |
| `CREATED`   | Payment created              |
| `ESCROWED`  | User paid; funds in escrow   |
| `FINALIZED` | Funds released to merchant   |
| `FAILED`    | Transaction failed           |
| `EXPIRED`   | Expired (5 minutes exceeded) |

## Next Steps

- [Webhook Guide](/en/webhooks/) - Webhook events and verification
- [Finalize & Cancel](/en/payments/finalize) - Release or cancel escrowed payments
- [Authentication](/en/developer/authentication) - API Key / Public Key details
- [Create Payment API](/en/payments/create) - Detailed payment API guide
