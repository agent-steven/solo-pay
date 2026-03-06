import { useCallback } from 'react';
import { useAccount, useDisconnect } from 'wagmi';

export interface WalletState {
  /** Connected wallet address */
  address: `0x${string}` | undefined;
  /** Whether a wallet is connected */
  isConnected: boolean;
  /** Current chain info */
  chain: { id: number; name: string } | undefined;
}

export interface WalletActions {
  /** Disconnect current wallet */
  disconnect: () => void;
}

export interface UseWalletReturn extends WalletState, WalletActions {}

export function useWallet(): UseWalletReturn {
  const { address, isConnected, chain } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  return {
    address,
    isConnected,
    chain: chain ? { id: chain.id, name: chain.name } : undefined,
    disconnect,
  };
}
