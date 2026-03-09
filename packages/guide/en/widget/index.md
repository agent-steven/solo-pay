# Widget Integration Guide

With the SoloPay payment widget, you can integrate payments without building a custom payment UI. The SDK handles wallet connection, signing, and payment processing.

Choose the package that fits your framework.

## React Projects

The `@solo-pay/widget-react` package integrates the widget using a React hook.

### Installation

```bash
npm install @solo-pay/widget-react
```

### Usage

```typescript
import { useWidget } from '@solo-pay/widget-react';

function CheckoutButton({ orderId, amount }) {
  const { openWidget } = useWidget({
    publicKey: 'pk_xxxxx', // Your issued Public Key
    defaultPaymentRequest: {
      tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
      successUrl: 'https://myshop.com/payment/success',
      failUrl: 'https://myshop.com/payment/fail',
      currency: 'USD',
    },
    onClose: () => console.log('Widget closed.'),
    onError: (err) => console.error('Payment error:', err),
  });

  return (
    <button onClick={() => openWidget({ orderId, amount: String(amount) })}>
      Pay Now
    </button>
  );
}
```

`useWidget` initializes the SDK instance on mount and automatically cleans up on unmount.

## Vanilla JS / Other Frameworks

The `@solo-pay/widget-js` package works without any framework.

### Installation

```bash
npm install @solo-pay/widget-js
```

### Usage

```typescript
import { SoloPay } from '@solo-pay/widget-js';

const solopay = new SoloPay({
  publicKey: 'pk_xxxxx',
});

solopay.requestPayment(
  {
    orderId: 'order-2024-00001',
    amount: '25.5',
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    successUrl: 'https://myshop.com/payment/success',
    failUrl: 'https://myshop.com/payment/fail',
    currency: 'USD',
  },
  {
    onClose: () => {
      // Handle user closing the widget
    },
  }
);
```

### CDN

Use the widget directly via script tag without npm.

```html
<script src="https://cdn.jsdelivr.net/npm/@solo-pay/widget-js/dist/widget.min.js"></script>
<script>
  const solopay = new SoloPay({ publicKey: 'pk_xxxxx' });
  solopay.requestPayment({
    orderId: 'order-2024-00001',
    amount: '25.5',
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    successUrl: 'https://myshop.com/payment/success',
    failUrl: 'https://myshop.com/payment/fail',
    currency: 'USD',
  });
</script>
```

## How It Works

- **Desktop**: The widget opens as a popup window.
- **Mobile**: The user is redirected to a full-screen page.
- After payment completion or failure, the widget auto-redirects to `successUrl` or `failUrl`.

## Callback URL Handling

After payment, SoloPay redirects the user to the `successUrl` or `failUrl` specified at payment creation. The widget automatically appends `paymentId`, `orderId`, and `status` as query parameters.

| Parameter   | Description                                    |
| ----------- | ---------------------------------------------- |
| `paymentId` | The unique payment identifier                  |
| `orderId`   | The merchant order ID                          |
| `status`    | Payment result: `success`, `fail`, or `closed` |

```
https://myshop.com/payment/success?paymentId=0xabc123...&orderId=order-001&status=success
https://myshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=fail
https://myshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=closed
```

::: warning Do Not Trust URL Parameters
URL parameters can be manipulated by the user. Always **verify payment status via API** as the final check.
:::

## Payment Verification (Required)

As soon as the `paymentId` is received from the callback URL, call the status API to verify payment. The `GET /payments/:id` endpoint uses the `x-public-key` header, which can be called from the browser.

```typescript
const response = await fetch(`https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123...`, {
  headers: { 'x-public-key': 'pk_xxxxx' },
});
const result = await response.json();
```

**Verification Checklist**

- [ ] Confirm `status === 'ESCROWED'` (payment success)
- [ ] Confirm `amount` matches order amount
- [ ] Confirm `tokenAddress` matches the expected token
- [ ] Confirm `orderId` matches the expected orderId
- [ ] Prevent duplicate completion processing for the same `paymentId`
- [ ] Call finalize from server, then complete the order only after confirming `FINALIZED` status

::: tip Webhook Integration Recommended
Callbacks are browser-redirect based and can be lost due to network issues. **Using it with Webhooks** allows reliable payment completion reception. [View Webhook Setup Guide](/en/webhooks/)
:::

## Next Steps

- [Webhook Setup](/en/webhooks/) — Reliable payment completion notifications
