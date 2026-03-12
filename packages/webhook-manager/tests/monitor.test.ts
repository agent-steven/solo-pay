import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnChainPaymentStatus } from '../src/blockchain';
import type { OnChainPaymentDetails } from '../src/blockchain';

// ── BullMQ mock ──────────────────────────────────────────────────────────
// Capture the worker processor so we can invoke it directly in tests
let capturedProcessor: ((job: { data: unknown }) => Promise<void>) | null = null;

const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function Queue() {
    return { add: mockQueueAdd, close: mockQueueClose };
  }),
  Worker: vi.fn().mockImplementation(function Worker(_name: string, processor: unknown) {
    capturedProcessor = processor as (job: { data: unknown }) => Promise<void>;
    return { close: mockWorkerClose };
  }),
}));

// ── blockchain mock ──────────────────────────────────────────────────────
const mockGetOnChainStatus = vi.fn();
vi.mock('../src/blockchain', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getOnChainStatus: (...args: unknown[]) => mockGetOnChainStatus(...args),
  };
});

import { startPaymentMonitor } from '../src/monitor';

// ── Helpers ──────────────────────────────────────────────────────────────

const MOCK_MERCHANT_ID_HASH = '0x' + 'f'.repeat(64);

function makeJobData(overrides: Record<string, unknown> = {}) {
  return {
    paymentHash: '0x' + 'a'.repeat(64),
    paymentId: 1,
    merchantId: 1,
    merchantIdHash: MOCK_MERCHANT_ID_HASH,
    networkId: 80002,
    amount: '1000000',
    tokenSymbol: 'USDC',
    tokenAddress: '0xTokenAddr',
    recipientAddress: '0x' + 'd'.repeat(40),
    orderId: 'order-1',
    webhookUrl: 'https://merchant.example/webhook',
    status: 'CREATED',
    txHash: null,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    ...overrides,
  };
}

function makePaidDetails(overrides: Partial<OnChainPaymentDetails> = {}): OnChainPaymentDetails {
  return {
    transactionHash: '0x' + 'b'.repeat(64),
    amount: '1000000',
    timestamp: new Date(Date.now() - 10_000).toISOString(), // 10s ago (before deadline)
    payerAddress: '0x' + 'c'.repeat(40),
    tokenAddress: '0xTokenAddr',
    recipientAddress: '0x' + 'd'.repeat(40),
    merchantId: MOCK_MERCHANT_ID_HASH,
    fee: '0',
    ...overrides,
  };
}

// ── Shared mocks ─────────────────────────────────────────────────────────

