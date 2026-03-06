import { useLocale } from '../../context/LocaleContext';
import { type PaymentProgressState } from '../../hooks/useGaslessPayment';

type StepStatus = 'waiting' | 'processing' | 'completed';

/** Maps PaymentProgressState to i18n progress.* keys (INIT/CHECKING_ALLOWANCE → SIGNING_PERMIT) */
const PROGRESS_KEYS: Record<
  PaymentProgressState,
  | 'progress.SIGNING_PERMIT'
  | 'progress.SIGNING_FORWARD'
  | 'progress.RELAYING'
  | 'progress.CONFIRMING'
  | 'progress.ESCROWED'
  | 'progress.ERROR'
> = {
  INIT: 'progress.SIGNING_PERMIT',
  CHECKING_ALLOWANCE: 'progress.SIGNING_PERMIT',
  SIGNING_PERMIT: 'progress.SIGNING_PERMIT',
  SIGNING_FORWARD: 'progress.SIGNING_FORWARD',
  RELAYING: 'progress.RELAYING',
  CONFIRMING: 'progress.CONFIRMING',
  ESCROWED: 'progress.ESCROWED',
  ERROR: 'progress.ERROR',
};

interface PaymentProcessingProps {
  amount: string;
  token: string;
  /** Current progress state from the payment hook */
  progressState?: PaymentProgressState;
  /** Retry payment after error */
  onRetry?: () => void;
  /** Cancel and redirect to failUrl */
  onCancel?: () => void;
  /** Error message from payment */
  error?: string;
}

function StepRow({
  label,
  status,
  isLast = false,
}: {
  label: string;
  status: StepStatus;
  isLast?: boolean;
}) {
  const isPending = status === 'processing' || status === 'completed';

  return (
    <div
      className={`relative flex items-start gap-4 transition-opacity duration-300 ${isPending ? 'opacity-100' : 'opacity-40'}`}
    >
      {!isLast && (
        <div
          className={`absolute left-3 top-7 bottom-[-8px] w-0.5 -translate-x-1/2 rounded-full ${
            status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
          } transition-colors duration-500`}
        />
      )}

      {/* Status Icon Indicator */}
      <div className="relative z-10 w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 bg-gray-50/80">
        {status === 'completed' ? (
          <div className="w-5 h-5 rounded-full bg-[#00C853] flex items-center justify-center shadow-sm">
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
        ) : status === 'processing' ? (
          <div className="relative flex items-center justify-center w-5 h-5">
            <div className="absolute w-full h-full rounded-full bg-blue-400 animate-ping opacity-20"></div>
            <div className="w-5 h-5 rounded-full border-[2.5px] border-blue-100 border-t-blue-500 animate-spin shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
          </div>
        ) : (
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
        )}
      </div>

      {/* Label Text */}
      <div className="flex-1 pb-5">
        <span
          className={`text-sm sm:text-base transition-colors duration-300 ${
            status === 'processing'
              ? 'text-blue-700 font-bold'
              : status === 'completed'
                ? 'text-[#00B04A] font-bold'
                : 'text-gray-500 font-medium'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
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

  // Helper to determine the percentage for the top progress bar (4 steps = 25% each)
  const getProgressPercentage = (state: PaymentProgressState, hasError: boolean): number => {
    if (hasError) return 100;

    switch (state) {
      // Step 1: Signing
      case 'INIT':
      case 'CHECKING_ALLOWANCE':
      case 'SIGNING_PERMIT':
      case 'SIGNING_FORWARD':
        return 25;

      // Step 2: Relaying
      case 'RELAYING':
        return 50;

      // Step 3: Confirming
      case 'CONFIRMING':
        return 75;

      // Step 4: Escrowed
      case 'ESCROWED':
        return 100;

      case 'ERROR':
        return 100;
      default:
        return 25;
    }
  };

  // Status computation for the 4 core payment steps
  const getStepStatus = (
    state: PaymentProgressState,
    targetStates: PaymentProgressState[],
    pastStates: PaymentProgressState[]
  ): StepStatus => {
    if (error || state === 'ERROR') return 'completed';
    if (targetStates.includes(state)) return 'processing';
    if (pastStates.includes(state)) return 'completed';
    return 'waiting';
  };

  const signingStatus = getStepStatus(
    progressState,
    ['INIT', 'CHECKING_ALLOWANCE', 'SIGNING_PERMIT', 'SIGNING_FORWARD'],
    ['RELAYING', 'CONFIRMING', 'ESCROWED']
  );

  const relayingStatus = getStepStatus(progressState, ['RELAYING'], ['CONFIRMING', 'ESCROWED']);

  const confirmingStatus = getStepStatus(progressState, ['CONFIRMING'], ['ESCROWED']);

  const escrowStatus = getStepStatus(progressState, [], ['ESCROWED']);

  const percentage = getProgressPercentage(progressState, !!error);

  const statusHintText = t(
    PROGRESS_KEYS[error || progressState === 'ERROR' ? 'ERROR' : progressState]
  );

  return (
    <div className="w-full p-4 sm:p-6">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">{t('processing.title')}</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">{t('processing.pleaseWait')}</p>
      </div>

      {error ? (
        <div className="bg-red-50 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
          <svg
            className="w-12 h-12 text-red-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-red-700 font-medium mb-6">{error}</div>
          <div className="flex gap-4">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-6 py-2 rounded-xl text-gray-600 font-medium bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-6 py-2 rounded-xl text-white font-medium bg-red-600 hover:bg-red-700 transition-colors"
              >
                {t('common.tryAgain')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* 1. Large Central Amount Display */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
                {amount}
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                {token}
              </span>
            </div>
          </div>

          {/* 2. Thicker Top Progress Bar */}
          <div className="w-full px-2 mb-4">
            <div className="w-full h-4 sm:h-5 bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden bg-linear-to-r ${
                  error ? 'from-red-500 to-red-600' : 'from-blue-500 to-indigo-600'
                }`}
                style={{ width: `${percentage}%` }}
              >
                {progressState !== 'ESCROWED' && !error && (
                  <div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                )}
              </div>
            </div>
          </div>

          {/* 3. Helper Hint Text */}
          <div className="text-center min-h-[28px] mb-6">
            <div
              className={`text-base font-bold transition-colors duration-300 ${
                error || progressState === 'ERROR' ? 'text-red-500' : 'text-blue-600 animate-pulse'
              }`}
            >
              {statusHintText}
            </div>
          </div>

          {/* 4. Vertical Granular Payment Steps (Inside a Card) */}
          <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm mx-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5">
              {t('processing.paymentStatus')}
            </h3>
            <div className="space-y-1">
              <StepRow label={t('step.signing')} status={signingStatus} />
              <StepRow label={t('step.relaying')} status={relayingStatus} />
              <StepRow label={t('step.confirming')} status={confirmingStatus} />
              <StepRow label={t('step.escrowed')} status={escrowStatus} isLast />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
