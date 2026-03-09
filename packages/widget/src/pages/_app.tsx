import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect, useRef, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { mainnet } from '@reown/appkit/networks';
import { createAppKitConfig, appkitNetworks, getWcProjectId } from '../appkit-wagmi';
import { getMetadata, APPKIT_WALLET_IDS } from '../appkit-config';

import type { createAppKit as CreateAppKitFn } from '@reown/appkit/react';
type CreateAppKitOptions = Parameters<typeof CreateAppKitFn>[0];

const projectId = getWcProjectId();

function MyApp({ Component, pageProps }: AppProps) {
  const [client] = useState(() => new QueryClient());
  const appKitInitialized = useRef(false);

  const { config, adapter } = useMemo(() => {
    const result = createAppKitConfig(projectId);
    return { config: result.config, adapter: result.adapter };
  }, []);

  useEffect(() => {
    if (!projectId || appKitInitialized.current) return;
    appKitInitialized.current = true;
    import('@reown/appkit/react').then(({ createAppKit }) => {
      const meta = getMetadata();
      createAppKit({
        adapters: [adapter],
        projectId,
        networks: appkitNetworks,
        defaultNetwork: mainnet,
        metadata: {
          name: meta.name,
          description: meta.description,
          url: meta.url,
          icons: meta.icons,
        },
        featuredWalletIds: [...APPKIT_WALLET_IDS],
        includeWalletIds: [...APPKIT_WALLET_IDS],
        allWallets: 'HIDE',
        enableCoinbase: false,
        features: {
          analytics: false,
          swaps: false,
          onramp: false,
          socials: false,
          connectMethodsOrder: ['wallet'],
        },
        themeMode: 'light',
        themeVariables: {
          '--apkt-accent': '#2563eb',
          '--apkt-border-radius-master': '12px',
        },
      } as unknown as CreateAppKitOptions);
    });
  }, [adapter]);

  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={client}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default MyApp;
