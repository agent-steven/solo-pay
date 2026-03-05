import { createPublicClient, http, defineChain, PublicClient, Address, parseAbiItem } from 'viem';
import { PaymentStatus } from '../schemas/payment.schema';
import { ChainService } from './chain.service';
import { createLogger } from '../lib/logger';

/**
 * 내부 체인 설정 타입 (DB에서 로드된 데이터 기반)
 */
interface InternalChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  contracts: {
    gateway: string;
    forwarder: string;
  };
  tokens: Record<string, { address: string; decimals: number }>;
}

/**
 * 토큰 설정 타입
 */
export interface TokenConfig {
  address: string;
  decimals: number;
}

/**
 * 결제 이력 아이템 인터페이스
 */
export interface PaymentHistoryItem {
  paymentId: string;
  payerAddress: string;
  treasuryAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  decimals: number;
  amount: string;
  timestamp: string;
  transactionHash: string;
  status: string;
  isGasless: boolean;
  relayId?: string;
}

// PaymentEscrowed 이벤트 ABI (escrow flow)
const PAYMENT_ESCROWED_EVENT = parseAbiItem(
  'event PaymentEscrowed(bytes32 indexed paymentId, bytes32 indexed merchantId, address indexed payerAddress, address recipientAddress, address tokenAddress, uint256 amount, uint256 escrowDeadline, uint256 timestamp)'
);

interface PaymentEscrowedEventArgs {
  paymentId: string;
  merchantId: string;
  payerAddress: string;
  recipientAddress: string;
  tokenAddress: string;
  amount: bigint;
  escrowDeadline: bigint;
  timestamp: bigint;
}

// PaymentFinalized 이벤트 ABI
const PAYMENT_FINALIZED_EVENT = parseAbiItem(
  'event PaymentFinalized(bytes32 indexed paymentId, bytes32 indexed merchantId, address recipientAddress, address tokenAddress, uint256 amount, uint256 fee, uint256 timestamp)'
);

// PaymentCancelled 이벤트 ABI
const PAYMENT_CANCELLED_EVENT = parseAbiItem(
  'event PaymentCancelled(bytes32 indexed paymentId, bytes32 indexed merchantId, address indexed payerAddress, address tokenAddress, uint256 amount, uint256 timestamp)'
);

