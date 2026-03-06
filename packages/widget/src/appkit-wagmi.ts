/**
 * Single wagmi config source for the widget.
 * - If NEXT_PUBLIC_WC_PROJECT_ID is set: AppKit (Reown/WalletConnect) adapter with MetaMask + Trust Wallet connectors.
 * - Otherwise: fallback wagmi config with injected connectors only.
 */
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
  mainnet,
  polygon,
  polygonAmoy,
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
import { getMetadata } from './appkit-config';
import { getTrustWalletProvider } from './lib/wallet-providers';
import type { Config } from 'wagmi';

// ─── Shared helpers ──────────────────────────────────────────────────────────

export function getWcProjectId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
  return id && id.length > 0 ? id : undefined;
}

// ─── AppKit networks (Reown format) ──────────────────────────────────────────

const appkitLocalhost = appkitDefineChain({
  id: 31337,
  caipNetworkId: 'eip155:31337',
  chainNamespace: 'eip155',
  name: 'Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_LOCALHOST_RPC || 'http://127.0.0.1:8545'] },
  },
});

export const appkitNetworks = [
  appkitLocalhost,
  mainnet,
  polygon,
  polygonAmoy,
  optimism,
  arbitrum,
  base,
  sepolia,
];

// ─── Fallback wagmi config (no WalletConnect) ────────────────────────────────

const wagmiLocalhost = viemDefineChain({
  id: 31337,
  name: 'Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_LOCALHOST_RPC || 'http://127.0.0.1:8545'] },
  },
});

const trustWalletConnector = injected({
  target() {
    if (typeof window === 'undefined') return undefined;
    const provider = getTrustWalletProvider();
    if (!provider) return undefined;
    return { id: 'trustWallet', name: 'Trust Wallet', provider } as {
      id: string;
      name: string;
      provider: import('viem').EIP1193Provider;
    };
  },
  unstable_shimAsyncInject: 3_500,
});

export const fallbackConfig = createConfig({
  connectors: [injected(), trustWalletConnector, metaMask({ enableAnalytics: false })],
  chains: [
    wagmiLocalhost,
    wagmiMainnet,
    wagmiPolygon,
    wagmiPolygonAmoy,
    wagmiOptimism,
    wagmiArbitrum,
    wagmiBase,
    wagmiSepolia,
  ],
  transports: {
    [wagmiLocalhost.id]: http(process.env.NEXT_PUBLIC_LOCALHOST_RPC || 'http://127.0.0.1:8545'),
    [wagmiMainnet.id]: http('https://ethereum-rpc.publicnode.com'),
    [wagmiPolygon.id]: http('https://polygon-bor-rpc.publicnode.com'),
    [wagmiPolygonAmoy.id]: fallback([
      http('https://polygon-amoy-bor-rpc.publicnode.com'),
      http('https://polygon-amoy.drpc.org'),
    ]),
    [wagmiOptimism.id]: http('https://optimism-rpc.publicnode.com'),
    [wagmiArbitrum.id]: http('https://arbitrum-one-rpc.publicnode.com'),
    [wagmiBase.id]: http('https://base-rpc.publicnode.com'),
    [wagmiSepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
  },
  ssr: true,
});

// ─── AppKit adapter factory ───────────────────────────────────────────────────

export type AppKitConfigResult = { adapter: WagmiAdapter; config: Config };

type WagmiAdapterConfig = ConstructorParameters<typeof WagmiAdapter>[0];

// Explicit public RPC transports — same as fallbackConfig so useReadContract works correctly.
const appkitTransports = {
  [appkitLocalhost.id]: http(process.env.NEXT_PUBLIC_LOCALHOST_RPC || 'http://127.0.0.1:8545'),
  [mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
  [polygon.id]: http('https://polygon-bor-rpc.publicnode.com'),
  [polygonAmoy.id]: fallback([
    http('https://polygon-amoy-bor-rpc.publicnode.com'),
    http('https://polygon-amoy.drpc.org'),
  ]),
  [optimism.id]: http('https://optimism-rpc.publicnode.com'),
  [arbitrum.id]: http('https://arbitrum-one-rpc.publicnode.com'),
  [base.id]: http('https://base-rpc.publicnode.com'),
  [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
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
      injected({
        target() {
          if (typeof window === 'undefined') return undefined;
          const provider = getTrustWalletProvider();
          if (!provider) return undefined;
          return { id: 'trustWallet', name: 'Trust Wallet', provider } as {
            id: string;
            name: string;
            provider: import('viem').EIP1193Provider;
          };
        },
        unstable_shimAsyncInject: 3_500,
      }),
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
