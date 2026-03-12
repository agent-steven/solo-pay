import { describe, it, expect, beforeAll } from 'vitest';
import {
  getProvider,
  getWallet,
  getContract,
  getTokenBalance,
  approveToken,
  mintTokens,
  parseUnits,
  PaymentGatewayABI,
  ERC2771ForwarderABI,
} from '../helpers/blockchain';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES, TEST_CHAIN_ID } from '../setup/wallets';
import { getToken } from '../fixtures/token';
import {
  generatePaymentId,
  signForwardRequest,
  encodeRefundFunctionData,
  buildForwardRequestData,
  merchantKeyToId,
  getDeadline,
  ZERO_PERMIT,
  type ForwardRequest,
} from '../helpers/signature';
import {
  createTestClient,
  waitForPaymentStatus,
  TEST_MERCHANT,
  makeCreatePaymentParams,
} from '../helpers/sdk';

describe('Refund Flow Integration', () => {
  const token = getToken('mockUSDT');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const relayerPrivateKey = HARDHAT_ACCOUNTS.relayer.privateKey;
  const recipientPrivateKey = HARDHAT_ACCOUNTS.recipient.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  const recipientAddress = HARDHAT_ACCOUNTS.recipient.address;
  const gatewayAddress = CONTRACT_ADDRESSES.paymentGateway;
  const forwarderAddress = CONTRACT_ADDRESSES.forwarder;

  const merchantKey = 'merchant_demo_001';
  const merchantId = merchantKeyToId(merchantKey);

  const GATEWAY_BASE = (process.env.GATEWAY_URL || 'http://localhost:3001').replace(/\/$/, '');
  const RELAYER_BASE = (
    process.env.RELAY_API_URL ||
    process.env.RELAYER_URL ||
    'http://localhost:3002'
  ).replace(/\/$/, '');

  let blockchainRunning = false;
  let gatewayAndRelayerReady = false;

  async function checkGatewayAndRelayer(): Promise<boolean> {
    try {
      const [gw, rly] = await Promise.all([
        fetch(`${GATEWAY_BASE}/health`, { signal: AbortSignal.timeout(3000) }),
        fetch(`${RELAYER_BASE}/health`, { signal: AbortSignal.timeout(3000) }),
      ]);
      return gw.ok && rly.ok;
    } catch {
      return false;
    }
  }

  async function checkBlockchain(): Promise<boolean> {
    try {
      const provider = getProvider();
      await provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Execute a direct payment (payer -> recipient) and return the paymentId.
   * In the direct payment model, funds go directly to the recipient -- no finalize step.
   */
  async function executePayment(orderId: string, amount: bigint): Promise<string> {
    const paymentId = generatePaymentId(orderId);

    const deadline = getDeadline(1);

    await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);
    const tx = await gateway.pay(
      paymentId,
      token.address,
      amount,
      recipientAddress,
      merchantId,
      deadline,
      ZERO_PERMIT
    );
    await tx.wait();

    return paymentId;
  }

  /**
   * Helper: Execute a refund from recipient (merchant) to payer.
   * Refund reads token, amount, payer from on-chain storage.
   * Recipient must approve the gateway for the full payment amount.
   * In the new contract, refund takes 2 args: (paymentId, permit).
   */
  async function executeRefund(paymentId: string, amount: bigint): Promise<void> {
    // Recipient approves gateway to spend tokens for the refund
    await approveToken(token.address, gatewayAddress, amount, recipientPrivateKey);

    // Recipient calls refund (msg.sender = recipient)
    const recipientWallet = getWallet(recipientPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

    const tx = await gateway.refund(paymentId, ZERO_PERMIT);
    await tx.wait();
  }

  beforeAll(async () => {
    blockchainRunning = await checkBlockchain();
    gatewayAndRelayerReady = await checkGatewayAndRelayer();
    if (!blockchainRunning) {
      console.warn(
        '\n  Hardhat node is not running. Refund flow tests will be skipped.\n' +
          '   Run: pnpm --filter @solo-pay/integration-tests test:setup\n'
      );
      return;
    }

    // Ensure payer has enough tokens for payments
    const payerBalance = await getTokenBalance(token.address, payerAddress);
    if (payerBalance < parseUnits('5000', token.decimals)) {
      await mintTokens(token.address, payerAddress, parseUnits('10000', token.decimals));
    }

    // Ensure recipient has enough tokens for refunds
    // Payment proceeds go to recipient; recipient uses those to refund
    const recipientBalance = await getTokenBalance(token.address, recipientAddress);
    if (recipientBalance < parseUnits('5000', token.decimals)) {
      await mintTokens(token.address, recipientAddress, parseUnits('10000', token.decimals));
    }
  });

  describe('Direct Refund', () => {
    it('should complete a direct refund after successful payment', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('100', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_OK_${Date.now()}`, amount);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
      const initialRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      await executeRefund(paymentId, amount);

      // Verify refund is recorded on-chain
      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const isRefunded = await gateway.isPaymentRefunded(paymentId);
      expect(isRefunded).toBe(true);

      // Verify balance changes: recipient -> payer
      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      const finalRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      expect(finalPayerBalance).toBe(initialPayerBalance + amount);
      expect(finalRecipientBalance).toBe(initialRecipientBalance - amount);
    });

    it('should verify payer receives exact refund amount', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('250', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_EXACT_${Date.now()}`, amount);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);

      await executeRefund(paymentId, amount);

      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      expect(finalPayerBalance - initialPayerBalance).toBe(amount);
    });
  });

  describe('Duplicate Refund Prevention', () => {
    it('should reject duplicate refund for the same payment', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('50', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_DUP_${Date.now()}`, amount);

      // First refund succeeds
      await executeRefund(paymentId, amount);

      // Second refund with same paymentId should revert
      await approveToken(token.address, gatewayAddress, amount, recipientPrivateKey);

      const recipientWallet = getWallet(recipientPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

      await expect(gateway.refund(paymentId, ZERO_PERMIT)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should reject refund for non-existent payment', async () => {
      if (!blockchainRunning) return;

      const fakePaymentId = generatePaymentId(`ORDER_FAKE_${Date.now()}`);

      const recipientWallet = getWallet(recipientPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

      await expect(gateway.refund(fakePaymentId, ZERO_PERMIT)).rejects.toThrow();
    });

    it('should reject refund from non-recipient', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('50', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_NOTRECIP_${Date.now()}`, amount);

      // Payer (not recipient) tries to call refund
      const payerWallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, payerWallet);

      await expect(gateway.refund(paymentId, ZERO_PERMIT)).rejects.toThrow();
    });
  });

  describe('Gasless Refund (Meta-Transaction)', () => {
    it('should process refund via forwarder meta-transaction', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('75', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_GASLESS_${Date.now()}`, amount);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);

      // Recipient (merchant) approves gateway for the refund amount
      // In meta-tx, _msgSender() = recipient (from ForwardRequest.from)
      await approveToken(token.address, gatewayAddress, amount, recipientPrivateKey);

      // Encode refund calldata (2 args: paymentId, permit)
      const refundCalldata = encodeRefundFunctionData(paymentId);

      // Build ForwardRequest - from = recipient (merchant)
      // The forwarder will set _msgSender() to recipientAddress
      const relayerWallet = getWallet(relayerPrivateKey);
      const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI, relayerWallet);

      const recipientNonce = await forwarder.nonces(recipientAddress);
      const forwardDeadline = getDeadline(1);

      const forwardRequest: ForwardRequest = {
        from: recipientAddress,
        to: gatewayAddress,
        value: 0n,
        gas: 500000n,
        nonce: recipientNonce,
        deadline: forwardDeadline,
        data: refundCalldata,
      };

      // Recipient signs the forward request (gasless for recipient)
      const forwardSignature = await signForwardRequest(
        forwardRequest,
        recipientPrivateKey,
        forwarderAddress,
        TEST_CHAIN_ID
      );

      const forwardRequestData = buildForwardRequestData(forwardRequest, forwardSignature);

      // Relayer submits meta-transaction
      const tx = await forwarder.execute(forwardRequestData);
      await tx.wait();

      // Verify refund completed
      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const isRefunded = await gateway.isPaymentRefunded(paymentId);
      expect(isRefunded).toBe(true);

      // Verify payer got tokens back
      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      expect(finalPayerBalance).toBe(initialPayerBalance + amount);
    });
  });

  /**
   * Scenario: create payment via API -> pay on-chain -> wait for PAID ->
   * create refund -> merchant signs ForwardRequest -> call relay API.
   */
  describe('Refund via Relay API', () => {
    it('should complete refund via Gateway create refund + merchant sign + relayer submit', async () => {
      if (!blockchainRunning || !gatewayAndRelayerReady) return;

      const orderId = `ORDER_REFUND_RELAY_API_${Date.now()}`;
      const client = createTestClient(TEST_MERCHANT);
      const params = makeCreatePaymentParams(25, orderId, token.address);

      // 1. Create payment via Gateway API
      const createResponse = await client.createPayment(params);
      const paymentData = createResponse.data;
      const paymentId = paymentData.paymentId;
      const amountWei = BigInt(paymentData.amount);

      await approveToken(token.address, gatewayAddress, amountWei, payerPrivateKey);

      // 2. Pay direct on-chain (payer) - 7 args, no escrowDuration/serverSignature
      const payerWallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, payerWallet);
      const payTx = await gateway.pay(
        paymentId,
        paymentData.tokenAddress,
        amountWei,
        paymentData.recipientAddress,
        paymentData.merchantId,
        BigInt(paymentData.deadline),
        ZERO_PERMIT
      );
      await payTx.wait();

      // 3. Sync gateway DB from chain, wait for PAID status (no finalize needed)
      await client.getPaymentStatus(paymentId);
      await waitForPaymentStatus(client, paymentId, 'PAID', 30000);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);

      // 4. Merchant (recipient) approves gateway for refund amount
      await approveToken(token.address, gatewayAddress, amountWei, recipientPrivateKey);

      // 5. Encode refund calldata (2 args: paymentId, permit) and build ForwardRequest (from = recipient)
      const refundCalldata = encodeRefundFunctionData(paymentId);
      const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI);
      const recipientNonce = await forwarder.nonces(recipientAddress);
      const forwardDeadline = getDeadline(1);

      const forwardRequest: ForwardRequest = {
        from: recipientAddress,
        to: gatewayAddress,
        value: 0n,
        gas: 500000n,
        nonce: recipientNonce,
        deadline: forwardDeadline,
        data: refundCalldata,
      };

      // 6. Merchant signs ForwardRequest
      const forwardSignature = await signForwardRequest(
        forwardRequest,
        recipientPrivateKey,
        forwarderAddress,
        TEST_CHAIN_ID
      );

      // 7. Call relay API (simple-relayer gasless endpoint)
      const relayBody = {
        request: {
          from: forwardRequest.from,
          to: forwardRequest.to,
          value: '0',
          gas: forwardRequest.gas.toString(),
          nonce: forwardRequest.nonce.toString(),
          deadline: forwardRequest.deadline.toString(),
          data: forwardRequest.data,
        },
        signature: forwardSignature,
      };
      const relayRes = await fetch(`${RELAYER_BASE}/api/v1/relay/gasless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relayBody),
        signal: AbortSignal.timeout(15000),
      });
      expect(relayRes.ok).toBe(true);

      const relayJson = (await relayRes.json()) as { transactionId?: string; status?: string };
      expect(relayJson.transactionId).toBeDefined();

      // 8. Wait for confirmation (poll relayer status or short sleep)
      await new Promise((r) => setTimeout(r, 5000));

      // 9. Verify refund completed on-chain and payer balance
      const gatewayContract = getContract(gatewayAddress, PaymentGatewayABI);
      const isRefunded = await gatewayContract.isPaymentRefunded(paymentId);
      expect(isRefunded).toBe(true);

      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      expect(finalPayerBalance).toBe(initialPayerBalance + amountWei);
    });
  });

  describe('Payment-Refund Full Lifecycle', () => {
    it('should handle complete payment -> refund cycle with balance verification', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('200', token.decimals);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
      const initialRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      // Step 1: Execute payment (payer -> recipient directly)
      const paymentId = await executePayment(`ORDER_LIFECYCLE_${Date.now()}`, amount);

      // Verify payment deducted from payer, sent to recipient directly
      const afterPaymentPayerBalance = await getTokenBalance(token.address, payerAddress);
      const afterPaymentRecipientBalance = await getTokenBalance(token.address, recipientAddress);
      expect(afterPaymentPayerBalance).toBe(initialPayerBalance - amount);
      expect(afterPaymentRecipientBalance).toBe(initialRecipientBalance + amount);

      // Step 2: Execute refund (recipient -> payer)
      // Recipient uses the tokens they received from the payment
      await executeRefund(paymentId, amount);

      // Verify final balances
      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      const finalRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      // Payer recovered the refund amount
      expect(finalPayerBalance).toBe(afterPaymentPayerBalance + amount);

      // Recipient balance back to initial (payment received, then refunded)
      expect(finalRecipientBalance).toBe(initialRecipientBalance);

      // Verify on-chain state
      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const isRefunded = await gateway.isPaymentRefunded(paymentId);
      expect(isRefunded).toBe(true);
    });
  });
});
