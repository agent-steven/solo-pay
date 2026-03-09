/**
 * Single wagmi config source for the widget.
 * Uses AppKit (Reown/WalletConnect) adapter with injected + WalletConnect.
 * Requires NEXT_PUBLIC_WC_PROJECT_ID environment variable.
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
import { http, fallback } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { getMetadata } from './appkit-config';
import type { Config } from 'wagmi';

// ─── Shared helpers ──────────────────────────────────────────────────────────

export function getWcProjectId(): string {
  const id = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
  if (!id || id.length === 0) {
    throw new Error(
      'NEXT_PUBLIC_WC_PROJECT_ID is required. Get one at https://cloud.reown.com'
    );
  }
  return id;
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
    connectors: [injected()],
    metadata: {
      name: dynamicMetadata.name,
      description: dynamicMetadata.description,
      url: dynamicMetadata.url || 'https://solopay.example',
      icons: dynamicMetadata.icons,
    },
  } as WagmiAdapterConfig);
  return { adapter, config: adapter.wagmiConfig };
}
