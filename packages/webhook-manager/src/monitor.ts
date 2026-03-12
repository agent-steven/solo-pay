import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@solo-pay/database';
import { keccak256, encodePacked } from 'viem';
import type { ChainClient } from './blockchain';
import { getOnChainStatus, OnChainPaymentStatus } from './blockchain';
import type { WebhookJobData, PaymentWebhookBody } from './types';
import { JOB_NAME_PAYMENT_PAID, JOB_NAME_PAYMENT_INVALID } from './types';

const MONITOR_QUEUE_NAME = 'solo-pay-payment-monitor';

interface MonitorJobData {
  paymentHash: string;
  paymentId: number;
  merchantId: number;
  merchantIdHash: string;
  networkId: number;
  amount: string;
  tokenSymbol: string;
  tokenAddress: string;
  recipientAddress: string;
  orderId: string | null;
  webhookUrl: string | null;
  status: string;
  txHash: string | null;
  expiresAt: string;
}

export interface WebhookQueueForMonitor {
  addPaymentEvent(jobName: string, data: WebhookJobData): Promise<void>;
}

export interface MonitorOptions {
  redis: Redis;
  prisma: PrismaClient;
  chainClients: Map<number, ChainClient>;
  webhookQueue: WebhookQueueForMonitor;
  /** DB polling interval in ms (default 5000) */
  pollingIntervalMs: number;
  /** Blockchain check retry delay in ms (default 1000) */
  blockchainCheckIntervalMs: number;
}

function buildWebhookBody(
  data: MonitorJobData,
  newStatus: string,
  txHash: string | null
): PaymentWebhookBody {
  return {
    paymentId: data.paymentHash,
    orderId: data.orderId,
    status: newStatus,
    txHash,
    amount: data.amount,
    tokenSymbol: data.tokenSymbol,
    paidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
  };
}

/**
 * Payment monitor backed by BullMQ:
 *
 *   Stage 1 (DB poll, every pollingIntervalMs):
 *     query payments in monitored statuses → enqueue to monitor queue
 *
 *   Stage 2 (monitor worker, retry with blockchainCheckIntervalMs backoff):
 *     check on-chain status → update DB + enqueue webhook
 *
 *   Monitored transitions:
 *     CREATED → on-chain Paid → DB PAID + webhook
 */
