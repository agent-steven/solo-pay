import { DotFlowLoader } from '../ui/processing-card';

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <DotFlowLoader status="active" />
      {message && (
        <p className="text-sm text-[var(--color-brand-gray)] font-mono animate-pulse">{message}</p>
      )}
    </div>
  );
}
