import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { TechScrambleButton } from '../ui/tech-scramble-button';
import { InnerShockwave, SquarePixelDebris, TwinkleParticles } from '../ui/processing-card';

interface PaymentCompleteProps {
  amount: string;
  token: string;
  date: string;
  txHash: string;
  onConfirm?: () => void;
}

export default function PaymentComplete({
  amount,
  token,
  date,
  txHash,
  onConfirm,
}: PaymentCompleteProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const handleCopyTxHash = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(txHash);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = txHash;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center relative"
    >
      {/* Shockwave & particle effects */}
      <div className="absolute inset-[-50px] pointer-events-none z-[-1] flex items-center justify-center mix-blend-normal">
        <InnerShockwave />
        <SquarePixelDebris count={30} radius={180} duration={0.6} className="z-0" />
      </div>

      <div className="relative flex items-center justify-center mb-6">
        <TwinkleParticles count={30} radius={80} />
        <div className="relative z-10 w-16 h-16 bg-[var(--color-brand-success)]/10 text-[var(--color-brand-success)] rounded-full flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(34,197,94,0.3)]">
          &#10003;
        </div>
      </div>

      <h2 className="relative z-10 text-2xl md:text-3xl bg-clip-text text-transparent bg-gradient-to-b from-[var(--color-brand-success)] to-green-900 text-center font-extrabold antialiased mb-2 tracking-tight">
        {t('complete.title')}
      </h2>
      <p className="relative z-10 text-center text-sm text-[var(--color-brand-gray)] mb-4 sm:mb-6">
        {t('complete.description')}
      </p>

      {/* Details Card */}
      <div className="relative z-10 w-full bg-zinc-800 p-4 rounded-none mb-4 sm:mb-5 border border-zinc-600/70 text-sm space-y-4 shadow-xl">
        {date && (
          <div className="flex justify-between">
            <span className="text-[var(--color-brand-gray)]">{t('complete.date')}</span>
            <span className="font-mono">{date}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--color-brand-gray)]">{t('complete.amount')}</span>
          <span className="font-mono font-bold">
            {amount} {token}
          </span>
        </div>
        <div className="border-t border-zinc-700 pt-4">
          <div className="text-[var(--color-brand-gray)] mb-2">{t('complete.transactionHash')}</div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-mono break-all text-zinc-300">{txHash}</span>
            <button
              type="button"
              className="text-[var(--color-brand-gray)] hover:text-white transition-colors ml-2"
              aria-label={t('common.copyTxHash')}
              onClick={handleCopyTxHash}
            >
              {copied ? (
                <span className="text-[var(--color-brand-success)] text-xs">&#10003;</span>
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <div className="relative z-10 w-full">
        <TechScrambleButton
          text={t('complete.returnToMerchant').toUpperCase()}
          onClick={() => onConfirm?.()}
          delay={0.2}
          containerClassName="w-full mt-2 shadow-xl"
        />
      </div>
    </motion.div>
  );
}
