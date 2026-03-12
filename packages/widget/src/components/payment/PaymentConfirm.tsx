import { motion } from 'framer-motion';
import { ArrowRightLeft } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { TechScrambleButton } from '../ui/tech-scramble-button';

interface PaymentConfirmProps {
  product: string;
  amount: string;
  token: string;
  network: string;
  walletAddress?: string;
  currency?: string;
  fiatAmount?: number;
  error?: string;
  onPay?: () => void;
  onChangeWallet?: () => void;
  onCancel?: () => void;
}

export default function PaymentConfirm({
  amount,
  token,
  network,
  walletAddress,
  currency,
  fiatAmount,
  error,
  onPay,
  onChangeWallet,
  onCancel,
}: PaymentConfirmProps) {
  const { t, locale } = useLocale();
  const numberLocale = locale === 'ko' ? 'ko-KR' : 'en-US';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col items-center"
    >
      <h2 className="relative z-10 text-2xl md:text-3xl bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 text-center font-extrabold antialiased mb-1 tracking-tight">
        {t('confirm.title')}
      </h2>
      <p className="text-center text-sm text-[var(--color-brand-gray)] mb-4">
        {t('confirm.reviewDetails')}
      </p>

      {/* Payment Details Card */}
      <div className="w-full bg-zinc-800 p-3 rounded-none mb-4 border border-zinc-600/70 shadow-sm">
        <div className="text-xs font-mono text-[var(--color-brand-gray)] mb-3">
          {t('confirm.paymentDetails').toUpperCase()}
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-brand-gray)]">{t('confirm.network')}</span>
            <span>{network}</span>
          </div>
          {walletAddress && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--color-brand-gray)]">{t('confirm.payingFrom')}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono">{walletAddress}</span>
                {onChangeWallet && (
                  <button
                    type="button"
                    onClick={onChangeWallet}
                    className="flex items-center gap-1.5 text-xs bg-zinc-700 px-3 py-1 rounded-none hover:bg-zinc-600 transition-colors text-white"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>{t('common.change')}</span>
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--color-brand-gray)]">{t('confirm.gasFee')}</span>
            <span className="text-[var(--color-brand-success)] font-bold">
              {t('confirm.gasFree')}
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="bg-zinc-900 p-2 rounded-none mt-3 flex flex-col items-end border border-zinc-600/70 shadow-inner">
          {currency && fiatAmount !== undefined && (
            <span className="text-xs text-[var(--color-brand-blue)]">
              {fiatAmount.toLocaleString(numberLocale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {currency}
            </span>
          )}
          <div className="flex justify-between w-full mt-1">
            <span className="font-bold text-[var(--color-brand-blue)]">{t('confirm.total')}</span>
            <span className="font-mono font-bold text-[var(--color-brand-blue)]">
              {amount} {token}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="w-full mb-4 p-3 rounded-none bg-[var(--color-brand-error)]/10 border border-[var(--color-brand-error)]/30">
          <p className="text-xs text-[var(--color-brand-error)]">{error}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="w-full space-y-3 mt-2">
        {!error && (
          <TechScrambleButton
            text={t('confirm.payNow').toUpperCase()}
            onClick={() => onPay?.()}
            delay={0.2}
            containerClassName="w-full"
          />
        )}
        {onCancel && (
          <TechScrambleButton
            text={t('confirm.cancelPayment').toUpperCase()}
            onClick={onCancel}
            delay={0.3}
            containerClassName="w-full"
            gradientClassName="via-white/20 group-hover:via-zinc-800"
            buttonClassName="bg-zinc-950 text-zinc-400 hover:text-white"
          />
        )}
      </div>
    </motion.div>
  );
}
