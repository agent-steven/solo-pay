'use client';

import { useCallback, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useLocale } from '../context/LocaleContext';

/** Shared base styles for wallet connect buttons. */
export const WALLET_BUTTON_BASE =
  'w-full rounded-xl px-6 py-3 sm:py-4 text-sm sm:text-lg font-semibold text-white shadow-sm disabled:opacity-50 transition-colors';

export const WALLET_STYLES = {
  metaMask: 'bg-[#F6851B] hover:bg-[#e2761b] active:bg-[#cd6116]',
  trustWallet: 'bg-[#3375BB] hover:bg-[#2a5f99] active:bg-[#1e4a7a]',
} as const;

/**
 * Connect step: MetaMask + Trust Wallet buttons.
 * Both use wagmi connectors (backed by AppKit WagmiAdapter / WalletConnect).
 * onConnectorClick: called when user clicks a button (e.g. to clear "change wallet" intent).
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
  const { connect, connectors, isPending, variables: connectVars } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const metaMaskConnector = useMemo(
    () => connectors.find((c) => c.id === 'metaMaskSDK' || c.id === 'metaMask'),
    [connectors]
  );
  const trustWalletConnector = useMemo(
    () => connectors.find((c) => c.id === 'trustWallet'),
    [connectors]
  );

  const pendingConnectorId = (connectVars?.connector as { id?: string } | undefined)?.id;
  const isMetaMaskPending =
    isPending && (pendingConnectorId === 'metaMask' || pendingConnectorId === 'metaMaskSDK');
  const isTrustPending = isPending && pendingConnectorId === 'trustWallet';

  const connectWith = useCallback(
    async (connector: NonNullable<typeof metaMaskConnector>) => {
      onConnectorClick?.();
      if (!isConnected) {
        try {
          await disconnectAsync({ connector });
        } catch {
          // already disconnected
        }
      }
      connect({ connector });
    },
    [onConnectorClick, isConnected, disconnectAsync, connect]
  );

  const handleMetaMask = useCallback(() => {
    if (metaMaskConnector) {
      connectWith(metaMaskConnector);
    } else {
      onConnectorClick?.();
      open({ view: 'Connect' });
    }
  }, [metaMaskConnector, connectWith, onConnectorClick, open]);

  const handleTrustWallet = useCallback(() => {
    if (trustWalletConnector) {
      connectWith(trustWalletConnector);
    } else {
      onConnectorClick?.();
      open({ view: 'Connect' });
    }
  }, [trustWalletConnector, connectWith, onConnectorClick, open]);

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
          {isMetaMaskPending ? t('connect.connecting') : t('connect.metaMask')}
        </button>

        <button
          type="button"
          onClick={handleTrustWallet}
          disabled={isPending}
          className={`${WALLET_BUTTON_BASE} ${WALLET_STYLES.trustWallet}`}
        >
          {isTrustPending ? t('connect.connecting') : t('connect.trustWallet')}
        </button>
      </div>
    </div>
  );
}
