import { FastifyInstance } from 'fastify';
import { PaymentService } from '../../services/payment.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';
import { MerchantService } from '../../services/merchant.service';
import { ErrorResponseSchema } from '../../docs/schemas';
import { ErrorCodes } from '../../error-codes';

// DB status updates are handled exclusively by the webhook-manager (with full on-chain validation).
// These GET endpoints are read-only and return DB state as-is.

function buildPaymentDetailResponse(
  payment: {
    payment_hash: string;
    order_id: string | null;
    status: string;
    amount: { toString: () => string };
    token_symbol: string;
    token_decimals: number;
    token_address: string | null;
    tx_hash: string | null;
    payer_address: string | null;
    currency_code: string | null;
    fiat_amount: { toString: () => string } | null;
    created_at: Date;
    confirmed_at: Date | null;
    expires_at: Date;
  },
  tokenPermitSupported: boolean
) {
  return {
    paymentId: payment.payment_hash,
    orderId: payment.order_id ?? undefined,
    status: payment.status,
    amount: payment.amount.toString(),
    tokenSymbol: payment.token_symbol,
    tokenDecimals: payment.token_decimals,
    tokenAddress: payment.token_address ?? undefined,
    txHash: payment.tx_hash ?? undefined,
    payerAddress: payment.payer_address ?? undefined,
    currencyCode: payment.currency_code ?? undefined,
    fiatAmount: payment.fiat_amount?.toString() ?? undefined,
    createdAt: new Date(payment.created_at).toISOString(),
    confirmedAt: payment.confirmed_at ? new Date(payment.confirmed_at).toISOString() : undefined,
    expiresAt: new Date(payment.expires_at).toISOString(),
    tokenPermitSupported,
  };
}

export async function merchantPaymentRoute(
  app: FastifyInstance,
  merchantService: MerchantService,
  paymentService: PaymentService
) {
  const authMiddleware = createAuthMiddleware(merchantService);

  const detailResponseSchema = {
    type: 'object',
    properties: {
      paymentId: { type: 'string' },
      orderId: { type: 'string' },
      status: {
        type: 'string',
        enum: ['CREATED', 'PAID', 'REFUND_SUBMITTED', 'REFUNDED', 'EXPIRED', 'FAILED', 'INVALID'],
      },
      amount: { type: 'string', description: 'Wei' },
      tokenSymbol: { type: 'string' },
      tokenAddress: { type: 'string', description: 'Token contract address (0x...)' },
      tokenDecimals: { type: 'integer' },
      txHash: { type: 'string' },
      payerAddress: { type: 'string' },
      currencyCode: { type: 'string', description: 'Fiat currency code (e.g. USD)' },
      fiatAmount: { type: 'string', description: 'Original fiat amount before conversion' },
      tokenPermitSupported: {
        type: 'boolean',
        description: 'Whether the token supports EIP-2612 permit (gasless approval)',
      },
      createdAt: { type: 'string', format: 'date-time' },
      confirmedAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
    },
  };

  // GET /merchant/payments?orderId=xxx – API Key, findByOrderId
  app.get<{ Querystring: { orderId?: string } }>(
    '/merchant/payments',
    {
      schema: {
        operationId: 'getMerchantPaymentByOrderId',
        tags: ['Merchant'],
        summary: 'Get payment by order ID',
        description: 'Retrieves payment by merchant order ID. API Key required.',
        security: [{ ApiKeyAuth: [] }],
        querystring: {
          type: 'object',
          properties: { orderId: { type: 'string', description: 'Merchant order ID' } },
          required: ['orderId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: detailResponseSchema,
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { orderId } = request.query;
        const merchant = (request as { merchant?: { id: number } }).merchant;
        if (!merchant) {
          return reply
            .code(401)
            .send({ code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' });
        }

        if (!orderId || typeof orderId !== 'string') {
          return reply.code(400).send({
            code: ErrorCodes.INVALID_REQUEST,
            message: 'orderId query parameter is required',
          });
        }

        const payment = await paymentService.findByOrderId(orderId, merchant.id);
        if (!payment) {
          return reply.code(404).send({
            code: ErrorCodes.NOT_FOUND,
            message: 'Payment not found for this order ID',
          });
        }

        const tokenPermitSupported = await paymentService.getTokenPermitSupported(
          payment.payment_method_id
        );

        return reply.code(200).send({
          success: true,
          data: buildPaymentDetailResponse(payment, tokenPermitSupported),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get payment';
        return reply.code(500).send({ code: ErrorCodes.INTERNAL_ERROR, message });
      }
    }
  );

  // GET /merchant/payments/:id – API Key, merchant ownership
  app.get<{ Params: { id: string } }>(
    '/merchant/payments/:id',
    {
      schema: {
        operationId: 'getMerchantPaymentById',
        tags: ['Merchant'],
        summary: 'Get payment detail by ID',
        description:
          'Retrieves payment by payment hash. API Key required. Validates payment belongs to merchant.',
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Payment hash' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: detailResponseSchema,
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const merchant = request.merchant;
        if (!merchant) {
          return reply.code(401).send({
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Authentication required',
          });
        }

        const payment = await paymentService.findByHash(id);
        if (!payment) {
          return reply.code(404).send({
            code: ErrorCodes.NOT_FOUND,
            message: 'Payment not found',
          });
        }

        if (payment.merchant_id !== merchant.id) {
          return reply.code(403).send({
            code: ErrorCodes.FORBIDDEN,
            message: 'Payment does not belong to this merchant',
          });
        }

        const tokenPermitSupported = await paymentService.getTokenPermitSupported(
          payment.payment_method_id
        );

        return reply.code(200).send({
          success: true,
          data: buildPaymentDetailResponse(payment, tokenPermitSupported),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get payment';
        return reply.code(500).send({ code: ErrorCodes.INTERNAL_ERROR, message });
      }
    }
  );
}
