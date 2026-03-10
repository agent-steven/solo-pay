import { FastifyInstance } from 'fastify';
import { Address } from 'viem';
import { ZodError } from 'zod';
import {
  GaslessRequestSchema,
  ForwardRequest,
  createAmountValidationSchema,
} from '../../schemas/payment.schema';
import { RelayerService } from '../../services/relayer.service';
import { RelayService } from '../../services/relay.service';
import { PaymentService } from '../../services/payment.service';
import { MerchantService } from '../../services/merchant.service';
import { BlockchainService } from '../../services/blockchain.service';
import { createPublicAuthMiddleware } from '../../middleware/public-auth.middleware';
import {
  GaslessRequestSchema as GaslessRequestDocSchema,
  GaslessResponseSchema,
  ErrorResponseSchema,
} from '../../docs/schemas';
import { ErrorCodes } from '../../error-codes';

export interface SubmitGaslessRequest {
  paymentId: string;
  forwarderAddress: string;
  forwardRequest: ForwardRequest;
}

export async function submitGaslessRoute(
  app: FastifyInstance,
  relayerServices: Map<number, RelayerService>,
  relayService: RelayService,
  paymentService: PaymentService,
  merchantService: MerchantService,
  blockchainService: BlockchainService
) {
  const authMiddleware = createPublicAuthMiddleware(merchantService);

  app.post<{ Params: { id: string }; Body: SubmitGaslessRequest }>(
    '/payments/:id/relay',
    {
      schema: {
        operationId: 'submitPaymentRelay',
        tags: ['Payment'],
        summary: 'Submit gasless relay request',
        description: `
Submits a gasless (meta-transaction) payment using ERC-2771 forwarder.

**How it works:**
1. User signs an EIP-712 typed data message off-chain
2. Client submits the signed ForwardRequest to this endpoint
3. Relayer submits the transaction on behalf of the user
4. User pays with tokens, not ETH gas

**Requirements:**
- Valid payment ID from POST /payments
- EIP-712 signature from the payer
- Token approval for PaymentGateway contract

**Security:**
- Public key + Origin authentication required
- Payment ID is validated (payment must exist; amount and status checked)
- Amount in forwardRequest.data is validated against DB amount
- forwarderAddress and forwardRequest.to are validated against authorized contract addresses
- Signature format is validated before relay submission
        `,
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
        body: GaslessRequestDocSchema,
        response: {
          202: GaslessResponseSchema,
          400: ErrorResponseSchema,
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

        // Validate input
        let validatedData;
        try {
          validatedData = GaslessRequestSchema.parse(request.body);
        } catch (error) {
          if (error instanceof ZodError) {
            return reply.code(400).send({
              code: ErrorCodes.VALIDATION_ERROR,
              message: 'Input validation failed',
              details: error.errors,
            });
          }
          throw error;
        }

        // Find payment
        const payment = await paymentService.findByHash(id);
        if (!payment) {
          return reply.code(404).send({
            code: ErrorCodes.PAYMENT_NOT_FOUND,
            message: 'Payment not found',
          });
        }

        // Validate payment belongs to the authenticated merchant
        const merchant = request.merchant;
        if (merchant && payment.merchant_id !== merchant.id) {
          return reply.code(403).send({
            code: ErrorCodes.FORBIDDEN,
            message: 'Payment does not belong to this merchant',
          });
        }

        // Validate forwardRequest.data amount matches DB amount prevent frontend manipulation
        const dbAmount = BigInt(payment.amount.toString());
        try {
          validatedData = createAmountValidationSchema(dbAmount).parse(validatedData);
        } catch (error) {
          if (error instanceof ZodError) {
            return reply.code(400).send({
              code: ErrorCodes.VALIDATION_ERROR,
              message: 'Input validation failed',
              details: error.errors,
            });
          }
          throw error;
        }

        // Check payment status
        if (payment.status !== 'CREATED') {
          return reply.code(400).send({
            code: ErrorCodes.INVALID_PAYMENT_STATUS,
            message: `Payment status is ${payment.status}. Gasless request is only allowed in CREATED status.`,
          });
        }

        // Check payment expiry
        if (payment.expires_at && new Date() > new Date(payment.expires_at)) {
          await paymentService.updateStatus(payment.id, 'EXPIRED');
          return reply.code(400).send({
            code: ErrorCodes.PAYMENT_EXPIRED,
            message: 'Payment has expired',
          });
        }

        // Reject if relay already in flight (duplicate submit would revert on-chain as already processed).
        // RelayStatus in DB: QUEUED | SUBMITTED | CONFIRMED | FAILED; in-flight = any status other than FAILED.
        const existingRelays = await relayService.findByPaymentId(payment.id);
        const inFlight = existingRelays.filter((r) => r.status !== 'FAILED');
        if (inFlight.length > 0) {
          return reply.code(400).send({
            code: ErrorCodes.RELAY_ALREADY_SUBMITTED,
            message:
              'Gasless already submitted for this payment. Check relay status or use a new checkout.',
          });
        }

        // Resolve relayer for this payment's chain
        const relayerService = relayerServices.get(payment.network_id);
        if (!relayerService) {
          return reply.code(400).send({
            code: ErrorCodes.RELAYER_NOT_CONFIGURED,
            message: `No relayer configured for chain ${payment.network_id}`,
          });
        }

        // Validate contract addresses match the authorized contracts for this chain
        const chainContracts = blockchainService.getChainContracts(payment.network_id);
        if (!chainContracts) {
          return reply.code(400).send({
            code: ErrorCodes.CHAIN_CONFIG_ERROR,
            message: `Chain configuration not found for chain ${payment.network_id}`,
          });
        }

        if (
          validatedData.forwarderAddress.toLowerCase() !== chainContracts.forwarder.toLowerCase()
        ) {
          return reply.code(400).send({
            code: ErrorCodes.INVALID_REQUEST,
            message: 'Forwarder address does not match the authorized forwarder for this chain',
          });
        }

        if (
          validatedData.forwardRequest.to.toLowerCase() !== chainContracts.gateway.toLowerCase()
        ) {
          return reply.code(400).send({
            code: ErrorCodes.INVALID_REQUEST,
            message: 'Target contract does not match the authorized PaymentGateway for this chain',
          });
        }

        // Validate ForwardRequest signature
        if (!relayerService.validateTransactionData(validatedData.forwardRequest.signature)) {
          return reply.code(400).send({
            code: ErrorCodes.INVALID_SIGNATURE,
            message: 'Invalid signature format',
          });
        }

        // Submit gasless transaction (with ForwardRequest)
        const result = await relayerService.submitForwardTransaction(
          id,
          validatedData.forwarderAddress as Address,
          validatedData.forwardRequest
        );

        // Save RelayRequest to DB
        await relayService.create({
          relay_ref: result.relayRequestId,
          payment_id: payment.id,
        });

        // Keep CREATED status after relay submit (transitions to PAID on on-chain confirmation)

        return reply.code(202).send({
          success: true,
          data: {
            status: result.status,
            message: 'Gasless transaction submitted',
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to submit gasless transaction';
        return reply.code(500).send({
          code: ErrorCodes.INTERNAL_ERROR,
          message,
        });
      }
    }
  );
}
