# Callback URL

Receive payment results via browser redirect after payment completion.

## Overview

When a user completes (or fails/closes) a payment, the SoloPay widget redirects the user to the `successUrl` or `failUrl` specified at payment creation. `paymentId`, `orderId`, and `status` are automatically appended as query parameters.

```
User completes payment
    ↓
SoloPay widget redirects to successUrl or failUrl
    ↓
Merchant page receives query parameters
    ↓
Server calls GET /payments/:id to verify (required)
```

## How It Works

- **Desktop**: Payment proceeds in a popup window. After completion, the popup closes and the user is redirected to `successUrl` or `failUrl`.
- **Mobile**: The user is redirected to a full-screen page for payment. After completion, the user is redirected to `successUrl` or `failUrl`.

## Setting successUrl / failUrl

Specify `successUrl` and `failUrl` when calling the widget.

```typescript
solopay.requestPayment({
  orderId: 'order-001',
  amount: '10.5',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  successUrl: 'https://yourshop.com/payment/success',
  failUrl: 'https://yourshop.com/payment/fail',
});
```

- `successUrl` — Redirect on payment success
- `failUrl` — Redirect on payment failure or when the user closes the widget

## Query Parameters

The widget automatically appends the following parameters on redirect.

| Parameter   | Description                                    |
| ----------- | ---------------------------------------------- |
| `paymentId` | The unique payment identifier                  |
| `orderId`   | The merchant order ID                          |
| `status`    | Payment result: `success`, `fail`, or `closed` |

### Status Values

| Value     | Redirect URL | Description                                                                          |
| --------- | ------------ | ------------------------------------------------------------------------------------ |
| `success` | `successUrl` | Payment completed successfully                                                       |
| `fail`    | `failUrl`    | Payment failed due to transaction failure                                            |
| `closed`  | `failUrl`    | User closed the widget before completing payment (payment may not have been created) |

### Example URLs

```
https://yourshop.com/payment/success?paymentId=0xabc123...&orderId=order-001&status=success
https://yourshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=fail
https://yourshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=closed
```

## Frontend Handling Example

Parse the query parameters on your `successUrl` or `failUrl` page and verify the payment status via your server API.

```typescript
// successUrl page (e.g., /payment/success)
const params = new URLSearchParams(window.location.search);
const paymentId = params.get('paymentId');
const orderId = params.get('orderId');
const status = params.get('status');

if (paymentId) {
  // Verify payment status on server (required)
  const response = await fetch(`/api/verify-payment?paymentId=${paymentId}`);
  const result = await response.json();

  if (result.verified) {
    // Show order completion screen
  } else {
    // Handle verification failure
  }
}
```

```typescript
// failUrl page (e.g., /payment/fail)
const params = new URLSearchParams(window.location.search);
const status = params.get('status');

if (status === 'closed') {
  // Show "Payment was cancelled" message
} else {
  // Show "Payment failed. Please try again" message
}
```

## Payment Verification (Required)

::: warning Do Not Trust URL Parameters
Query parameters can be manipulated by the user. Even if `status=success`, you must call the API from your server to verify the actual payment status.
:::

Once you receive a `paymentId`, call `GET /payments/:id` from your server to verify the final status.

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

**Verification Checklist**

- [ ] Confirm `status === 'PAID'` (payment success)
- [ ] Confirm `amount` matches the expected amount **in your order database** (the widget runs client-side and the amount could be tampered with)
- [ ] Confirm `tokenAddress` matches the expected token
- [ ] Confirm `orderId` matches the expected orderId
- [ ] Prevent duplicate completion processing for the same `paymentId`

## Limitations and Considerations

- Callback URLs are **browser-redirect based** and can be lost due to network issues.
- If the user closes the browser mid-payment or loses network connectivity, the redirect to `successUrl`/`failUrl` may not occur.
- Callback URLs **alone cannot guarantee payment result delivery**.

## Use Webhooks Together

To compensate for callback limitations, it is strongly recommended to **use Webhooks alongside Callback URLs**.

| Method       | Delivery Path | Reliability | Purpose                       |
| ------------ | ------------- | ----------- | ----------------------------- |
| Callback URL | Browser       | Low         | Display result page to user   |
| Webhook      | Server        | High        | Update order status on server |

- Callback URL — For user experience (showing result pages)
- Webhook — For server-side order completion processing
- Both channels require final verification via `GET /payments/:id`

## Next Steps

- [Webhook Guide](/en/webhooks/) — Server-side payment notifications
- [Payment Status](/en/payments/) — Check payment status via API