const mockPrisma = {
  payment: {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  paymentEvent: {
    create: vi.fn().mockResolvedValue({}),
  },
  merchant: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
  chain: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  token: {
    findMany: vi.fn().mockResolvedValue([]),
  },
};

const mockRedis = {
  del: vi.fn().mockResolvedValue(1),
} as unknown as import('ioredis').Redis;

const mockWebhookQueue = {
  addPaymentEvent: vi.fn().mockResolvedValue(undefined),
};

const mockChainClient = {
  client: {} as import('viem').PublicClient,
  gatewayAddress: '0xGateway' as `0x${string}`,
};

async function processJob(data: Record<string, unknown>) {
  if (!capturedProcessor) throw new Error('Worker processor not captured');
  await capturedProcessor({ data });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('monitor worker', () => {
  let monitor: { stop: () => Promise<void> } | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    capturedProcessor = null;

    monitor = startPaymentMonitor({
      redis: mockRedis,
      prisma: mockPrisma as unknown as import('@solo-pay/database').PrismaClient,
      chainClients: new Map([[80002, mockChainClient]]),
      webhookQueue: mockWebhookQueue,
      pollingIntervalMs: 600_000, // very long so pollDb doesn't auto-fire
      blockchainCheckIntervalMs: 1000,
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (monitor) await monitor.stop();
  });

  // ── PAID ──────────────────────────────────────────────────────────────

  describe('CREATED → PAID', () => {
    it('should mark payment as PAID when validation passes', async () => {
      const details = makePaidDetails();
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData());

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PAID' }),
        })
      );
      expect(mockPrisma.paymentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event_type: 'PAID' }),
        })
      );
      expect(mockWebhookQueue.addPaymentEvent).toHaveBeenCalledWith(
        'payment.paid',
        expect.objectContaining({
          body: expect.objectContaining({ status: 'PAID' }),
        })
      );
    });
  });

  // ── INVALID ───────────────────────────────────────────────────────────

  describe('CREATED → INVALID', () => {
    it('should mark as INVALID when amount mismatches', async () => {
      const details = makePaidDetails({ amount: '9999999' });
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData());

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
      expect(mockWebhookQueue.addPaymentEvent).toHaveBeenCalledWith(
        'payment.invalid',
        expect.objectContaining({
          body: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when token address mismatches', async () => {
      const details = makePaidDetails({ tokenAddress: '0xWrongToken' });
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData());

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when recipient is zero address', async () => {
      const details = makePaidDetails({
        recipientAddress: '0x0000000000000000000000000000000000000000',
      });
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData());

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when recipient mismatches (self-payment attack)', async () => {
      const attackerAddress = '0x' + 'e'.repeat(40);
      const details = makePaidDetails({ recipientAddress: attackerAddress });
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData());

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
      expect(mockWebhookQueue.addPaymentEvent).toHaveBeenCalledWith(
        'payment.invalid',
        expect.objectContaining({
          body: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when recipient is missing', async () => {
      const details = makePaidDetails({ recipientAddress: undefined });
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData());

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when expected recipient address is empty (bypass prevention)', async () => {
      const details = makePaidDetails();
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData({ recipientAddress: '' }));

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when expected token address is empty (bypass prevention)', async () => {
      const details = makePaidDetails();
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData({ tokenAddress: '' }));

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when merchant ID mismatches', async () => {
      const details = makePaidDetails({ merchantId: '0x' + '1'.repeat(64) });
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData());

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when expected merchant ID hash is empty (bypass prevention)', async () => {
      const details = makePaidDetails();
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData({ merchantIdHash: '' }));

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });

    it('should mark as INVALID when deadline exceeded', async () => {
      const pastExpiry = new Date(Date.now() - 60_000).toISOString();
      const details = makePaidDetails({
        timestamp: new Date().toISOString(), // paid now, after expiry
      });
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details,
      });

      await processJob(makeJobData({ expiresAt: pastExpiry }));

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALID' }),
        })
      );
    });
  });

  // ── EXPIRED ───────────────────────────────────────────────────────────

  describe('CREATED → EXPIRED', () => {
    it('should mark as EXPIRED when on-chain is None and deadline has passed', async () => {
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.None,
        details: null,
      });

      const pastExpiry = new Date(Date.now() - 60_000).toISOString();
      await processJob(makeJobData({ expiresAt: pastExpiry }));

      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        })
      );
      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockWebhookQueue.addPaymentEvent).not.toHaveBeenCalled();
    });

    it('should throw not_confirmed when deadline has not yet passed', async () => {
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.None,
        details: null,
      });

      const futureExpiry = new Date(Date.now() + 300_000).toISOString();
      await expect(processJob(makeJobData({ expiresAt: futureExpiry }))).rejects.toThrow(
        'not_confirmed'
      );

      expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('should skip cache invalidation when payment was already updated (count=0)', async () => {
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.None,
        details: null,
      });
      mockPrisma.payment.updateMany.mockResolvedValueOnce({ count: 0 });

      const pastExpiry = new Date(Date.now() - 60_000).toISOString();
      await processJob(makeJobData({ expiresAt: pastExpiry }));

      expect(mockPrisma.payment.updateMany).toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should skip when chain client is not found', async () => {
      await processJob(makeJobData({ networkId: 99999 }));

      expect(mockGetOnChainStatus).not.toHaveBeenCalled();
      expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('should skip when status is not CREATED', async () => {
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details: makePaidDetails(),
      });

      await processJob(makeJobData({ status: 'PAID' }));

      expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('should not send webhook when updateMany count is 0 (already processed)', async () => {
      mockGetOnChainStatus.mockResolvedValue({
        status: OnChainPaymentStatus.Paid,
        details: makePaidDetails(),
      });
      mockPrisma.payment.updateMany.mockResolvedValueOnce({ count: 0 });

      await processJob(makeJobData());

      expect(mockWebhookQueue.addPaymentEvent).not.toHaveBeenCalled();
    });
  });
});
