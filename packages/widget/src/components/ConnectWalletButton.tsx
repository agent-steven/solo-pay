'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useAppKit, useAppKitState } from '@reown/appkit/react';
import { useLocale } from '../context/LocaleContext';
import { APPKIT_WALLET_IDS } from '../appkit-config';
import { CpuArchitecture } from './ui/cpu-architecture';
import { TechScrambleButton } from './ui/tech-scramble-button';
import { WalletProcessingCard } from './ui/processing-card';
import { motion, AnimatePresence } from 'framer-motion';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }, []);
  return isMobile;
}

export function ConnectWalletButton({
  className,
  onConnectorClick,
}: {
  className?: string;
  onConnectorClick?: () => void;
}) {
  const { t } = useLocale();
  const { open } = useAppKit();
  const { open: isModalOpen } = useAppKitState();
  const { isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const isMobile = useIsMobile();

  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [connectingStatus, setConnectingStatus] = useState<
    'idle' | 'connecting' | 'succeeded' | 'failed'
  >('idle');

  const metaMaskConnector = useMemo(
    () =>
      connectors.find((c) => c.id === 'io.metamask') ??
      connectors.find((c) => c.id === 'io.metamask.flask'),
    [connectors]
  );
  const trustWalletConnector = useMemo(
    () =>
      connectors.find((c) => c.id === 'com.trustwallet.app') ??
      connectors.find((c) => c.id === 'trustWallet'),
    [connectors]
  );

  const connectWith = useCallback(
    async (connector: NonNullable<typeof metaMaskConnector>) => {
      onConnectorClick?.();
      if (isConnected) {
        try {
          await disconnectAsync();
        } catch {
          /* ignore */
        }
      }
      try {
        await connectAsync({ connector });
      } catch (err) {
        console.warn('Wallet connection failed:', err);
        setConnectingStatus('failed');
      }
    },
    [onConnectorClick, isConnected, disconnectAsync, connectAsync]
  );

  const openWalletConnect = useCallback(
    (walletId: string, walletName: string) => {
      onConnectorClick?.();
      (open as (opts: Record<string, unknown>) => void)({
        view: 'ConnectingWalletConnect',
        data: { wallet: { id: walletId, name: walletName } },
      });
    },
    [onConnectorClick, open]
  );

  const handleWalletSelect = useCallback(
    (walletName: string) => {
      setSelectedWallet(walletName);
      setConnectingStatus('connecting');
      if (walletName === 'MetaMask') {
        metaMaskConnector
          ? connectWith(metaMaskConnector)
          : openWalletConnect(APPKIT_WALLET_IDS[0], 'MetaMask');
      } else {
        trustWalletConnector
          ? connectWith(trustWalletConnector)
          : openWalletConnect(APPKIT_WALLET_IDS[1], 'Trust Wallet');
      }
    },
    [metaMaskConnector, trustWalletConnector, connectWith, openWalletConnect]
  );

  const handleMobileConnect = useCallback(() => {
    onConnectorClick?.();
    setConnectingStatus('connecting');
    setSelectedWallet('Wallet');
    open();
  }, [onConnectorClick, open]);

  useEffect(() => {
    if (isConnected && connectingStatus === 'connecting') {
      setConnectingStatus('succeeded');
    }
  }, [isConnected, connectingStatus]);

  // Track whether the AppKit modal was actually opened during this connection attempt.
  // This prevents the reset effect from firing on desktop injected connector paths
  // where the modal is never opened (user approves directly in their extension).
  const wasModalOpenRef = useRef(false);
  useEffect(() => {
    if (isModalOpen) {
      wasModalOpenRef.current = true;
    }
    if (connectingStatus === 'idle') {
      wasModalOpenRef.current = false;
    }
  }, [isModalOpen, connectingStatus]);

  // Reset to idle when AppKit modal closes without a successful connection.
  // Only triggers when modal was actually opened and then closed (not for direct connector paths).
  // Uses a short delay to avoid resetting during mobile deep-link navigation
  // (modal closes immediately when browser navigates to wallet app).
  useEffect(() => {
    if (
      !isModalOpen &&
      wasModalOpenRef.current &&
      connectingStatus === 'connecting' &&
      !isConnected
    ) {
      const timer = setTimeout(() => {
        setConnectingStatus((prev) => {
          if (prev === 'connecting') {
            setSelectedWallet('');
            return 'idle';
          }
          return prev;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, connectingStatus, isConnected]);

  if (connectingStatus === 'idle') {
    return (
      <div className={['w-full', className].filter(Boolean).join(' ')}>
        <motion.div
          key="wallet-select"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col items-center"
        >
          <div className="w-full h-32 flex items-center justify-center mb-2 mt-[-1rem]">
            <CpuArchitecture text="SOLO PAY" />
          </div>
          <h2 className="relative z-10 text-2xl md:text-3xl bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 text-center font-extrabold antialiased mb-2 mt-2 tracking-tight">
            {t('connect.title')}
          </h2>
          <p className="text-center text-sm text-[var(--color-brand-gray)] mb-8">
            {t('connect.description')
              .split('\n')
              .map((line, i) => (
                <span key={i}>
                  {line}
                  {i === 0 && <br />}
                </span>
              ))}
          </p>
          <div className="space-y-3 w-full">
            {isMobile ? (
              <TechScrambleButton
                text={t('connect.connectWallet').toUpperCase()}
                onClick={handleMobileConnect}
                delay={0.2}
                disabled={isPending}
              />
            ) : (
              <>
                <TechScrambleButton
                  text="METAMASK"
                  onClick={() => handleWalletSelect('MetaMask')}
                  delay={0.2}
                  iconSrc="/metamask.svg"
                  disabled={isPending}
                />
                <TechScrambleButton
                  text="TRUST WALLET"
                  onClick={() => handleWalletSelect('Trust Wallet')}
                  delay={0.3}
                  iconSrc="/trustwallet.svg"
                  disabled={isPending}
                />
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      <AnimatePresence mode="wait">
        <motion.div
          key="wallet-connecting"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col items-center w-full"
        >
          <h2 className="relative z-10 text-2xl md:text-3xl bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 text-center font-extrabold antialiased mb-2 tracking-tight">
            {t('connect.connecting').replace('...', '')} {selectedWallet}
          </h2>
          <p className="text-center text-sm text-[var(--color-brand-gray)] mb-4 sm:mb-8">
            {t('connect.description').split('\n')[0]}
          </p>
          <WalletProcessingCard
            walletName={selectedWallet}
            status={
              connectingStatus === 'succeeded'
                ? 'succeeded'
                : connectingStatus === 'failed'
                  ? 'failed'
                  : 'connecting'
            }
            progress={
              connectingStatus === 'succeeded' ? 100 : connectingStatus === 'failed' ? 100 : 50
            }
          />
          {connectingStatus === 'failed' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-3 mt-4"
            >
              <TechScrambleButton
                text={t('common.tryAgain').toUpperCase()}
                onClick={() => handleWalletSelect(selectedWallet)}
                delay={0}
                containerClassName="w-full"
              />
              <TechScrambleButton
                text={t('common.goBack').toUpperCase()}
                onClick={() => setConnectingStatus('idle')}
                delay={0.1}
                containerClassName="w-full"
                gradientClassName="via-white/20 group-hover:via-zinc-800"
                buttonClassName="bg-zinc-950 text-zinc-400 hover:text-white"
              />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
