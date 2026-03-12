import { describe, it, expect, beforeAll } from 'vitest';
import {
  getWallet,
  getContract,
  getTokenBalance,
  approveToken,
  mintTokens,
  parseUnits,
  PaymentGatewayABI,
} from '../helpers/blockchain';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES } from '../setup/wallets';
import { getToken } from '../fixtures/token';
import { ZERO_PERMIT } from '../helpers/signature';
import { createTestClient, makeCreatePaymentParams, TEST_MERCHANT } from '../helpers/sdk';

const GATEWAY_BASE = (process.env.GATEWAY_URL || 'http://localhost:3001').replace(/\/$/, '');
const GATEWAY_API_URL = `${GATEWAY_BASE}/api/v1`;

/**
 * Webhook Monitor Integration Tests
 *
 * These tests verify the direct payment lifecycle including:
 *   1. Gateway creates payment (DB: CREATED)
 *   2. On-chain pay() -> PaymentPaid event
 *   3. Webhook-manager detects on-chain status -> DB: PAID
 *   4. Funds go directly to recipient (no finalize/cancel steps)
 *
 * Prerequisites:
 *   - Hardhat node running (port 8545)
 *   - Gateway API running (port 3001)
 *   - Simple-relayer running (port 3002)
 *   - Webhook-manager running (with blockchain monitor)
 *   - MySQL + Redis running
 */
describe('Webhook Monitor Integration', () => {
  const token = getToken('test');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  const recipientAddress = HARDHAT_ACCOUNTS.recipient.address;
  const gatewayAddress = CONTRACT_ADDRESSES.paymentGateway;

  let isReady = false;

  beforeAll(async () => {
    // Check if all services are running
    try {
      const [blockchainOk, gatewayOk] = await Promise.all([checkBlockchain(), checkGateway()]);

      if (!blockchainOk || !gatewayOk) {
        console.warn(
          '[webhook-monitor] Skipping tests: services not running.',
          `blockchain=${blockchainOk} gateway=${gatewayOk}`,
          '\nRun: pnpm test:setup'
        );
        return;
      }

      isReady = true;

      // Ensure payer has enough tokens
      const balance = await getTokenBalance(token.address, payerAddress);
      if (balance < parseUnits('5000', token.decimals)) {
        await mintTokens(token.address, payerAddress, parseUnits('50000', token.decimals));
      }
    } catch (err) {
      console.warn('[webhook-monitor] Setup failed:', err);
    }
  });

  // -- Helpers --

  async function checkBlockchain(): Promise<boolean> {
    try {
      const res = await fetch('http://localhost:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function checkGateway(): Promise<boolean> {
    try {
      const res = await fetch(`${GATEWAY_BASE}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create a payment via gateway API and execute pay() on-chain.
   * Uses the deadline and params from the gateway response directly.
   * In direct payment model, funds go directly to recipient.
   */
  async function createAndPayOnChain(
    orderId: string,
    tokenAmount: bigint
  ): Promise<{ paymentHash: string }> {
    // 1. Create payment via gateway API (returns all params)
    const client = createTestClient();
    const params = makeCreatePaymentParams(
      Number(tokenAmount / BigInt(10 ** token.decimals)),
      orderId
    );
    const createRes = await client.createPayment(params);
    const paymentHash = createRes.data.paymentId;

    // 2. Approve token and execute on-chain pay() using gateway response data
    await approveToken(token.address, gatewayAddress, tokenAmount, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);
    const tx = await gateway.pay(
      paymentHash,
      token.address,
      tokenAmount,
      createRes.data.recipientAddress,
      createRes.data.merchantId,
      BigInt(createRes.data.deadline),
      ZERO_PERMIT
    );
    await tx.wait();

    return { paymentHash };
  }

  /**
   * Poll merchant API for payment status until it matches expected status.
   */
  async function waitForDbStatus(
    paymentHash: string,
    expectedStatus: string,
    timeoutMs: number = 30000,
    intervalMs: number = 1000
  ): Promise<{ status: string; txHash?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const res = await fetch(`${GATEWAY_API_URL}/merchant/payments/${paymentHash}`, {
          headers: { 'x-api-key': TEST_MERCHANT.apiKey },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            success: boolean;
            data: {
              status: string;
              txHash?: string;
            };
          };
          if (body.data.status === expectedStatus) {
            return body.data;
          }
        }
      } catch {
        // Retry on fetch error
      }
      await sleep(intervalMs);
    }

    throw new Error(
      `Payment ${paymentHash} did not reach status ${expectedStatus} within ${timeoutMs}ms`
    );
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // -- Tests --

  describe('PAID detection', () => {
    it('should detect on-chain PaymentPaid and update DB to PAID', async () => {
      if (!isReady) return;

      const orderId = `WH_PAID_${Date.now()}`;
      const amount = parseUnits('100', token.decimals);

      const { paymentHash } = await createAndPayOnChain(orderId, amount);

      // Wait for webhook-manager to detect the on-chain Paid status
      const result = await waitForDbStatus(paymentHash, 'PAID', 30000);
      expect(result.status).toBe('PAID');
      // txHash = pay tx
      expect(result.txHash).toBeDefined();
      expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe('Full lifecycle: pay -> verify balances', () => {
    it('should correctly transfer funds through direct payment lifecycle', async () => {
      if (!isReady) return;

      const orderId = `WH_LIFECYCLE_${Date.now()}`;
      const amount = parseUnits('200', token.decimals);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
      const initialRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      // 1. Pay -> PAID (funds go directly to recipient)
      const { paymentHash } = await createAndPayOnChain(orderId, amount);
      await waitForDbStatus(paymentHash, 'PAID', 30000);

      // Payer balance decreased
      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      expect(finalPayerBalance).toBe(initialPayerBalance - amount);

      // 2. Verify recipient received funds directly (no finalize needed)
      const finalRecipientBalance = await getTokenBalance(token.address, recipientAddress);
      expect(finalRecipientBalance).toBeGreaterThan(initialRecipientBalance);

      // Payer balance still decreased
      expect(finalPayerBalance).toBe(initialPayerBalance - amount);
    });
  });
});
