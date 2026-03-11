import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useLocale } from '../../context/LocaleContext';
import { type PaymentProgressState } from '../../hooks/useGaslessPayment';
import { LetterGlitch, AsciiProgressBar, DotFlowLoader } from '../ui/processing-card';
import { TechScrambleButton } from '../ui/tech-scramble-button';

type StepStatus = 'waiting' | 'processing' | 'completed';

const PROGRESS_KEYS: Record<
  PaymentProgressState,
  | 'progress.SIGNING_PERMIT'
  | 'progress.SIGNING_FORWARD'
  | 'progress.RELAYING'
  | 'progress.CONFIRMING'
  | 'progress.PAID'
  | 'progress.ERROR'
> = {
  INIT: 'progress.SIGNING_PERMIT',
  CHECKING_ALLOWANCE: 'progress.SIGNING_PERMIT',
  SIGNING_PERMIT: 'progress.SIGNING_PERMIT',
  SIGNING_FORWARD: 'progress.SIGNING_FORWARD',
  RELAYING: 'progress.RELAYING',
  CONFIRMING: 'progress.CONFIRMING',
  PAID: 'progress.PAID',
  ERROR: 'progress.ERROR',
};

interface PaymentProcessingProps {
  amount: string;
  token: string;
  progressState?: PaymentProgressState;
  onRetry?: () => void;
  onCancel?: () => void;
  error?: string;
}

function getProgressPercentage(state: PaymentProgressState, hasError: boolean): number {
  if (hasError) return 100;
  switch (state) {
    case 'INIT':
    case 'CHECKING_ALLOWANCE':
    case 'SIGNING_PERMIT':
    case 'SIGNING_FORWARD':
      return 33;
    case 'RELAYING':
      return 66;
    case 'CONFIRMING':
      return 80;
    case 'PAID':
      return 100;
    case 'ERROR':
      return 100;
    default:
      return 33;
  }
}

function getStepStatus(
  state: PaymentProgressState,
  targetStates: PaymentProgressState[],
  pastStates: PaymentProgressState[],
  error?: string
): StepStatus {
  if (error || state === 'ERROR') return 'completed';
  if (targetStates.includes(state)) return 'processing';
  if (pastStates.includes(state)) return 'completed';
  return 'waiting';
}

