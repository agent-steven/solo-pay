# Merchant

A guide for merchant setup and management.

## Merchant Registration

To use SoloPay, you must first contact the SoloPay operations team to register as a merchant. The following information is required for registration:

- Your service (e.g., store) domain
- The chain you will use (e.g., Polygon Amoy 80002)
- Recipient wallet address (the ERC-20 token wallet to receive payments)
- The token address to use for payments

Once registration is complete, you will receive an API Key and a Public Key from the operations team.

## API Authentication

SoloPay API uses two authentication methods depending on the endpoint type. After merchant registration, you will receive two keys from the operations team.

### Public Key (x-public-key)

- Used on the frontend (client-side).
- Prefix: `pk_...`
- Used for payment creation (`POST /payments`), payment status queries (`GET /payments/:id`), and relay submission (`POST /payments/:id/relay`).
- Can be exposed in the browser, but domain verification is enforced via the `Origin` header.

### API Key (x-api-key)

- Used on the backend (server-side) only.
- Prefix: `sk_...`
- Used for merchant info queries (`GET /merchant`), payment history (`GET /merchant/payments`), payment finalization (`POST /payments/:id/finalize`), payment cancellation (`POST /payments/:id/cancel`), and refunds (`POST /refunds`).
- Never expose in frontend code.

::: danger API Key Security
Never include API Keys starting with `sk_` in frontend code. The API Key is for admin/management purposes only and is not required for client-side widget integration.
:::

## Activating Payment Methods

After merchant registration, you must activate the tokens you want to use for payment. This is a one-time admin setup step performed separately from client-side integration.

- Contact the SoloPay operations team or use the dashboard to activate payment methods.
- If using the API directly, the `POST /merchant/payment-methods` endpoint requires the API Key (`sk_...`).
- Activated payment methods can be queried via the `GET /merchant/payment-methods` endpoint.
- Existing payment methods can be enabled or disabled via the `PATCH /merchant/payment-methods/:id` endpoint.

::: tip Permit (EIP-2612) Supported Tokens
Tokens that support EIP-2612 such as USDC enable 100% gasless payments from the very first transaction -- no Approve transaction required.
:::

## Merchant Info Query

Use the `GET /merchant` endpoint to retrieve current merchant information. API Key (`x-api-key`) authentication is required.

```bash
curl https://gateway.dev.solonetwork.io/api/v1/merchant \
  -H "x-api-key: sk_xxxxx"
```

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

The response includes basic merchant information, connected chain details, a list of activated payment methods, and the available tokens on that chain.

## Security Best Practices

**Do**

- Store API Keys in environment variables.
- Use API Keys on the server-side only.
- Configure Origin domain restrictions when possible.

**Don't**

- Expose API Keys in client code.
- Commit keys to version control (e.g., Git).
- Print keys in logs.

**Environment Variable Setup**

```bash
SOLO_PAY_API_KEY=sk_xxxxx
SOLO_PAY_PUBLIC_KEY=pk_xxxxx
```

**Origin Verification**

When `ALLOWED_WIDGET_ORIGIN` is set on the server, the `Origin` header will be validated. In browser environments, `Origin` is set automatically.

```bash
ALLOWED_WIDGET_ORIGIN=https://yourshop.com
```

::: danger Prohibited
Never include your API Key (`sk_...`) in frontend code. Only Public Keys (`pk_...`) should be used on the client side.
:::

## Next Steps

- [Quick Start](/en/developer/quick-start) - Your first payment integration
- [Payments](/en/payments/) - Payment API details
