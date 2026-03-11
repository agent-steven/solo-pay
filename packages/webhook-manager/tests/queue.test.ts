import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createWebhookQueue,
  createWebhookWorker,
  WEBHOOK_QUEUE_NAME,
  JOB_NAME_PAYMENT_PAID,
} from '../src/queue';

const mockAdd = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn();
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function Queue(this: unknown) {
    return { add: mockAdd, close: mockClose };
  }),
  Worker: vi.fn().mockImplementation(function Worker(this: unknown) {
    return { on: mockWorkerOn, close: mockWorkerClose };
  }),
}));

describe('createWebhookQueue', () => {
  const mockRedis = {} as import('ioredis').Redis;

  beforeEach(() => {
    mockAdd.mockClear();
    mockClose.mockClear();
  });

  it('exposes addPaymentEvent and close', () => {
    const queue = createWebhookQueue(mockRedis);
    expect(typeof queue.addPaymentEvent).toBe('function');
    expect(typeof queue.close).toBe('function');
  });

  it('addPaymentEvent enqueues with given job name', async () => {
    const queue = createWebhookQueue(mockRedis);
    const data = {
      url: 'https://merchant.example/webhook',
      body: {
        paymentId: '0xabc',
        orderId: 'order-1',
        status: 'PAID',
        txHash: null,
        amount: '1000000',
        tokenSymbol: 'USDC',
        paidAt: '2024-01-26T12:00:00.000Z',
      },
    };
    await queue.addPaymentEvent(JOB_NAME_PAYMENT_PAID, data);
    expect(mockAdd).toHaveBeenCalledWith(JOB_NAME_PAYMENT_PAID, data, expect.any(Object));
  });

  it('should handle multiple webhook jobs', async () => {
    const queue = createWebhookQueue(mockRedis);

    const jobs = [
      {
        url: 'https://merchant1.example/webhook',
        body: {
          paymentId: '0x111',
          orderId: 'order-1',
          status: 'PAID',
          txHash: '0xtx1',
          amount: '1000000',
          tokenSymbol: 'USDC',
          paidAt: '2024-01-26T12:00:00.000Z',
        },
      },
      {
        url: 'https://merchant2.example/webhook',
        body: {
          paymentId: '0x222',
          orderId: 'order-2',
          status: 'PAID',
          txHash: '0xtx2',
          amount: '2000000',
          tokenSymbol: 'USDT',
          paidAt: '2024-01-26T12:01:00.000Z',
        },
      },
    ];

    for (const job of jobs) {
      await queue.addPaymentEvent(JOB_NAME_PAYMENT_PAID, job);
    }

    expect(mockAdd).toHaveBeenCalledTimes(2);
    await queue.close();
  });

  it('should pass undefined jobId to prevent duplicate job IDs', async () => {
    const queue = createWebhookQueue(mockRedis);
    const data = {
      url: 'https://merchant.example/webhook',
      body: {
        paymentId: '0xabc',
        orderId: 'order-1',
        status: 'PAID',
        txHash: '0xtx',
        amount: '1000000',
        tokenSymbol: 'USDC',
        paidAt: '2024-01-26T12:00:00.000Z',
      },
    };

    await queue.addPaymentEvent(JOB_NAME_PAYMENT_PAID, data);

    expect(mockAdd).toHaveBeenCalledWith(
      JOB_NAME_PAYMENT_PAID,
      data,
      expect.objectContaining({ jobId: undefined })
    );
  });
});

describe('createWebhookWorker', () => {
  beforeEach(() => {
    mockWorkerOn.mockClear();
    mockWorkerClose.mockClear();
  });

  it('should create worker with correct configuration', () => {
    const mockRedis = {} as import('ioredis').Redis;
    const onSuccess = vi.fn();
    const onFailed = vi.fn();

    const worker = createWebhookWorker({
      connection: mockRedis,
      onSuccess,
      onFailed,
    });

    expect(worker).toBeDefined();
    expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('should accept host/port connection config', () => {
    const onSuccess = vi.fn();
    const onFailed = vi.fn();

    const worker = createWebhookWorker({
      connection: { host: 'localhost', port: 6379 },
      onSuccess,
      onFailed,
    });

    expect(worker).toBeDefined();
  });

  it('should work without optional callbacks', () => {
    const mockRedis = {} as import('ioredis').Redis;

    const worker = createWebhookWorker({
      connection: mockRedis,
    });

    expect(worker).toBeDefined();
  });
});

describe('constants', () => {
  it('queue name and job names are defined', () => {
    expect(WEBHOOK_QUEUE_NAME).toBe('solo-pay-webhook');
    expect(JOB_NAME_PAYMENT_PAID).toBe('payment.paid');
  });
});

describe('webhook job data validation', () => {
  const mockRedis = {} as import('ioredis').Redis;

  beforeEach(() => {
    mockAdd.mockClear();
  });

  it('should accept valid webhook data with all required fields', async () => {
    const queue = createWebhookQueue(mockRedis);
    const validData = {
      url: 'https://secure-merchant.com/api/webhook',
      body: {
        paymentId: '0x' + 'a'.repeat(64),
        orderId: 'ORD-2024-001',
        status: 'PAID',
        txHash: '0x' + 'b'.repeat(64),
        amount: '1000000000000000000',
        tokenSymbol: 'USDC',
        paidAt: new Date().toISOString(),
      },
    };

    await queue.addPaymentEvent(JOB_NAME_PAYMENT_PAID, validData);

    expect(mockAdd).toHaveBeenCalledWith(JOB_NAME_PAYMENT_PAID, validData, expect.any(Object));
  });

  it('should handle webhook data with special characters in orderId', async () => {
    const queue = createWebhookQueue(mockRedis);
    const data = {
      url: 'https://merchant.com/webhook',
      body: {
        paymentId: '0xabc123',
        orderId: 'ORDER-한글-日本語-emoji🎉',
        status: 'PAID',
        txHash: '0xtx123',
        amount: '500000',
        tokenSymbol: 'USDT',
        paidAt: '2024-01-26T12:00:00.000Z',
      },
    };

    await queue.addPaymentEvent(JOB_NAME_PAYMENT_PAID, data);

    expect(mockAdd).toHaveBeenCalledWith(JOB_NAME_PAYMENT_PAID, data, expect.any(Object));
  });

  it('should handle large amounts', async () => {
    const queue = createWebhookQueue(mockRedis);
    const data = {
      url: 'https://merchant.com/webhook',
      body: {
        paymentId: '0xlargeamount',
        orderId: 'large-order',
        status: 'PAID',
        txHash: '0xtxlarge',
        amount: '999999999999999999999999999999',
        tokenSymbol: 'USDC',
        paidAt: '2024-01-26T12:00:00.000Z',
      },
    };

    await queue.addPaymentEvent(JOB_NAME_PAYMENT_PAID, data);

    expect(mockAdd).toHaveBeenCalled();
  });
});
