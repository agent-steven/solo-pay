import { FastifyInstance } from 'fastify';
import { parseUnits, keccak256, toHex, Address } from 'viem';
import { Decimal } from '@solo-pay/database';
import { randomBytes } from 'crypto';
import { ZodError } from 'zod';
import { CreatePaymentSchema } from '../../schemas/payment.schema';
import { BlockchainService } from '../../services/blockchain.service';
import { MerchantService } from '../../services/merchant.service';
import { ChainService } from '../../services/chain.service';
import { TokenService } from '../../services/token.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { PaymentService } from '../../services/payment.service';
import { ServerSigningService } from '../../services/signature-server.service';
import { CurrencyService } from '../../services/currency.service';
import { PriceClient } from '../../services/price-client.service';
import { createPublicAuthMiddleware } from '../../middleware/public-auth.middleware';
import { ErrorResponseSchema } from '../../docs/schemas';
import { ErrorCodes } from '../../error-codes';

export interface CreatePaymentBody {
  orderId: string;
  amount: number;
  tokenAddress: string;
  successUrl: string;
  failUrl: string;
  currency?: string;
}

export async function createPaymentRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  merchantService: MerchantService,
  chainService: ChainService,
  tokenService: TokenService,
  paymentMethodService: PaymentMethodService,
  paymentService: PaymentService,
  currencyService?: CurrencyService,
  priceClient?: PriceClient
) {
  const publicAuth = createPublicAuthMiddleware(merchantService);

  app.post<{ Body: CreatePaymentBody }>(
    '/payments',
    {
      schema: {
        operationId: 'createPayment',
        tags: ['Payment'],
        summary: 'Create payment (public key + Origin)',
        description: `
Creates a payment. Single endpoint for both widget and backend. Uses Public Key auth.

**Headers (required):** \`x-public-key\` = public key (pk_live_xxx or pk_test_xxx). \`Origin\` is verified against ALLOWED_WIDGET_ORIGIN when configured.

**Flow:** Public Key -> merchant -> token from request body (must be whitelisted and enabled for merchant) -> amount to wei -> payment_hash -> Payment record -> server signature.

**Currency conversion:** When \`currency\` is provided (e.g., USD, KRW), \`amount\` is treated as fiat amount and converted to token amount using price-service. Without \`currency\`, \`amount\` is the token amount (existing behavior).

**Response:** paymentId, chainId, tokenAddress, gatewayAddress, amount (wei), tokenDecimals, tokenSymbol, successUrl, failUrl, expiresAt, recipientAddress, merchantId, forwarderAddress, currency, fiatAmount, tokenPrice.
        `,
        headers: {
          type: 'object',
          properties: {
            'x-public-key': {
              type: 'string',
              description: 'Public key (pk_live_xxx or pk_test_xxx)',
            },
            origin: {
              type: 'string',
              description:
                'Request origin. Verified against ALLOWED_WIDGET_ORIGIN when configured. In browser this is set automatically.',
            },
          },
        },
        body: {
          type: 'object',
          required: ['orderId', 'amount', 'tokenAddress', 'successUrl', 'failUrl'],
          properties: {
            orderId: { type: 'string', description: 'Merchant order ID' },
            amount: {
              type: 'number',
              description:
                'Payment amount. Token amount when currency is omitted; fiat amount when currency is provided.',
            },
            tokenAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              default: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
              example: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
              description:
                'ERC-20 token contract address (must be whitelisted and enabled for merchant)',
            },
            successUrl: { type: 'string', format: 'uri', description: 'Redirect URL on success' },
            failUrl: { type: 'string', format: 'uri', description: 'Redirect URL on failure' },
            currency: {
              type: 'string',
              description:
                'Fiat currency code (e.g., USD, KRW). When provided, amount is treated as fiat amount.',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true,
                description: 'Indicates the request succeeded',
              },
              data: {
                type: 'object',
                properties: {
                  paymentId: { type: 'string' },
                  orderId: { type: 'string', description: 'Merchant order ID' },
                  chainId: { type: 'integer' },
                  tokenAddress: { type: 'string' },
                  gatewayAddress: { type: 'string' },
                  amount: { type: 'string', description: 'Wei' },
                  tokenDecimals: { type: 'integer' },
                  tokenSymbol: { type: 'string' },
                  successUrl: { type: 'string' },
                  failUrl: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  recipientAddress: {
                    type: 'string',
                    description: 'Merchant recipient wallet address',
                  },
                  merchantId: { type: 'string', description: 'Merchant ID (bytes32)' },
                  deadline: {
                    type: 'string',
                    description:
                      'Payment expiration timestamp (unix seconds) for on-chain validation',
                  },
                  forwarderAddress: {
                    type: 'string',
                    description: 'ERC2771Forwarder address for gasless payments',
                  },
                  tokenPermitSupported: {
                    type: 'boolean',
                    description: 'Whether the token supports EIP-2612 permit (gasless approval)',
                  },
                  currency: {
                    type: 'string',
                    description:
                      'Fiat currency code used for conversion (only when currency was provided)',
                  },
                  fiatAmount: {
                    type: 'number',
                    description:
                      'Original fiat amount before conversion (only when currency was provided)',
                  },
                  tokenPrice: {
                    type: 'number',
                    description: 'Token price at creation time (only when currency was provided)',
                  },
                },
              },
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: {
            type: 'object',
            description: 'Order ID already used for this merchant',
            properties: {
              code: { type: 'string', example: 'DUPLICATE_ORDER' },
              message: { type: 'string', example: 'Order ID already used for this merchant.' },
            },
          },
          500: ErrorResponseSchema,
        },
      },
      preHandler: publicAuth,
    },
    async (request, reply) => {
      try {
        const validated = CreatePaymentSchema.parse(request.body);
        const merchant = (
          request as {
            merchant?: {
              id: number;
              merchant_key: string;
              chain_id: number;
              recipient_address: string | null;
            };
          }
        ).merchant;
        if (!merchant) {
          return reply
            .code(403)
            .send({ code: ErrorCodes.UNAUTHORIZED, message: 'Merchant required' });
        }

        const origin = (request.headers['origin'] as string) ?? '';

        if (!merchant.chain_id) {
          return reply.code(400).send({
            code: ErrorCodes.CHAIN_NOT_CONFIGURED,
            message: 'Merchant chain is not configured',
          });
        }

        const chain = await chainService.findById(merchant.chain_id);
        if (!chain || !chain.gateway_address) {
          return reply.code(404).send({
            code: ErrorCodes.CHAIN_NOT_FOUND,
            message: 'Merchant chain or gateway not found',
          });
        }

        const chainId = chain.network_id;
        if (!blockchainService.isChainSupported(chainId)) {
          return reply.code(400).send({
            code: ErrorCodes.UNSUPPORTED_CHAIN,
            message: 'Unsupported chain',
          });
        }

        // Resolve token from request: must be in our whitelist (chain) and enabled for this merchant (combined filter)
        const token = await tokenService.findByAddress(chain.id, validated.tokenAddress);
        if (!token) {
          return reply.code(404).send({
            code: ErrorCodes.TOKEN_NOT_FOUND,
            message: 'Token not found or not whitelisted for this chain',
          });
        }
        if (token.chain_id !== merchant.chain_id) {
          return reply.code(400).send({
            code: ErrorCodes.CHAIN_MISMATCH,
            message: 'Token does not belong to merchant chain',
          });
        }
        const paymentMethod = await paymentMethodService.findByMerchantAndToken(
          merchant.id,
          token.id
        );
        if (!paymentMethod || !paymentMethod.is_enabled) {
          return reply.code(400).send({
            code: ErrorCodes.TOKEN_NOT_ENABLED,
            message:
              'Token is not enabled for this merchant. Add and enable it in payment methods first.',
          });
        }

        const tokenAddress = token.address;
        if (!blockchainService.validateTokenByAddress(chainId, tokenAddress)) {
          return reply.code(400).send({
            code: ErrorCodes.UNSUPPORTED_TOKEN,
            message: 'Unsupported token',
          });
        }

        const tokenDecimals = token.decimals;
        const tokenSymbol = token.symbol;

        // Currency conversion: when currency is provided, convert fiat amount to token amount
        let tokenAmount = validated.amount;
        let currencyCode: string | undefined;
        let fiatAmount: number | undefined;
        let tokenPrice: number | undefined;

        // When no currency, amount is the token amount directly — enforce 2 decimal places
        if (!validated.currency) {
          const decimalPart = validated.amount.toString().split('.')[1];
          if (decimalPart && decimalPart.length > 2) {
            return reply.code(400).send({
              code: ErrorCodes.VALIDATION_ERROR,
              message: 'amount must have at most 2 decimal places',
            });
          }
        }

        if (validated.currency) {
          if (!currencyService || !priceClient) {
            return reply.code(500).send({
              code: ErrorCodes.PRICE_SERVICE_NOT_CONFIGURED,
              message: 'Price service is not configured',
            });
          }

          const currency = await currencyService.findByCode(validated.currency);
          if (!currency) {
            return reply.code(400).send({
              code: ErrorCodes.INVALID_CURRENCY,
              message: `Unsupported currency: ${validated.currency}`,
            });
          }

          const priceData = await priceClient.getTokenPrice(chainId, tokenAddress, currency.code);

          currencyCode = currency.code;
          fiatAmount = validated.amount;
          tokenPrice = priceData.price;
          tokenAmount = Math.max(0.01, Math.floor((fiatAmount / tokenPrice) * 100) / 100);
        }

        const amountInWei = parseUnits(tokenAmount.toString(), tokenDecimals);
        const contracts = blockchainService.getChainContracts(chainId);
        const random = randomBytes(32);
        const paymentHash = keccak256(
          toHex(`${merchant.merchant_key}:${Date.now()}:${random.toString('hex')}`)
        );

        const merchantId = ServerSigningService.merchantKeyToId(merchant.merchant_key);
        const recipientAddress = (merchant.recipient_address ?? '') as Address;
        if (!recipientAddress) {
          return reply.code(400).send({
            code: ErrorCodes.RECIPIENT_NOT_CONFIGURED,
            message: 'Merchant recipient address is not configured',
          });
        }

        // Check for duplicate orderId BEFORE creating payment
        const existingPayment = await paymentService.findByOrderId(validated.orderId, merchant.id);
        if (existingPayment) {
          return reply.code(409).send({
            code: ErrorCodes.DUPLICATE_ORDER,
            message: 'Order ID already used for this merchant.',
          });
        }

        const paymentExpirySeconds = Number(process.env.PAYMENT_EXPIRY_SECONDS) || 300;
        const expiresAt = new Date(Date.now() + paymentExpirySeconds * 1000);
        const deadline = Math.floor(expiresAt.getTime() / 1000);
        await paymentService.create({
          payment_hash: paymentHash,
          merchant_id: merchant.id,
          payment_method_id: paymentMethod.id,
          amount: new Decimal(amountInWei.toString()),
          token_decimals: tokenDecimals,
          token_symbol: tokenSymbol,
          network_id: chainId,
          expires_at: expiresAt,
          order_id: validated.orderId,
          success_url: validated.successUrl,
          fail_url: validated.failUrl,
          origin,
          recipient_address: recipientAddress,
          currency_code: currencyCode,
          fiat_amount: fiatAmount !== undefined ? new Decimal(fiatAmount.toString()) : undefined,
          token_price: tokenPrice !== undefined ? new Decimal(tokenPrice.toString()) : undefined,
        });

        return reply.code(201).send({
          success: true,
          data: {
            paymentId: paymentHash,
            orderId: validated.orderId,
            chainId,
            tokenAddress,
            gatewayAddress: contracts?.gateway ?? '',
            amount: amountInWei.toString(),
            tokenDecimals,
            tokenSymbol,
            successUrl: validated.successUrl,
            failUrl: validated.failUrl,
            expiresAt: expiresAt.toISOString(),
            recipientAddress,
            merchantId,
            deadline: deadline.toString(),
            forwarderAddress: chain.forwarder_address ?? undefined,
            tokenPermitSupported: token.permit_enabled ?? false,
            currency: currencyCode,
            fiatAmount,
            tokenPrice,
          },
        });
      } catch (err) {
        if (err instanceof ZodError) {
          return reply.code(400).send({
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Input validation failed',
            details: err.errors,
          });
        }
        if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
          return reply.code(409).send({
            code: ErrorCodes.DUPLICATE_ORDER,
            message: 'A payment with this orderId already exists',
          });
        }
        const message = err instanceof Error ? err.message : 'Failed to create payment';
        return reply.code(500).send({ code: ErrorCodes.INTERNAL_ERROR, message });
      }
    }
  );
}
