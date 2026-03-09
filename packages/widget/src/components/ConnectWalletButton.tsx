'use client';

import { useCallback, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useLocale } from '../context/LocaleContext';
import { APPKIT_WALLET_IDS } from '../appkit-config';

const WALLET_BUTTON_BASE =
  'w-full rounded-xl px-6 py-3 sm:py-4 text-sm sm:text-lg font-semibold text-white shadow-sm disabled:opacity-50 transition-colors';

const WALLET_STYLES = {
  metaMask: 'bg-[#BA5700] hover:bg-[#A34D00] active:bg-[#8C4200]',
  trustWallet: 'bg-[#3375BB] hover:bg-[#2a5f99] active:bg-[#1e4a7a]',
} as const;

/**
 * Connect step: MetaMask + Trust Wallet buttons.
 * Uses EIP-6963 injected connectors when the extension is installed.
 * Falls back to WalletConnect QR when extension is not detected.
 * No MetaMask SDK -- only injected providers + WalletConnect.
 */
export function ConnectWalletButton({
  className,
  onConnectorClick,
}: {
  className?: string;
  onConnectorClick?: () => void;
}) {
  const { t } = useLocale();
  const { open } = useAppKit();
  const { isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();

  // EIP-6963 connectors (RDNS-based IDs). No MetaMask SDK.
  const metaMaskConnector = useMemo(
    () =>
      connectors.find((c) => c.id === 'io.metamask') ??
      connectors.find((c) => c.id === 'io.metamask.flask'),
    [connectors],
  );
  const trustWalletConnector = useMemo(
    () =>
      connectors.find((c) => c.id === 'com.trustwallet.app') ??
      connectors.find((c) => c.id === 'trustWallet'),
    [connectors],
  );

  const connectWith = useCallback(
    async (connector: NonNullable<typeof metaMaskConnector>) => {
      onConnectorClick?.();
      if (isConnected) {
        try {
          await disconnectAsync();
        } catch {
          // ignore
        }
      }
      try {
        await connectAsync({ connector });
      } catch (err) {
        console.warn('Wallet connection failed:', err);
      }
    },
    [onConnectorClick, isConnected, disconnectAsync, connectAsync],
  );

  const openWalletConnect = useCallback(
    (walletId: string, walletName: string) => {
      onConnectorClick?.();
      (open as (opts: Record<string, unknown>) => void)({
        view: 'ConnectingWalletConnect',
        data: { wallet: { id: walletId, name: walletName } },
      });
    },
    [onConnectorClick, open],
  );

  const handleMetaMask = useCallback(() => {
    if (metaMaskConnector) {
      connectWith(metaMaskConnector);
    } else {
      openWalletConnect(APPKIT_WALLET_IDS[0], 'MetaMask');
    }
  }, [metaMaskConnector, connectWith, openWalletConnect]);

  const handleTrustWallet = useCallback(() => {
    if (trustWalletConnector) {
      connectWith(trustWalletConnector);
    } else {
      openWalletConnect(APPKIT_WALLET_IDS[1], 'Trust Wallet');
    }
  }, [trustWalletConnector, connectWith, openWalletConnect]);

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      {/* Wallet Icon */}
      <div className="flex justify-center mb-8 sm:mb-10">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50 flex items-center justify-center">
          <svg
            className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
            />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-5">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">{t('connect.title')}</h1>
      </div>

      {/* Description */}
      <div className="text-center mb-10 sm:mb-12">
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
          {t('connect.description')
            .split('\n')
            .map((line, i) => (
              <span key={i}>
                {line}
                {i === 0 && <br />}
              </span>
            ))}
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <button
          type="button"
          onClick={handleMetaMask}
          disabled={isPending}
          className={`${WALLET_BUTTON_BASE} ${WALLET_STYLES.metaMask}`}
        >
          {t('connect.metaMask')}
        </button>

        <button
          type="button"
          onClick={handleTrustWallet}
          disabled={isPending}
          className={`${WALLET_BUTTON_BASE} ${WALLET_STYLES.trustWallet}`}
        >
          {t('connect.trustWallet')}
        </button>
      </div>
    </div>
  );
}