export default function PaymentProcessing({
  amount,
  token,
  progressState = 'INIT',
  onRetry,
  onCancel,
  error,
}: PaymentProcessingProps) {
  const { t } = useLocale();
  const paymentStatusRef = useRef<HTMLDivElement>(null);

  const signingStatus = getStepStatus(
    progressState,
    ['INIT', 'CHECKING_ALLOWANCE', 'SIGNING_PERMIT', 'SIGNING_FORWARD'],
    ['RELAYING', 'CONFIRMING', 'PAID'],
    error
  );
  const relayingStatus = getStepStatus(progressState, ['RELAYING'], ['CONFIRMING', 'PAID'], error);
  const confirmingStatus = getStepStatus(progressState, ['CONFIRMING'], ['PAID'], error);

  const percentage = getProgressPercentage(progressState, !!error);
  const isSuccess = progressState === 'PAID' && !error;

  // Animate status rows
  const stepIndex =
    signingStatus === 'processing'
      ? 0
      : relayingStatus === 'processing'
        ? 1
        : confirmingStatus === 'processing'
          ? 2
          : isSuccess
            ? 2
            : 0;

  useGSAP(
    () => {
      if (!paymentStatusRef.current) return;
      const rows = paymentStatusRef.current.querySelectorAll('.status-row');
      rows.forEach((row, index) => {
        if (index <= stepIndex) {
          if (index === stepIndex) {
            gsap.fromTo(
              row,
              { y: 10, opacity: 0, filter: 'blur(10px)' },
              { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power2.out' }
            );
          } else {
            gsap.set(row, { y: 0, opacity: 1, filter: 'blur(0px)' });
          }
        } else {
          gsap.set(row, { y: 0, opacity: 0.3, filter: 'blur(0px)' });
        }
      });
    },
    { dependencies: [stepIndex], scope: paymentStatusRef }
  );

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center animate-shake"
      >
        <div className="w-16 h-16 bg-[var(--color-brand-error)]/10 text-[var(--color-brand-error)] rounded-full flex items-center justify-center mb-6 text-3xl">
          &#10005;
        </div>
        <h2 className="relative z-10 text-2xl md:text-3xl bg-clip-text text-transparent bg-gradient-to-b from-[var(--color-brand-error)] to-red-950 text-center font-extrabold antialiased mb-2 tracking-tight">
          {t('error.transactionFailed')}
        </h2>
        <p className="text-center text-sm text-[var(--color-brand-gray)] mb-4 sm:mb-8">{error}</p>
        <div className="w-full space-y-3">
          {onRetry && (
            <TechScrambleButton
              text={t('common.tryAgain').toUpperCase()}
              onClick={onRetry}
              delay={0.2}
              containerClassName="w-full"
              gradientClassName="via-red-500/60"
              buttonClassName="bg-zinc-950 hover:bg-gradient-to-r hover:from-zinc-950 hover:to-red-950/40 text-red-500 hover:text-red-400"
            />
          )}
          {onCancel && (
            <TechScrambleButton
              text={t('common.cancel').toUpperCase()}
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col items-center"
    >
      <h2 className="relative z-10 text-2xl md:text-3xl bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 text-center font-extrabold antialiased mb-2 tracking-tight">
        {t('processing.title')}
      </h2>
      <p className="text-center text-sm text-[var(--color-brand-gray)] mb-4 sm:mb-8">
        {t('processing.pleaseWait')}
      </p>

      <div
        ref={paymentStatusRef}
        className="w-full relative rounded-none border border-zinc-700/50 bg-white/[0.02] overflow-hidden mb-4 sm:mb-8 flex flex-col shadow-2xl"
      >
        {/* ASCII glitch backdrop */}
        <div className="absolute inset-0 opacity-[0.07] z-0 mix-blend-screen pointer-events-none">
          <LetterGlitch glitchSpeed={60} characters="10!<>-_/[]" />
        </div>
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,255,255,0.03), transparent 80%)',
          }}
        />

        <div className="relative z-10 flex flex-col w-full">
          {/* Amount */}
          <div className="p-5 flex flex-col items-center justify-center border-b border-dashed border-zinc-700/50">
            <div className="text-[10px] font-mono text-[var(--color-brand-gray)] mb-3 uppercase tracking-[0.2em] opacity-80">
              {t('processing.paymentAmount')}
            </div>
            <div className="flex items-center gap-4 w-full justify-center">
              <span className="text-zinc-600 font-mono opacity-50">-</span>
              <span className="font-mono text-xl font-bold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                {amount} {token}
              </span>
              <span className="text-zinc-600 font-mono opacity-50">+</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="p-4 flex items-center justify-center border-b border-dashed border-zinc-700/50">
            <AsciiProgressBar progress={percentage} isSuccess={isSuccess} />
          </div>

          {/* Status List */}
          <div className="p-5 space-y-4">
            <div
              className={`status-row flex items-center gap-3 text-xs font-mono tracking-tight ${signingStatus === 'completed' ? 'text-[var(--color-brand-success)]' : signingStatus === 'processing' ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-zinc-500'}`}
            >
              <DotFlowLoader
                status={
                  signingStatus === 'completed'
                    ? 'success'
                    : signingStatus === 'processing'
                      ? 'active'
                      : 'waiting'
                }
              />
              <span>[SYS] {t('step.signing')}...</span>
            </div>
            <div
              className={`status-row flex items-center gap-3 text-xs font-mono tracking-tight ${relayingStatus === 'completed' ? 'text-[var(--color-brand-success)]' : relayingStatus === 'processing' ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-zinc-500'}`}
            >
              <DotFlowLoader
                status={
                  relayingStatus === 'completed'
                    ? 'success'
                    : relayingStatus === 'processing'
                      ? 'active'
                      : 'waiting'
                }
              />
              <span>[SYS] {t('step.relaying')}...</span>
            </div>
            <div
              className={`status-row flex items-center gap-3 text-xs font-mono tracking-tight ${confirmingStatus === 'completed' ? 'text-[var(--color-brand-success)]' : confirmingStatus === 'processing' ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-zinc-500'}`}
            >
              <DotFlowLoader
                status={
                  confirmingStatus === 'completed'
                    ? 'success'
                    : confirmingStatus === 'processing'
                      ? 'active'
                      : 'waiting'
                }
              />
              <span>[SYS] {t('step.confirming')}...</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