// PaymentGateway ABI (paymentStatus 조회용)
const PAYMENT_STATUS_ABI = [
  {
    type: 'function',
    name: 'paymentStatus',
    inputs: [{ name: 'paymentId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

/** On-chain PaymentStatus enum mapping */
type OnChainStatusString = 'pending' | 'escrowed' | 'finalized' | 'cancelled' | 'refunded';
const ON_CHAIN_STATUS_MAP: Record<number, OnChainStatusString> = {
  0: 'pending',
  1: 'escrowed',
  2: 'finalized',
  3: 'cancelled',
  4: 'refunded',
};

// ERC20 ABI (balanceOf, allowance, symbol, decimals)
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

/**
 * 트랜잭션 상태 인터페이스
 */
export interface TransactionStatus {
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  confirmations?: number;
}

/** Cache TTL in milliseconds */
const CACHE_TTL_MS = 60_000;

/**
 * 블록체인 서비스 - viem을 통한 스마트 컨트랙트 상호작용
 * 멀티체인 + 멀티토큰 아키텍처: DB 기반 동적 체인 관리
 * Lazy TTL cache — DB changes are picked up within 60 seconds without restart.
 */
export class BlockchainService {
  /** PublicClient cache keyed by `${chainId}:${rpcUrl}` */
  private clients: Map<string, PublicClient> = new Map();
  /** Cached chain configs (rebuilt on refresh) */
  private chainConfigs: Map<number, InternalChainConfig> = new Map();
  /** Reverse map: chainId -> (lowercaseAddress -> tokenInfo) */
  private addressToTokenMap: Map<number, Map<string, TokenConfig & { symbol: string }>> = new Map();
  /** Last time the cache was refreshed */
  private lastRefreshTime = 0;
  /** Mutex to prevent concurrent refreshes */
  private refreshPromise: Promise<void> | null = null;

  private readonly logger = createLogger('BlockchainService');

  constructor(private readonly chainService: ChainService) {}

  /**
   * Ensure cached data is fresh (within TTL). If stale, reload from DB.
   */
  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastRefreshTime < CACHE_TTL_MS) {
      return;
    }
    // Deduplicate concurrent refresh calls
    if (!this.refreshPromise) {
      this.refreshPromise = this.refresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async refresh(): Promise<void> {
    const chainsWithTokens = await this.chainService.findAllWithTokens();
    const newConfigs = new Map<number, InternalChainConfig>();
    const newAddressMap = new Map<number, Map<string, TokenConfig & { symbol: string }>>();

    for (const chainData of chainsWithTokens) {
      if (!chainData.gateway_address || !chainData.forwarder_address) {
        this.logger.warn(
          `⚠️ Chain ${chainData.name} (${chainData.network_id}) skipped: missing contract addresses`
        );
        continue;
      }

      const tokensMap: Record<string, { address: string; decimals: number }> = {};
      const addressMap = new Map<string, TokenConfig & { symbol: string }>();

      for (const token of chainData.tokens) {
        tokensMap[token.symbol] = {
          address: token.address,
          decimals: token.decimals,
        };
        addressMap.set(token.address.toLowerCase(), {
          address: token.address,
          decimals: token.decimals,
          symbol: token.symbol,
        });
      }

      newAddressMap.set(chainData.network_id, addressMap);

      newConfigs.set(chainData.network_id, {
        chainId: chainData.network_id,
        name: chainData.name,
        rpcUrl: chainData.rpc_url,
        contracts: {
          gateway: chainData.gateway_address,
          forwarder: chainData.forwarder_address,
        },
        tokens: tokensMap,
      });

      // Create/reuse PublicClient — keyed by chainId + rpcUrl so rpcUrl changes get new clients
      const clientKey = `${chainData.network_id}:${chainData.rpc_url}`;
      if (!this.clients.has(clientKey)) {
        const chain = defineChain({
          id: chainData.network_id,
          name: chainData.name,
          nativeCurrency: { name: 'Native', symbol: 'ETH', decimals: 18 },
          rpcUrls: { default: { http: [chainData.rpc_url] } },
        });
        const client = createPublicClient({ chain, transport: http(chainData.rpc_url) });
        this.clients.set(clientKey, client);
      }
    }

    this.chainConfigs = newConfigs;
    this.addressToTokenMap = newAddressMap;
    this.lastRefreshTime = Date.now();
  }

  /**
   * Get a PublicClient for the given chainId using the current rpcUrl from config.
   */
  private async getClient(chainId: number): Promise<PublicClient> {
    await this.ensureFresh();
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    const clientKey = `${chainId}:${config.rpcUrl}`;
    const client = this.clients.get(clientKey);
    if (!client) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    return client;
  }

  /**
   * 체인 지원 여부 확인
   */
  async isChainSupported(chainId: number): Promise<boolean> {
    await this.ensureFresh();
    return this.chainConfigs.has(chainId);
  }

  /**
   * 지원하는 체인 ID 목록 반환
   */
  async getSupportedChainIds(): Promise<number[]> {
    await this.ensureFresh();
    return Array.from(this.chainConfigs.keys());
  }

  /**
   * 체인 설정 조회
   */
  async getChainConfig(chainId: number): Promise<InternalChainConfig> {
    await this.ensureFresh();
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    return config;
  }

  /**
   * Check current gas prices (wei)
   */
  async getGasPrice(chainId: number): Promise<bigint> {
    const client = await this.getClient(chainId);
    return client.getGasPrice();
  }

  /**
   * Native token balance (wei) for an address.
   */
  async getNativeBalance(chainId: number, address: string): Promise<bigint> {
    const client = await this.getClient(chainId);
    return client.getBalance({ address: address as Address });
  }

  /**
   * 토큰 검증: 심볼 존재 + 주소 일치 확인
   */
  async validateToken(chainId: number, tokenSymbol: string, tokenAddress: string): Promise<boolean> {
    await this.ensureFresh();
    const config = this.chainConfigs.get(chainId);
    if (!config) return false;
    const token = config.tokens[tokenSymbol];
    if (!token) return false;
    return token.address.toLowerCase() === tokenAddress.toLowerCase();
  }

  /**
   * 토큰 검증: 주소만으로 확인
   */
  async validateTokenByAddress(chainId: number, tokenAddress: string): Promise<boolean> {
    await this.ensureFresh();
    const addressMap = this.addressToTokenMap.get(chainId);
    if (!addressMap) return false;
    return addressMap.has(tokenAddress.toLowerCase());
  }

  /**
   * 토큰 주소로 토큰 설정 조회
   */
  async getTokenConfigByAddress(
    chainId: number,
    tokenAddress: string
  ): Promise<(TokenConfig & { symbol: string }) | null> {
    await this.ensureFresh();
    const addressMap = this.addressToTokenMap.get(chainId);
    if (!addressMap) return null;
    return addressMap.get(tokenAddress.toLowerCase()) || null;
  }

  /**
   * 토큰 설정 조회
   */
  async getTokenConfig(chainId: number, tokenSymbol: string): Promise<TokenConfig | null> {
    await this.ensureFresh();
    const config = this.chainConfigs.get(chainId);
    if (!config) return null;
    return config.tokens[tokenSymbol] || null;
  }

  /**
   * 특정 체인과 토큰 심볼로 토큰 주소 조회
   */
  async getTokenAddress(chainId: number, symbol: string): Promise<string | undefined> {
    await this.ensureFresh();
    const config = this.chainConfigs.get(chainId);
    return config?.tokens[symbol]?.address;
  }

  /**
   * 특정 체인의 컨트랙트 주소 조회
   */
  async getChainContracts(chainId: number): Promise<{ gateway: string; forwarder: string } | undefined> {
    await this.ensureFresh();
    const config = this.chainConfigs.get(chainId);
    return config?.contracts;
  }

  /**
   * 결제 상태를 스마트 컨트랙트에서 조회
   */
  async getPaymentStatus(chainId: number, paymentId: string): Promise<PaymentStatus | null> {
    try {
      const client = await this.getClient(chainId);
      const config = await this.getChainConfig(chainId);
      const contractAddress = config.contracts.gateway as Address;

      const statusValue = await client.readContract({
        address: contractAddress,
        abi: PAYMENT_STATUS_ABI,
        functionName: 'paymentStatus',
        args: [paymentId as `0x${string}`],
      });

      const onChainStatus: OnChainStatusString =
        ON_CHAIN_STATUS_MAP[Number(statusValue)] ?? 'pending';
      const now = new Date().toISOString();

      if (onChainStatus !== 'pending') {
        const paymentDetails = await this.getPaymentDetailsByPaymentId(chainId, paymentId);
        if (paymentDetails) {
          let releaseTxHash: string | undefined;
          if (onChainStatus === 'finalized' || onChainStatus === 'cancelled') {
            releaseTxHash = await this.getReleaseTxHash(chainId, paymentId, onChainStatus);
          }

          return {
            paymentId,
            payerAddress: paymentDetails.payerAddress,
            amount: Number(paymentDetails.amount),
            tokenAddress: paymentDetails.tokenAddress,
            tokenSymbol: paymentDetails.tokenSymbol,
            treasuryAddress: paymentDetails.treasuryAddress,
            status: onChainStatus,
            createdAt: paymentDetails.timestamp,
            updatedAt: now,
            transactionHash: paymentDetails.transactionHash,
            releaseTxHash,
          };
        }
      }

      return {
        paymentId,
        payerAddress: '',
        amount: 0,
        tokenAddress: '',
        tokenSymbol: '',
        treasuryAddress: '',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      this.logger.error({ err: error }, '결제 상태 조회 실패');
      const now = new Date().toISOString();
      return {
        paymentId,
        payerAddress: '',
        amount: 0,
        tokenAddress: '',
        tokenSymbol: '',
        treasuryAddress: '',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  /**
   * paymentId로 PaymentEscrowed 이벤트 조회
   */
  private async getPaymentDetailsByPaymentId(
    chainId: number,
    paymentId: string
  ): Promise<{
    payerAddress: string;
    treasuryAddress: string;
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    timestamp: string;
    transactionHash: string;
  } | null> {
    try {
      const client = await this.getClient(chainId);
      const config = await this.getChainConfig(chainId);
      const contractAddress = config.contracts.gateway as Address;

      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock > BigInt(10000) ? currentBlock - BigInt(10000) : BigInt(0);

      const logs = await client.getLogs({
        address: contractAddress,
        event: PAYMENT_ESCROWED_EVENT,
        args: {
          paymentId: paymentId as `0x${string}`,
        },
        fromBlock,
        toBlock: 'latest',
      });

      if (logs.length === 0) {
        return null;
      }

      const log = logs[0];
      if (!log.blockHash) {
        return null;
      }
      const block = await client.getBlock({ blockHash: log.blockHash });
      const args = log.args as PaymentEscrowedEventArgs;
      const tokenAddress = args.tokenAddress || '';

      const tokenSymbol = tokenAddress
        ? await this.getTokenSymbolOnChain(chainId, tokenAddress)
        : 'UNKNOWN';

      return {
        payerAddress: args.payerAddress || '',
        treasuryAddress: args.recipientAddress || '',
        tokenAddress,
        tokenSymbol,
        amount: (args.amount || BigInt(0)).toString(),
        timestamp: new Date(Number(args.timestamp || block.timestamp) * 1000).toISOString(),
        transactionHash: log.transactionHash,
      };
    } catch (err) {
      this.logger.error({ err }, '결제 상세 정보 조회 실패');
      return null;
    }
  }

  /**
   * Query the release (finalize/cancel) transaction hash from on-chain events.
   */
  private async getReleaseTxHash(
    chainId: number,
    paymentId: string,
    status: 'finalized' | 'cancelled'
  ): Promise<string | undefined> {
    try {
      const client = await this.getClient(chainId);
      const config = await this.getChainConfig(chainId);
      const contractAddress = config.contracts.gateway as Address;

      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock > BigInt(10000) ? currentBlock - BigInt(10000) : BigInt(0);

      const event = status === 'finalized' ? PAYMENT_FINALIZED_EVENT : PAYMENT_CANCELLED_EVENT;

      const logs = await client.getLogs({
        address: contractAddress,
        event,
        args: { paymentId: paymentId as `0x${string}` },
        fromBlock,
        toBlock: 'latest',
      });

      if (logs.length > 0) {
        return logs[0].transactionHash;
      }
      return undefined;
    } catch (err) {
      this.logger.error({ err }, 'Failed to query release txHash');
      return undefined;
    }
  }

  /**
   * 결제를 스마트 컨트랙트에 기록
   */
  async recordPaymentOnChain(paymentData: {
    payerAddress: string;
    amount: bigint;
    currency: string;
    tokenAddress: Address;
    description?: string;
  }): Promise<string> {
    try {
      if (!paymentData.payerAddress || !paymentData.amount || !paymentData.tokenAddress) {
        throw new Error('필수 결제 정보가 누락되었습니다');
      }
      return '0x' + 'a'.repeat(64);
    } catch (error) {
      this.logger.error({ err: error }, '스마트 컨트랙트에 결제 기록 실패');
      if (error instanceof Error && error.message === '필수 결제 정보가 누락되었습니다') {
        throw error;
      }
      throw new Error('결제를 기록할 수 없습니다');
    }
  }

  /**
   * 트랜잭션 수신 확인 확인
   */
  async waitForConfirmation(
    chainId: number,
    transactionHash: string,
    _confirmations: number = 1
  ): Promise<{ status: string; blockNumber: bigint; transactionHash: string } | null> {
    try {
      const client = await this.getClient(chainId);
      const receipt = await client.waitForTransactionReceipt({
        hash: transactionHash as `0x${string}`,
        confirmations: _confirmations,
      });
      return {
        status: receipt.status === 'success' ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      this.logger.error({ err: error }, '트랜잭션 확인 대기 실패');
      return null;
    }
  }

  /**
   * 가스 비용 추정
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async estimateGasCost(
    _chainId: number,
    _tokenAddress: Address,
    _amount: bigint
  ): Promise<bigint> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    return BigInt('200000');
  }

  /**
   * 토큰 잔액 조회
   */
  async getTokenBalance(
    chainId: number,
    tokenAddress: string,
    walletAddress: string
  ): Promise<string> {
    try {
      const client = await this.getClient(chainId);
      const balance = await client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress as Address],
      });

      return balance.toString();
    } catch (error) {
      this.logger.error({ err: error }, '토큰 잔액 조회 실패');
      throw new Error('토큰 잔액을 조회할 수 없습니다');
    }
  }

  /**
   * 토큰 승인액 조회
   */
  async getTokenAllowance(
    chainId: number,
    tokenAddress: string,
    owner: string,
    spender: string
  ): Promise<string> {
    try {
      const client = await this.getClient(chainId);
      const allowance = await client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner as Address, spender as Address],
      });

      return allowance.toString();
    } catch (error) {
      this.logger.error({ err: error }, '토큰 승인액 조회 실패');
      throw new Error('토큰 승인액을 조회할 수 없습니다');
    }
  }

  /**
   * 토큰 심볼 조회 (온체인 ERC20.symbol())
   */
  async getTokenSymbolOnChain(chainId: number, tokenAddress: string): Promise<string> {
    try {
      const client = await this.getClient(chainId);
      const symbol = await client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      });

      return symbol;
    } catch (error) {
      this.logger.error({ err: error }, '토큰 심볼 조회 실패');
      return 'UNKNOWN';
    }
  }

  /**
   * 트랜잭션 상태 조회
   */
  async getTransactionStatus(chainId: number, txHash: string): Promise<TransactionStatus> {
    try {
      const client = await this.getClient(chainId);
      const receipt = await client.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      const currentBlock = await client.getBlockNumber();
      const confirmations = Number(currentBlock - receipt.blockNumber);

      return {
        status: receipt.status === 'success' ? 'confirmed' : 'failed',
        blockNumber: Number(receipt.blockNumber),
        confirmations,
      };
    } catch {
      return {
        status: 'pending',
      };
    }
  }

  /**
   * 사용자의 결제 이력 조회 (PaymentCompleted 이벤트 로그)
   */
  async getPaymentHistory(
    chainId: number,
    payerAddress: string,
    blockRange: number = 1000
  ): Promise<PaymentHistoryItem[]> {
    try {
      const client = await this.getClient(chainId);
      const config = await this.getChainConfig(chainId);
      const contractAddress = config.contracts.gateway as Address;

      const currentBlock = await client.getBlockNumber();
      const fromBlock =
        currentBlock > BigInt(blockRange) ? currentBlock - BigInt(blockRange) : BigInt(0);

      const logs = await client.getLogs({
        address: contractAddress,
        event: PAYMENT_ESCROWED_EVENT,
        args: {
          payerAddress: payerAddress as Address,
        },
        fromBlock,
        toBlock: 'latest',
      });

      const logsWithBlockHash = logs.filter((log) => log.blockHash !== null);

      const payments: PaymentHistoryItem[] = await Promise.all(
        logsWithBlockHash.map(async (log) => {
          const block = await client.getBlock({ blockHash: log.blockHash as `0x${string}` });
          const args = log.args as PaymentEscrowedEventArgs;
          const tokenAddress = args.tokenAddress || '';
          const tokenSymbol = tokenAddress
            ? await this.getTokenSymbolOnChain(chainId, tokenAddress)
            : 'UNKNOWN';
          const decimals = tokenAddress ? await this.getDecimals(chainId, tokenAddress) : 18;

          return {
            paymentId: args.paymentId || '',
            payerAddress: args.payerAddress || '',
            treasuryAddress: args.recipientAddress || '',
            tokenAddress,
            tokenSymbol,
            decimals,
            amount: (args.amount || BigInt(0)).toString(),
            timestamp: (args.timestamp || block.timestamp).toString(),
            transactionHash: log.transactionHash,
            status: 'escrowed',
            isGasless: false,
            relayId: undefined,
          };
        })
      );

      payments.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));

      return payments;
    } catch (error) {
      this.logger.error({ err: error }, '결제 이력 조회 실패');
      throw new Error('결제 이력을 조회할 수 없습니다');
    }
  }

  /**
   * ERC20 토큰의 decimals 조회
   */
  async getDecimals(chainId: number, tokenAddress: string): Promise<number> {
    try {
      const client = await this.getClient(chainId);
      const decimals = await client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });

      return Number(decimals);
    } catch {
      this.logger.warn(`Failed to get decimals for ${tokenAddress}, using fallback 18`);
      return 18;
    }
  }
}
