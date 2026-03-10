# How Payments Work & Core Architecture

An overview of SoloPay's full payment pipeline and gasless architecture.

## 2.1 Full Payment Pipeline

Every SoloPay payment is processed in the following 5 steps.

```
[1] SoloPay Widget
    POST /payments → receives paymentId, contract addresses

         ↓

[2] User Wallet (MetaMask)
    Generate EIP-712 signature (no transaction, no gas fees)

         ↓

[3] SoloPay Relayer
    Receive signature → verify signature → submit on-chain TX

         ↓

[4] Blockchain (PaymentGateway Contract)
    pay() executes → token transfer & event emitted

         ↓

[5] SoloPay → Merchant Server
    Send PAID / INVALID Webhook event
```

When the payment is confirmed as **PAID**, the funds have been transferred directly to the merchant wallet. No additional finalize or cancel step is needed.

### Step-by-Step

| Step                   | Actor          | Action                                                 |
| :--------------------- | :------------- | :----------------------------------------------------- |
| **1. Payment Request** | SoloPay Widget | `POST /payments` → get `paymentId`, contract addresses |
| **2. Signing**         | User Wallet    | EIP-712 sign only (no TX, no gas)                      |
| **3. Relayer**         | SoloPay Server | Verify signature → submit on-chain TX                  |
| **4. Contract**        | Blockchain     | `pay()` → token transferred to merchant                |
| **5. Webhook**         | SoloPay Server | Sends events to your Webhook URL (see rows below)      |
| **5a.** `PAID`         | SoloPay Server | Payment confirmed on-chain. Complete the order         |
| **5b.** `INVALID`      | SoloPay Server | On-chain payment detected but validation failed        |

**What happens next:**

- **Success:** You receive `PAID` → order complete (funds transferred to merchant wallet).
- **Refund (coming soon):** After `PAID`, you can request a refund via **POST /payments/refunds** → status becomes `REFUND_SUBMITTED` → then `REFUNDED` when confirmed.

Details: [Webhook Events](/en/webhooks/events) · [Refunds](/en/payments/refunds).

## 2.2 Gasless & Relayer System

### Standard Payment vs Gasless Payment

```
Standard Payment (Direct Pay)           Gasless Payment (Gasless Pay)
────────────────────────────            ─────────────────────────────

  User                                    User
    │                                       │
    │ ① Sends transaction directly          │ ① Generates signature data only
    │   (gas: paid by user)                 │   (no transaction, no gas)
    ▼                                       ▼
PaymentGateway Contract              SoloPay Widget → SoloPay Relayer
                                             │
                                             │ ② Verifies signature, submits TX
                                             │   (gas: paid by relayer)
                                             ▼
                                    PaymentGateway Contract
```

### The Relayer's Role

The relayer is a server operated by SoloPay. It acts as the core intermediary for gasless payments.

1. **Receive Signature**: Receives the user's EIP-712 signature data from the SoloPay widget.
2. **Verify Signature**: Validates that the EIP-712 signature is correctly formatted and matches the user's address.
3. **Cover Gas Fees**: Pays gas from the relayer wallet and submits the transaction to `PaymentGateway` via the `ERC2771Forwarder` contract.
4. **Monitor Status**: Tracks the on-chain status of the transaction (`QUEUED` → `SUBMITTED` → `CONFIRMED`/`FAILED`).

::: info ERC-2771 Meta-Transactions
SoloPay uses OpenZeppelin's `ERC2771Forwarder` standard. This allows the relayer to submit transactions on behalf of the user while the contract can still correctly identify the original user (signer).
:::

## 2.3 Gasless Behavior by Token Type (Permit Support)

The level of gasless support depends on whether the token supports `Permit (EIP-2612)`.

### A. Fully Gasless — Permit-Supported Tokens (e.g., USDC)

Tokens that support EIP-2612 Permit process everything — including the first payment — with **a single signature**, with no Approve transaction required.

```
All payments including the first:

  User
    │
    │ ① EIP-2612 Permit signature (no gas)
    │ ② EIP-712 ForwardRequest signature (no gas)
    ▼
  Relayer → Contract execution (gas: paid by relayer)

→ User gas cost: 0
```

The SoloPay payment widget automatically detects Permit support and handles it accordingly.

### B. Partially Gasless — Non-Permit Tokens (Standard ERC-20)

Standard ERC-20 tokens (without Permit) require a one-time Approve via the `allowance` method.

**First time only (user pays gas)**

```
  User
    │
    │ ① Send approve(gatewayAddress, max amount) transaction
    │   (gas: paid by user — one time only)
    ▼
  Allowance registered on PaymentGateway contract
```

**All subsequent payments (fully gasless)**

```
  User
    │
    │ ① EIP-712 ForwardRequest signature (no gas)
    ▼
  Relayer → Contract execution (gas: paid by relayer)

→ No gas fees from the second payment onward
```

::: tip Infinite Approve Recommended
Approving the maximum value (`BigInt(2**256 - 1)`) in the first Approve allows hundreds of subsequent payments without additional Approves.
:::

### Permit Support Comparison

| Item                   | Permit-Supported Tokens (USDC, etc.) | Standard ERC-20         |
| ---------------------- | ------------------------------------ | ----------------------- |
| First payment gas      | None ✅                              | Required (once) ⚠️      |
| Subsequent payment gas | None ✅                              | None ✅                 |
| Implementation effort  | Low                                  | Low (one extra Approve) |

## 2.4 Transaction Status Cycle

### Payment Status

```
CREATED ──► PAID
PAID    ──► REFUND_SUBMITTED ──► REFUNDED (coming soon)
CREATED ──► INVALID
CREATED ──► EXPIRED
CREATED ──► FAILED
```

| Status             | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `CREATED`          | Payment created, awaiting on-chain transaction                       |
| `PAID`             | Payment confirmed on-chain, funds transferred to merchant (terminal) |
| `REFUND_SUBMITTED` | Refund transaction submitted (coming soon)                           |
| `REFUNDED`         | Refund completed (coming soon)                                       |
| `INVALID`          | On-chain payment detected but validation failed                      |
| `EXPIRED`          | Payment expired                                                      |
| `FAILED`           | Transaction failed                                                   |

### Relay Status (Gasless only)

```
QUEUED ──────▶ SUBMITTED ──────▶ CONFIRMED
                    │
                    ▼
                  FAILED
```

| Status      | Description                                   |
| ----------- | --------------------------------------------- |
| `QUEUED`    | Relayer received signature data, preparing TX |
| `SUBMITTED` | Relayer submitted TX to blockchain            |
| `CONFIRMED` | TX included in block and confirmed            |
| `FAILED`    | TX failed (out of gas, contract revert, etc.) |

::: info Payment Status vs Relay Status

- **Payment Status** reflects the on-chain state (e.g. PAID, INVALID, EXPIRED).
- **Relay Status** reflects the relayer's TX submission process (QUEUED → SUBMITTED → CONFIRMED/FAILED).
- When the payment TX is confirmed, payment status becomes PAID and funds are transferred directly to the merchant wallet.
  :::

## Next Steps

- [Refunds](/en/payments/refunds) — Request a refund for a completed payment
- [Smart Contract Info](/en/developer/smart-contracts) — Contract addresses and ABI
- [Client-Side Integration](/en/developer/client-side) — Step-by-step implementation guide
