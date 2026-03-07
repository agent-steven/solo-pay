/**
 * Single wagmi config source for the widget.
 * - If NEXT_PUBLIC_WC_PROJECT_ID is set: AppKit (Reown/WalletConnect) adapter with MetaMask + Trust Wallet connectors.
 * - Otherwise: fallback wagmi config with injected connectors only.
 */
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
  mainnet,
  polygon,
  arbitrum,
  optimism,
  base,
  sepolia,
  defineChain as appkitDefineChain,
} from '@reown/appkit/networks';
import { http, fallback, createConfig } from 'wagmi';
import { metaMask, injected } from 'wagmi/connectors';
import {
  arbitrum as wagmiArbitrum,
  base as wagmiBase,
  mainnet as wagmiMainnet,
  optimism as wagmiOptimism,
  polygon as wagmiPolygon,
  polygonAmoy as wagmiPolygonAmoy,
  sepolia as wagmiSepolia,
} from 'wagmi/chains';
import { defineChain as viemDefineChain } from 'viem';
import type { EIP1193Provider } from 'viem';
import { getMetadata } from './appkit-config';
import { getTrustWalletProvider } from './lib/wallet-providers';
import type { Config } from 'wagmi';

// ─── Shared helpers ──────────────────────────────────────────────────────────

export function getWcProjectId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
  return id && id.length > 0 ? id : undefined;
}

// ─── Shared RPC URLs ─────────────────────────────────────────────────────────

const RPC = {
  localhost: process.env.NEXT_PUBLIC_LOCALHOST_RPC || 'http://127.0.0.1:8545',
  mainnet: 'https://ethereum-rpc.publicnode.com',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  polygonAmoy: 'https://polygon-amoy-bor-rpc.publicnode.com',
  polygonAmoyFallback: 'https://polygon-amoy.drpc.org',
  optimism: 'https://optimism-rpc.publicnode.com',
  arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
  base: 'https://base-rpc.publicnode.com',
  sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
} as const;

// ─── AppKit networks (Reown format) ──────────────────────────────────────────

const appkitLocalhost = appkitDefineChain({
  id: 31337,
  caipNetworkId: 'eip155:31337',
  chainNamespace: 'eip155',
  name: 'Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC.localhost] } },
});

// Override Polygon Amoy with a public RPC URL.
// The default from @reown/appkit/networks uses rpc.walletconnect.org which Trust Wallet rejects
// when adding a custom network via wallet_addEthereumChain.
const appkitPolygonAmoy = appkitDefineChain({
  id: 80002,
  caipNetworkId: 'eip155:80002',
  chainNamespace: 'eip155',
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: [RPC.polygonAmoy] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' } },
});

export const appkitNetworks = [
  appkitLocalhost,
  mainnet,
  polygon,
  appkitPolygonAmoy,
  optimism,
  arbitrum,
  base,
  sepolia,
];

// ─── Trust Wallet connector (shared between fallback and AppKit configs) ──────

function trustWalletTarget() {
  if (typeof window === 'undefined') return undefined;
  const provider = getTrustWalletProvider();
  if (!provider) return undefined;
  return { id: 'trustWallet', name: 'Trust Wallet', provider: provider as EIP1193Provider };
}

const trustWalletConnector = injected({
  target: trustWalletTarget,
  unstable_shimAsyncInject: 3_500,
});

// ─── Fallback wagmi config (no WalletConnect) ────────────────────────────────

const wagmiLocalhost = viemDefineChain({
  id: 31337,
  name: 'Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC.localhost] } },
});

// Override Polygon Amoy chain definition with public RPC URL.
// The default from wagmi/chains uses rpc.walletconnect.org which wallets reject
// as "Invalid URL" when adding a custom network via wallet_addEthereumChain.
const wagmiPolygonAmoyOverride = viemDefineChain({
  ...wagmiPolygonAmoy,
  rpcUrls: { default: { http: [RPC.polygonAmoy] } },
});

export const fallbackConfig = createConfig({
  connectors: [injected(), trustWalletConnector, metaMask({ enableAnalytics: false })],
  chains: [
    wagmiLocalhost,
    wagmiMainnet,
    wagmiPolygon,
    wagmiPolygonAmoyOverride,
    wagmiOptimism,
    wagmiArbitrum,
    wagmiBase,
    wagmiSepolia,
  ],
  transports: {
    [wagmiLocalhost.id]: http(RPC.localhost),
    [wagmiMainnet.id]: http(RPC.mainnet),
    [wagmiPolygon.id]: http(RPC.polygon),
    [wagmiPolygonAmoyOverride.id]: fallback([http(RPC.polygonAmoy), http(RPC.polygonAmoyFallback)]),
    [wagmiOptimism.id]: http(RPC.optimism),
    [wagmiArbitrum.id]: http(RPC.arbitrum),
    [wagmiBase.id]: http(RPC.base),
    [wagmiSepolia.id]: http(RPC.sepolia),
  },
  ssr: true,
});

// ─── AppKit adapter factory ───────────────────────────────────────────────────

export type AppKitConfigResult = { adapter: WagmiAdapter; config: Config };

type WagmiAdapterConfig = ConstructorParameters<typeof WagmiAdapter>[0];

const appkitTransports = {
  [appkitLocalhost.id]: http(RPC.localhost),
  [mainnet.id]: http(RPC.mainnet),
  [polygon.id]: http(RPC.polygon),
  [appkitPolygonAmoy.id]: fallback([http(RPC.polygonAmoy), http(RPC.polygonAmoyFallback)]),
  [optimism.id]: http(RPC.optimism),
  [arbitrum.id]: http(RPC.arbitrum),
  [base.id]: http(RPC.base),
  [sepolia.id]: http(RPC.sepolia),
};

export function createAppKitConfig(projectId: string): AppKitConfigResult {
  const dynamicMetadata = getMetadata();
  const adapter = new WagmiAdapter({
    projectId,
    networks: appkitNetworks as WagmiAdapterConfig['networks'],
    transports: appkitTransports,
    ssr: true,
    connectors: [
      metaMask({ enableAnalytics: false }),
      injected({ target: trustWalletTarget, unstable_shimAsyncInject: 3_500 }),
      injected(),
    ],
    metadata: {
      name: dynamicMetadata.name,
      description: dynamicMetadata.description,
      url: dynamicMetadata.url || 'https://solopay.example',
      icons: dynamicMetadata.icons,
    },
  } as WagmiAdapterConfig);
  return { adapter, config: adapter.wagmiConfig };
}
