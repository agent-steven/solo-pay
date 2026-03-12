import { FastifyInstance } from 'fastify';
import { Address } from 'viem';
import { PaymentService } from '../../services/payment.service';
import { MerchantService } from '../../services/merchant.service';
import { ChainService } from '../../services/chain.service';
import { TokenService } from '../../services/token.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { ServerSigningService } from '../../services/signature-server.service';
import { createPublicAuthMiddleware } from '../../middleware/public-auth.middleware';
import { PaymentStatusResponseSchema, ErrorResponseSchema } from '../../docs/schemas';
import { ErrorCodes } from '../../error-codes';

export async function getPaymentStatusRoute(
  app: FastifyInstance,
  paymentService: PaymentService,
  merchantService: MerchantService,
  chainService: ChainService,
  tokenService: TokenService,
  paymentMethodService: PaymentMethodService
) {
  const authMiddleware = createPublicAuthMiddleware(merchantService);

  app.get<{
    Params: { id: string };
  }>(
    '/payments/:id',
    {
      schema: {
        operationId: 'getPaymentStatus',
        tags: ['Payment'],
        summary: 'Get payment status and details',
        description: `
Retrieves the current status and full details of a payment by its payment hash. Requires x-public-key.

Stateless: blockchain is the source of truth for status when on-chain state is available (paid/refunded). Returns that status (and syncs DB), plus full payment details including merchant/token/chain info and contract parameters needed for the widget to resume a payment flow.

**Status Values:**
- \`CREATED\` - Payment created, awaiting on-chain transaction
- \`PAID\` - Payment completed on-chain
- \`REFUND_SUBMITTED\` - Refund request submitted
- \`REFUNDED\` - Payment refunded
- \`EXPIRED\` - Payment expired
- \`FAILED\` - Payment failed
        `,
        headers: {
          type: 'object',
          properties: {
            'x-public-key': {
              type: 'string',
              description: 'Public key (pk_live_xxx or pk_test_xxx)',
            },
            'x-origin': {
              type: 'string',
              description:
                'Origin for this GET endpoint (proxy often strips Origin). Verified against ALLOWED_WIDGET_ORIGIN when configured.',
            },
          },
        },
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Payment hash (bytes32)',
            },
          },
          required: ['id'],
        },
        response: {
          200: PaymentStatusResponseSchema,
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

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({
            code: ErrorCodes.INVALID_REQUEST,
            message: 'Payment ID is required',
          });
        }

        const paymentData = await paymentService.findByHash(id);

        if (!paymentData) {
          return reply.code(404).send({
            code: ErrorCodes.NOT_FOUND,
            message: 'Payment not found',
          });
        }

        // Validate payment belongs to the authenticated merchant
        const merchant = request.merchant;
        if (merchant && paymentData.merchant_id !== merchant.id) {
          return reply.code(403).send({
            code: ErrorCodes.FORBIDDEN,
            message: 'Payment does not belong to this merchant',
          });
        }

        // DB is source of truth for payment status (webhook-manager syncs on-chain state)
        const paymentStatus = {
          paymentId: paymentData.payment_hash,
          payerAddress: paymentData.payer_address ?? '',
          amount: Number(paymentData.amount),
          rawAmount: paymentData.amount.toString(),
          tokenAddress: paymentData.token_address ?? '',
          tokenSymbol: paymentData.token_symbol,
          treasuryAddress: paymentData.recipient_address ?? '',
          status: paymentData.status,
          transactionHash: paymentData.tx_hash ?? undefined,
          createdAt: new Date(paymentData.created_at).toISOString(),
          updatedAt: new Date(paymentData.updated_at).toISOString(),
        };

        const tokenPermitSupported = await paymentService.getTokenPermitSupported(
          paymentData.payment_method_id
        );

        // Fetch full payment details (merchant, chain, token, signature)
        const [merchantRecord, chain, paymentMethod] = await Promise.all([
          merchantService.findById(paymentData.merchant_id),
          chainService.findByNetworkId(paymentData.network_id),
          paymentMethodService.findById(paymentData.payment_method_id),
        ]);

        let detailsFields: Record<string, unknown> = {};

        if (merchantRecord && chain && paymentMethod) {
          const token = await tokenService.findById(paymentMethod.token_id);

          if (token) {
            const merchantId = ServerSigningService.merchantKeyToId(merchantRecord.merchant_key);
            const recipientAddress = merchantRecord.recipient_address as Address | null;
            const amountInWei = BigInt(paymentData.amount.toString());

            const deadline = Math.floor(new Date(paymentData.expires_at).getTime() / 1000);

            detailsFields = {
              orderId: paymentData.order_id ?? '',
              tokenAddress: token.address,
              gatewayAddress: chain.gateway_address ?? '',
              amount: amountInWei.toString(),
              tokenDecimals: paymentData.token_decimals,
              recipientAddress: recipientAddress ?? '',
              merchantId,
              deadline: deadline.toString(),
              forwarderAddress: chain.forwarder_address ?? undefined,
              successUrl: paymentData.success_url ?? '',
              failUrl: paymentData.fail_url ?? '',
              expiresAt: new Date(paymentData.expires_at).toISOString(),
              currency: paymentData.currency_code ?? undefined,
              fiatAmount: paymentData.fiat_amount ? Number(paymentData.fiat_amount) : undefined,
              tokenPrice: paymentData.token_price ? Number(paymentData.token_price) : undefined,
              txHash: paymentData.tx_hash ?? undefined,
            };
          }
        }

        return reply.code(200).send({
          success: true,
          data: {
            ...paymentStatus,
            paymentId: paymentData.payment_hash,
            chainId: paymentData.network_id,
            tokenSymbol: paymentData.token_symbol,
            status: paymentData.status,
            tokenPermitSupported,
            ...detailsFields,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get payment status';
        return reply.code(500).send({
          code: ErrorCodes.INTERNAL_ERROR,
          message,
        });
      }
    }
  );
}
