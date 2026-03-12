import { z } from 'zod';
import { decodeFunctionData } from 'viem';
import PaymentGatewayV1Artifact from '@solo-pay/contracts/artifacts/src/PaymentGatewayV1.sol/PaymentGatewayV1.json';

// Create payment request (POST /payments): orderId, amount, tokenAddress, successUrl, failUrl, currency?
export const CreatePaymentSchema = z
  .object({
    orderId: z
      .string()
      .trim()
      .min(1, 'orderId is required')
      .max(255, 'orderId must be 255 characters or less')
      .regex(
        /^[a-zA-Z0-9_\-.:]+$/,
        'orderId must contain only alphanumeric characters, hyphens, underscores, dots, and colons'
      ),
    amount: z.number().positive('amount must be positive'),
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'tokenAddress must be a valid Ethereum address (0x + 40 hex)'),
    successUrl: z.string().url('successUrl must be a valid URL'),
    failUrl: z.string().url('failUrl must be a valid URL'),
    currency: z.string().min(1).max(10).optional(), // fiat currency code (e.g., USD, KRW); when set, amount is fiat
  })
  .strict(); // Reject unknown keys so only allowed params are accepted

export type CreatePaymentRequest = z.infer<typeof CreatePaymentSchema>;

// Prepare wallet: paymentId + walletAddress (public auth)
export const PrepareWalletSchema = z.object({
  paymentId: z.string().min(1, 'paymentId is required'),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be 0x + 40 hex chars'),
});

export type PrepareWalletRequest = z.infer<typeof PrepareWalletSchema>;

// Payment info request schema (returns contract info without creating a payment)
// chainId and merchantId are derived from the authenticated merchant
export const PaymentInfoSchema = z.object({
  amount: z.number().positive('amount must be positive'),
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'tokenAddress must be a valid Ethereum address (0x + 40 hex)'),
});

export type PaymentInfoRequest = z.infer<typeof PaymentInfoSchema>;

// Payment status response schema
// Note: treasuryAddress is the contract address that receives payments (set at deployment)
export const PaymentStatusSchema = z.object({
  paymentId: z.string(),
  payerAddress: z.string(), // wallet address of payer (from chain event)
  amount: z.number(),
  rawAmount: z.string().optional(), // wei string for precise comparison
  tokenAddress: z.string(),
  tokenSymbol: z.string(),
  treasuryAddress: z.string(), // recipient address from event
  status: z.enum(['pending', 'paid', 'refunded', 'failed']),
  transactionHash: z.string().optional(),
  blockNumber: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/**
 * ERC2771 ForwardRequest schema
 * Parameters passed to OZ ERC2771Forwarder.execute()
 *
 * nonce must be passed as-is from the client's signing step.
 * Re-fetching on the server would cause signature verification to fail.
 */
export const ForwardRequestSchema = z.object({
  from: z.string().startsWith('0x').length(42),
  to: z.string().startsWith('0x').length(42),
  value: z.string(),
  gas: z.string(),
  nonce: z.string(), // nonce used by the client during signing
  deadline: z.string(),
  data: z.string().startsWith('0x'),
  signature: z.string().startsWith('0x'),
});

export type ForwardRequest = z.infer<typeof ForwardRequestSchema>;

// Gasless request schema
export const GaslessRequestSchema = z.object({
  paymentId: z.string(),
  forwarderAddress: z.string().startsWith('0x').length(42),
  forwardRequest: ForwardRequestSchema,
});

export type GaslessRequest = z.infer<typeof GaslessRequestSchema>;

/**
 * Expected values for pay() function parameters, sourced from the DB payment record.
 */
export interface PayCallExpectedParams {
  paymentId: string; // bytes32 payment hash
  tokenAddress: string; // token contract address
  amount: bigint; // wei amount
  recipientAddress: string; // merchant recipient address
  merchantId: string; // bytes32 keccak256(merchantKey)
}

/**
 * Creates a refined GaslessRequestSchema that validates ALL pay() function
 * parameters in forwardRequest.data against DB values.
 * This prevents frontend manipulation of any contract call parameter.
 */
export function createPayCallValidationSchema(
  expected: PayCallExpectedParams
): z.ZodType<GaslessRequest> {
  return GaslessRequestSchema.superRefine((data, ctx) => {
    try {
      const decoded = decodeFunctionData({
        abi: PaymentGatewayV1Artifact.abi,
        data: data.forwardRequest.data as `0x${string}`,
      });

      // Verify it's a pay() function call
      if (decoded.functionName !== 'pay') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'forwardRequest.data must be a pay() function call',
          path: ['forwardRequest', 'data'],
        });
        return;
      }

      const args = decoded.args;
      if (!args || args.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'pay() call missing required arguments',
          path: ['forwardRequest', 'data'],
        });
        return;
      }

      // args[0] = paymentId (bytes32)
      const decodedPaymentId = args[0] as string;
      if (decodedPaymentId.toLowerCase() !== expected.paymentId.toLowerCase()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `paymentId mismatch. DB: ${expected.paymentId}, request: ${decodedPaymentId}`,
          path: ['forwardRequest', 'data'],
        });
      }

      // args[1] = tokenAddress (address)
      const decodedTokenAddress = args[1] as string;
      if (decodedTokenAddress.toLowerCase() !== expected.tokenAddress.toLowerCase()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `tokenAddress mismatch. DB: ${expected.tokenAddress}, request: ${decodedTokenAddress}`,
          path: ['forwardRequest', 'data'],
        });
      }

      // args[2] = amount (uint256)
      const decodedAmount = args[2] as bigint;
      if (decodedAmount !== expected.amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `amount mismatch. DB: ${expected.amount.toString()}, request: ${decodedAmount.toString()}`,
          path: ['forwardRequest', 'data'],
        });
      }

      // args[3] = recipientAddress (address)
      const decodedRecipient = args[3] as string;
      if (decodedRecipient.toLowerCase() !== expected.recipientAddress.toLowerCase()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `recipientAddress mismatch. DB: ${expected.recipientAddress}, request: ${decodedRecipient}`,
          path: ['forwardRequest', 'data'],
        });
      }

      // args[4] = merchantId (bytes32)
      const decodedMerchantId = args[4] as string;
      if (decodedMerchantId.toLowerCase() !== expected.merchantId.toLowerCase()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `merchantId mismatch. DB: ${expected.merchantId}, request: ${decodedMerchantId}`,
          path: ['forwardRequest', 'data'],
        });
      }
    } catch {
      // If decoding fails, the data is invalid
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Failed to parse forwardRequest.data. Must be valid pay() function call data.',
        path: ['forwardRequest', 'data'],
      });
    }
  });
}

// Relay execution request schema
export const RelayExecutionSchema = z.object({
  paymentId: z.string(),
  transactionData: z.string().startsWith('0x'),
  gasEstimate: z.number(),
});

export type RelayExecution = z.infer<typeof RelayExecutionSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.any()).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