export function startPaymentMonitor(options: MonitorOptions): { stop: () => Promise<void> } {
  const {
    redis,
    prisma,
    chainClients,
    webhookQueue,
    pollingIntervalMs,
    blockchainCheckIntervalMs,
  } = options;

  let running = true;
  let dbTimer: ReturnType<typeof setTimeout> | null = null;

  const maxAttempts = Math.max(Math.ceil(pollingIntervalMs / blockchainCheckIntervalMs), 3);

  /** Invalidate gateway payment cache after DB update */
  async function invalidatePaymentCache(paymentHash: string): Promise<void> {
    try {
      await redis.del(`payment:${paymentHash}`);
    } catch {
      // cache miss is not critical
    }
  }

  // ── Monitor queue ────────────────────────────────────────────────────
  const monitorQueue = new Queue<MonitorJobData>(MONITOR_QUEUE_NAME, {
    connection: redis as import('bullmq').ConnectionOptions,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
      attempts: maxAttempts,
      backoff: { type: 'fixed', delay: blockchainCheckIntervalMs },
    },
  });

  // ── Resolve webhook URL ────────────────────────────────────────────
  async function resolveWebhookUrl(data: MonitorJobData): Promise<string | null> {
    if (data.webhookUrl) return data.webhookUrl;
    const merchant = await prisma.merchant.findUnique({
      where: { id: data.merchantId },
    });
    return merchant?.webhook_url ?? null;
  }

  // ── Enqueue webhook ────────────────────────────────────────────────
  async function enqueueWebhook(
    data: MonitorJobData,
    jobName: string,
    newStatus: string,
    txHash: string | null
  ): Promise<void> {
    const webhookUrl = await resolveWebhookUrl(data);
    if (!webhookUrl) return;
    const body = buildWebhookBody(data, newStatus, txHash);
    await webhookQueue.addPaymentEvent(jobName, { url: webhookUrl, body });
  }

  // ── Monitor worker ───────────────────────────────────────────────────
  const monitorWorker = new Worker<MonitorJobData>(
    MONITOR_QUEUE_NAME,
    async (job) => {
      const data = job.data;

      const chainClient = chainClients.get(data.networkId);
      if (!chainClient) return;

      const { status: onChainStatus, details } = await getOnChainStatus(
        chainClient.client,
        chainClient.gatewayAddress,
        data.paymentHash
      );

      switch (data.status) {
        case 'CREATED':
          await handleCreatedPending(data, onChainStatus, details);
          break;

        default:
          break;
      }
    },
    {
      connection: redis as import('bullmq').ConnectionOptions,
      concurrency: 10,
    }
  );

  // ── Validate on-chain payment data against DB ────────────────────────
  function validateOnChainPayment(
    data: MonitorJobData,
    details: import('./blockchain').OnChainPaymentDetails
  ): string | null {
    // Amount (wei-level precision)
    if (BigInt(details.amount) !== BigInt(data.amount)) {
      return `amount mismatch: on-chain=${details.amount}, expected=${data.amount}`;
    }

    // Token address
    if (!data.tokenAddress) {
      return `token validation failed: expected token address is missing`;
    }
    if (!details.tokenAddress) {
      return `token validation failed: on-chain token address is missing`;
    }
    if (details.tokenAddress.toLowerCase() !== data.tokenAddress.toLowerCase()) {
      return `token mismatch: on-chain=${details.tokenAddress}, expected=${data.tokenAddress}`;
    }

    // Recipient address: must match merchant's wallet
    if (!data.recipientAddress) {
      return `recipient validation failed: expected recipient address is missing`;
    }
    if (!details.recipientAddress) {
      return `invalid recipient: on-chain recipient is missing`;
    }
    if (details.recipientAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      return `invalid recipient: on-chain recipient is zero address`;
    }
    if (details.recipientAddress.toLowerCase() !== data.recipientAddress.toLowerCase()) {
      return `recipient mismatch: on-chain=${details.recipientAddress}, expected=${data.recipientAddress}`;
    }

    // Merchant ID (bytes32)
    if (!data.merchantIdHash) {
      return `merchant validation failed: expected merchant ID hash is missing`;
    }
    if (!details.merchantId) {
      return `merchant validation failed: on-chain merchant ID is missing`;
    }
    if (details.merchantId.toLowerCase() !== data.merchantIdHash.toLowerCase()) {
      return `merchant mismatch: on-chain=${details.merchantId}, expected=${data.merchantIdHash}`;
    }

    // Deadline: event timestamp vs DB expires_at
    if (data.expiresAt) {
      const eventTimestamp = new Date(details.timestamp).getTime();
      const expiresAt = new Date(data.expiresAt).getTime();
      if (eventTimestamp > expiresAt) {
        return `deadline exceeded: paid at ${details.timestamp}, expired at ${data.expiresAt}`;
      }
    }

    return null;
  }

  // ── Mark payment as INVALID ──────────────────────────────────────────
  async function markInvalid(
    data: MonitorJobData,
    details: import('./blockchain').OnChainPaymentDetails,
    reason: string
  ): Promise<void> {
    console.error(
      '[monitor] INVALID payment=%s reason=%s tx=%s',
      data.paymentHash,
      reason,
      details.transactionHash
    );

    const updated = await prisma.payment.updateMany({
      where: {
        payment_hash: data.paymentHash,
        status: { in: ['CREATED'] },
      },
      data: {
        status: 'INVALID',
        tx_hash: details.transactionHash,
        ...(details.payerAddress && { payer_address: details.payerAddress }),
        ...(details.tokenAddress && { token_address: details.tokenAddress }),
      },
    });

    if (updated.count === 0) return;
    await invalidatePaymentCache(data.paymentHash);

    await prisma.paymentEvent.create({
      data: {
        payment_id: data.paymentId,
        event_type: 'INVALID',
      },
    });

    await enqueueWebhook(data, JOB_NAME_PAYMENT_INVALID, 'INVALID', details.transactionHash);
  }

  // ── CREATED → PAID, INVALID, or EXPIRED ─────────────────────────────
  async function handleCreatedPending(
    data: MonitorJobData,
    onChainStatus: number,
    details: import('./blockchain').OnChainPaymentDetails | null
  ): Promise<void> {
    if (onChainStatus === OnChainPaymentStatus.None) {
      // If deadline has passed and still no on-chain payment, mark as EXPIRED
      if (data.expiresAt && Date.now() > new Date(data.expiresAt).getTime()) {
        const updated = await prisma.payment.updateMany({
          where: {
            payment_hash: data.paymentHash,
            status: { in: ['CREATED'] },
          },
          data: { status: 'EXPIRED' },
        });
        if (updated.count > 0) {
          await invalidatePaymentCache(data.paymentHash);
          console.log('[monitor] expired payment=%s', data.paymentHash);
        }
        return;
      }
      throw new Error('not_confirmed');
    }

    if (onChainStatus >= OnChainPaymentStatus.Paid && details) {
      // Validate on-chain data against DB
      const invalidReason = validateOnChainPayment(data, details);
      if (invalidReason) {
        await markInvalid(data, details, invalidReason);
        return;
      }

      const updated = await prisma.payment.updateMany({
        where: {
          payment_hash: data.paymentHash,
          status: { in: ['CREATED'] },
        },
        data: {
          status: 'PAID',
          tx_hash: details.transactionHash,
          confirmed_at: new Date(),
          ...(details.payerAddress && { payer_address: details.payerAddress }),
          ...(details.tokenAddress && { token_address: details.tokenAddress }),
        },
      });

      if (updated.count === 0) return;
      await invalidatePaymentCache(data.paymentHash);

      await prisma.paymentEvent.create({
        data: {
          payment_id: data.paymentId,
          event_type: 'PAID',
        },
      });

      console.log('[monitor] paid payment=%s tx=%s', data.paymentHash, details.transactionHash);

      await enqueueWebhook(data, JOB_NAME_PAYMENT_PAID, 'PAID', details.transactionHash);
    }
  }

  // ── DB poller ────────────────────────────────────────────────────────
  async function pollDb(): Promise<void> {
    if (!running) return;

    try {
      const payments = await prisma.payment.findMany({
        where: {
          status: {
            in: ['CREATED'],
          },
        },
        orderBy: { created_at: 'asc' },
        take: 100,
      });

      // Resolve merchant_key → bytes32 merchantIdHash for on-chain validation
      const uniqueMerchantIds = [...new Set(payments.map((p) => p.merchant_id))];
      const merchantKeyMap = new Map<number, string>();
      if (uniqueMerchantIds.length > 0) {
        const merchants = await prisma.merchant.findMany({
          where: { id: { in: uniqueMerchantIds } },
          select: { id: true, merchant_key: true },
        });
        for (const m of merchants) {
          merchantKeyMap.set(m.id, keccak256(encodePacked(['string'], [m.merchant_key])));
        }
      }

      for (const payment of payments) {
        // jobId includes status to avoid dedup conflicts across different status monitors
        await monitorQueue.add(
          'check-payment',
          {
            paymentHash: payment.payment_hash,
            paymentId: payment.id,
            merchantId: payment.merchant_id,
            merchantIdHash: merchantKeyMap.get(payment.merchant_id) ?? '',
            networkId: payment.network_id,
            amount: payment.amount.toString(),
            tokenSymbol: payment.token_symbol,
            tokenAddress: payment.token_address ?? '',
            recipientAddress: payment.recipient_address ?? '',
            orderId: payment.order_id ?? null,
            webhookUrl: payment.webhook_url ?? null,
            status: payment.status,
            txHash: payment.tx_hash ?? null,
            expiresAt: payment.expires_at.toISOString(),
          },
          { jobId: `${payment.payment_hash}-${payment.status}` }
        );
      }
    } catch (err) {
      console.error(
        '[monitor] db poll error: %s',
        err instanceof Error ? err.message : String(err)
      );
    }

    if (running) {
      dbTimer = setTimeout(pollDb, pollingIntervalMs);
    }
  }

  // Start DB poller immediately
  dbTimer = setTimeout(pollDb, 0);

  return {
    stop: async () => {
      running = false;
      if (dbTimer) {
        clearTimeout(dbTimer);
        dbTimer = null;
      }
      await monitorWorker.close();
      await monitorQueue.close();
    },
  };
}
