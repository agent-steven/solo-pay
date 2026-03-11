# Quick Start

Get SoloPay integrated in 5 minutes.

## Prerequisites

- API Key and Public Key (provided by admin)
- Node.js 18 or higher

## Step 1: Create Order in Your Database

Before calling the payment widget, create an order record on your server and save it to your database.

- **orderId**: A unique identifier for the order within your merchant account. SoloPay enforces uniqueness per merchant — duplicate `orderId` values will be rejected with a `DUPLICATE_ORDER` error.
- **Save the expected amount and token address** alongside the `orderId`. These values are needed later to verify that the completed payment matches what you intended (see Step 4).
- **Must be stored server-side**: The widget runs in the user's browser, where parameters like `amount` could be tampered with. Only values stored on your server can be trusted for verification.
- **orderId for payment lookup**: When you don't yet know the `paymentId`, you can look up the payment using `orderId` via `GET /merchant/payments?orderId=xxx` (requires API Key).

## Step 2: Open Payment Widget

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

::: warning amount decimal restriction
`amount` allows a maximum of **2 decimal places** (e.g., `10.50` ✓, `10.123` ✗). Without `currency`, the value is used directly as the token amount. With `currency`, the fiat amount is converted to token units and truncated to 2 decimal places. The minimum token amount is `0.01`.
:::

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

## Step 3: Receive Payment Results

After payment completes, results are delivered through two channels.

### Callback URL (Frontend)

The user is redirected to the `successUrl` or `failUrl` specified in Step 2. `paymentId`, `orderId`, and `status` are passed as query parameters.

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

- `payment.paid` — Payment confirmed on-chain
- `payment.invalid` — Payment validation failed

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "PAID",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "paidAt": "2024-01-26T12:35:00.000Z"
}
```

See the [Webhook Guide](/en/webhooks/) for details.

## Step 4: Verify Payment Status (Required)

Whether from Callback or Webhook, always verify the final status by calling the **Merchant API** from your server. Never trust URL parameters or Webhook payload directly.

::: warning Do not verify with Public Key
The Public Key (`pk_xxxxx`) is only for widget initialization. Always use your **API Key** (`sk_xxxxx`) for server-side verification.
:::

**Verify by paymentId:**

```bash
curl "https://gateway.dev.solonetwork.io/merchant/payments/0xabc123..." \
  -H "x-api-key: sk_xxxxx"
```

**Verify by orderId** (if you don't have the `paymentId` yet):

```bash
curl "https://gateway.dev.solonetwork.io/merchant/payments?orderId=order-001" \
  -H "x-api-key: sk_xxxxx"
```

**Verification Checklist**

- [ ] Confirm `status === 'PAID'` (payment success)
- [ ] Confirm `amount` matches the expected amount **in your order database** (the widget runs client-side and the amount could be tampered with)
- [ ] Confirm `tokenAddress` matches the expected token
- [ ] Confirm `orderId` matches the expected orderId
- [ ] Prevent duplicate completion processing for the same `paymentId`

## Step 5: Complete Order After PAID

When the payment status is **PAID**, the payment is confirmed on-chain and funds have been transferred directly to the merchant wallet. No additional API call is needed.

Complete your order fulfillment (shipping products, activating services, etc.) after confirming `status === 'PAID'` via `GET /payments/:id` or the `payment.paid` webhook.

::: tip Direct Payment Model
Unlike escrow-based systems, SoloPay transfers funds directly to the merchant on payment. There is no separate finalize step.
:::

## Payment Status Flow

```
CREATED ──► PAID
CREATED ──► EXPIRED
CREATED ──► FAILED
CREATED ──► INVALID
```

| Status    | Description                  |
| --------- | ---------------------------- |
| `CREATED` | Payment created              |
| `PAID`    | Payment confirmed on-chain   |
| `INVALID` | Payment validation failed    |
| `FAILED`  | Transaction failed           |
| `EXPIRED` | Expired (5 minutes exceeded) |

## Next Steps

- [Webhook Guide](/en/webhooks/) - Webhook events and verification
- [Payment Status](/en/payments/status) - All payment status values
- [Authentication](/en/developer/authentication) - API Key / Public Key details
- [Create Payment API](/en/payments/create) - Detailed payment API guide
