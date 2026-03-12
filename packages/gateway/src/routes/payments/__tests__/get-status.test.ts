import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getPaymentStatusRoute } from '../get-status';
import { Decimal } from '@solo-pay/database';

const mockPaymentService = {
  findByHash: vi.fn(),
  updateStatusByHash: vi.fn(),
  updatePayerAddress: vi.fn(),
  getTokenPermitSupported: vi.fn().mockResolvedValue(false),
};

const mockMerchantService = {
  findByPublicKey: vi.fn(),
  findById: vi.fn(),
};

const mockChainService = {
  findByNetworkId: vi.fn(),
};

const mockTokenService = {
  findById: vi.fn(),
};

const mockPaymentMethodService = {
  findById: vi.fn(),
};

vi.mock('../../../middleware/public-auth.middleware', () => ({
  createPublicAuthMiddleware: vi.fn(() => async (request: { merchant: unknown }) => {
    request.merchant = { id: 1, merchant_key: 'merchant_demo_001' };
  }),
}));

const baseMockPayment = {
  payer_address: null,
  recipient_address: '0x' + '1'.repeat(40),
  token_address: '0x' + '4'.repeat(40),
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

describe('GET /payments/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    // Default mocks for details enrichment (merchant/chain/token lookups)
    mockMerchantService.findById.mockResolvedValue({
      id: 1,
      merchant_key: 'merchant_demo_001',
      recipient_address: '0x' + '1'.repeat(40),
      escrow_duration: 300,
    });
    mockChainService.findByNetworkId.mockResolvedValue({
      network_id: 31337,
      gateway_address: '0x' + '2'.repeat(40),
      forwarder_address: '0x' + '3'.repeat(40),
    });
    mockPaymentMethodService.findById.mockResolvedValue({
      id: 1,
      token_id: 1,
    });
    mockTokenService.findById.mockResolvedValue({
      id: 1,
      address: '0x' + '4'.repeat(40),
      permit_enabled: false,
    });

    await getPaymentStatusRoute(
      app,
      mockPaymentService as never,
      mockMerchantService as never,
      mockChainService as never,
      mockTokenService as never,
      mockPaymentMethodService as never
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('successful responses', () => {
    it('should return payment status for valid payment', async () => {
      const paymentHash = '0x' + 'a'.repeat(64);
      const mockPayment = {
        ...baseMockPayment,
        id: 1,
        payment_hash: paymentHash,
        merchant_id: 1,
        payment_method_id: 1,
        network_id: 31337,
        token_symbol: 'USDC',
        token_decimals: 6,
        amount: new Decimal('1000000'),
        status: 'CREATED',
        order_id: 'order_001',
        success_url: 'https://example.com/success',
        fail_url: 'https://example.com/fail',
        expires_at: new Date('2099-01-01').toISOString(),
        currency_code: 'USD',
        fiat_amount: null,
        token_price: null,
        tx_hash: null,
      };

      mockPaymentService.findByHash.mockResolvedValue(mockPayment);

      const response = await app.inject({
        method: 'GET',
        url: `/payments/${paymentHash}`,
        headers: { 'x-public-key': 'pk_test_123' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.paymentId).toBe(paymentHash);
      expect(body.data.status).toBe('CREATED');
      // Details fields should be present
      expect(body.data.orderId).toBe('order_001');
      expect(body.data.gatewayAddress).toBe('0x' + '2'.repeat(40));
      expect(body.data.tokenAddress).toBe('0x' + '4'.repeat(40));
      expect(body.data.amount).toBe('1000000');
      expect(body.data.recipientAddress).toBe('0x' + '1'.repeat(40));
      expect(body.data.deadline).toBeDefined();
    });

    it('should return tokenPermitSupported in response', async () => {
      const paymentHash = '0x' + 'z'.repeat(64);
      const mockPayment = {
        ...baseMockPayment,
        id: 10,
        payment_hash: paymentHash,
        merchant_id: 1,
        payment_method_id: 5,
        network_id: 31337,
        token_symbol: 'USDC',
        token_decimals: 6,
        amount: new Decimal('1000000'),
        status: 'CREATED',
        order_id: null,
        success_url: null,
        fail_url: null,
        expires_at: new Date('2099-01-01').toISOString(),
        currency_code: null,
        fiat_amount: null,
        token_price: null,
        tx_hash: null,
      };

      mockPaymentService.findByHash.mockResolvedValue(mockPayment);
      mockPaymentService.getTokenPermitSupported.mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: `/payments/${paymentHash}`,
        headers: { 'x-public-key': 'pk_test_123' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.tokenPermitSupported).toBe(true);
      expect(mockPaymentService.getTokenPermitSupported).toHaveBeenCalledWith(5);
    });

    it('should return PAID status from DB', async () => {
      const paymentHash = '0x' + 'b'.repeat(64);
      const txHash = '0x' + 'c'.repeat(64);
      const mockPayment = {
        ...baseMockPayment,
        id: 2,
        payment_hash: paymentHash,
        merchant_id: 1,
        payment_method_id: 1,
        network_id: 31337,
        token_symbol: 'USDT',
        token_decimals: 6,
        amount: new Decimal('2000000'),
        status: 'PAID',
        order_id: null,
        success_url: null,
        fail_url: null,
        expires_at: new Date('2099-01-01').toISOString(),
        currency_code: null,
        fiat_amount: null,
        token_price: null,
        tx_hash: txHash,
        payer_address: '0x' + 'd'.repeat(40),
      };

      mockPaymentService.findByHash.mockResolvedValue(mockPayment);

      const response = await app.inject({
        method: 'GET',
        url: `/payments/${paymentHash}`,
        headers: { 'x-public-key': 'pk_test_123' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.status).toBe('PAID');
      expect(body.data.payerAddress).toBe('0x' + 'd'.repeat(40));
    });
  });

  describe('error responses', () => {
    it('should return 404 when payment not found', async () => {
      mockPaymentService.findByHash.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/payments/0x' + 'f'.repeat(64),
        headers: { 'x-public-key': 'pk_test_123' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('NOT_FOUND');
    });

    it('should return 500 on internal error', async () => {
      mockPaymentService.findByHash.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/payments/0x' + 'j'.repeat(64),
        headers: { 'x-public-key': 'pk_test_123' },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('merchant authorization', () => {
    it('should return 403 when payment belongs to different merchant', async () => {
      const mockPayment = {
        ...baseMockPayment,
        id: 6,
        payment_hash: '0x' + 'k'.repeat(64),
        merchant_id: 999,
        payment_method_id: 1,
        network_id: 31337,
        token_symbol: 'USDC',
        amount: new Decimal('1000000'),
        status: 'CREATED',
      };

      mockPaymentService.findByHash.mockResolvedValue(mockPayment);

      const response = await app.inject({
        method: 'GET',
        url: '/payments/0x' + 'k'.repeat(64),
        headers: { 'x-public-key': 'pk_test_123' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('FORBIDDEN');
    });
  });
});
