import { motion } from 'framer-motion';
import { Unlink } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { TechScrambleButton } from '../ui/tech-scramble-button';
import { DotFlowLoader } from '../ui/processing-card';

interface TokenApprovalProps {
  walletAddress: string;
  balance: string;
  token: string;
  onApprove?: () => void;
  onGetGas?: () => void;
  onDisconnect?: () => void;
  onCancel?: () => void;
  isApproving?: boolean;
  error?: string;
  isRequestingGas?: boolean;
  gasRequestError?: string | null;
  gasReceived?: boolean;
  isLoading?: boolean;
}

export default function TokenApproval({
  walletAddress,
  balance,
  token,
  onApprove,
  onGetGas,
  onDisconnect,
  onCancel,
  isApproving = false,
  error,
  isRequestingGas = false,
  gasRequestError = null,
  gasReceived = false,
  isLoading = false,
}: TokenApprovalProps) {
  const { t } = useLocale();
  const hasBalance = balance !== '' && balance !== '0' && parseFloat(balance) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col items-center"
    >
      <h2 className="relative z-10 text-2xl md:text-3xl bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 text-center font-extrabold antialiased mb-2 tracking-tight">
        {t('approval.title')}
      </h2>
      <p className="text-center text-sm text-[var(--color-brand-gray)] mb-4 sm:mb-8">
        {t('approval.description')}
      </p>

      {/* Wallet Info Card */}
      <div className="w-full bg-zinc-800 p-4 rounded-none mb-4 sm:mb-6 border border-zinc-600/70 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-mono text-[var(--color-brand-gray)]">
            {t('approval.connectedWallet').toUpperCase()}
          </span>
          {onDisconnect && (
            <button
              type="button"
              onClick={onDisconnect}
              className="flex items-center gap-1.5 text-xs bg-zinc-700 px-3 py-1 rounded-none hover:bg-zinc-600 transition-colors"
            >
              <Unlink className="w-3 h-3" />
              <span>{t('common.disconnect')}</span>
            </button>
          )}
        </div>
        <div className="font-mono text-lg mb-4">{walletAddress}</div>
        <div className="flex justify-between items-center border-t border-zinc-700 pt-4">
          <span className="text-sm text-[var(--color-brand-gray)]">{t('approval.balance')}</span>
          <span className="font-mono font-bold">
            {isLoading ? (
              <span className="inline-block w-20 h-4 bg-zinc-700 rounded animate-pulse" />
            ) : (
              `${balance} ${token}`
            )}
          </span>
        </div>
      </div>

      {/* GET GAS Section */}
      {onGetGas && (
        <div
          className={`w-full rounded-none border p-4 mb-4 sm:mb-6 ${gasReceived ? 'bg-zinc-800/50 border-[var(--color-brand-success)]/30' : 'bg-zinc-800/50 border-zinc-600/50'}`}
        >
          {gasReceived ? (
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--color-brand-success)]/10 flex items-center justify-center">
                <span className="text-[var(--color-brand-success)] text-sm">&#10003;</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-brand-success)]">
                  {t('approval.gasReceived')}
                </p>
                <p className="text-xs text-[var(--color-brand-gray)] mt-0.5">
                  {t('approval.gasReceivedDescription')}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--color-brand-gray)] leading-relaxed mb-3">
                {t('approval.getGasInfo')}
              </p>
              <button
                type="button"
                className="w-full py-2 rounded-none bg-zinc-700 border border-zinc-600 text-xs font-semibold text-white hover:bg-zinc-600 transition-colors disabled:opacity-60"
                onClick={onGetGas}
                disabled={isRequestingGas}
              >
                {isRequestingGas ? t('approval.requestingGas') : t('approval.getGas')}
              </button>
              {gasRequestError && (
                <p className="mt-2 text-xs text-[var(--color-brand-error)]">{gasRequestError}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="w-full mb-4 p-3 rounded-none bg-[var(--color-brand-error)]/10 border border-[var(--color-brand-error)]/30">
          <p className="text-xs text-[var(--color-brand-error)]">{error}</p>
        </div>
      )}

      {/* Approve Button */}
      {(isLoading || hasBalance) &&
        (isApproving ? (
          <div className="relative p-[1px] tech-cut-btn group overflow-hidden w-full mt-2">
            <button
              disabled
              className="w-full transition-colors py-4 font-bold tracking-widest tech-cut-btn relative z-10 uppercase bg-zinc-900 text-zinc-400 flex items-center justify-center gap-3 opacity-80"
            >
              <DotFlowLoader status="active" />
              {t('approval.approving').toUpperCase()}
            </button>
          </div>
        ) : (
          <TechScrambleButton
            text={
              error ? t('common.tryAgain').toUpperCase() : t('approval.approveToken').toUpperCase()
            }
            onClick={() => onApprove?.()}
            delay={0.2}
            containerClassName="w-full mt-2"
            disabled={isLoading}
          />
        ))}

      {/* Cancel */}
      {!isLoading && !hasBalance && onCancel && (
        <TechScrambleButton
          text={t('approval.cancelPayment').toUpperCase()}
          onClick={onCancel}
          delay={0.3}
          containerClassName="w-full mt-3"
          gradientClassName="via-red-500/60"
          buttonClassName="bg-zinc-950 hover:bg-gradient-to-r hover:from-zinc-950 hover:to-red-950/40 text-red-500 hover:text-red-400"
        />
      )}
    </motion.div>
  );
}
