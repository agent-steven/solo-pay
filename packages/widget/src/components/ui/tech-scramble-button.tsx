import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#';

export function TechScrambleButton({
  text,
  onClick,
  containerClassName = '',
  buttonClassName = 'bg-zinc-900 hover:bg-gradient-to-r hover:from-zinc-900 hover:to-zinc-800 text-white',
  gradientClassName = 'via-white/50',
  delay = 0.2,
  iconSrc,
  iconAlt,
  disabled = false,
}: {
  text: string;
  onClick: () => void;
  containerClassName?: string;
  buttonClassName?: string;
  gradientClassName?: string;
  delay?: number;
  iconSrc?: string;
  iconAlt?: string;
  disabled?: boolean;
}) {
  const [displayText, setDisplayText] = useState(text);
  const [isScrambling, setIsScrambling] = useState(false);

  const triggerScramble = () => {
    if (isScrambling) return;
    setIsScrambling(true);
    let frame = 0;
    const totalFrames = 25;
    const length = text.length;

    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;

      if (frame >= totalFrames) {
        clearInterval(interval);
        setDisplayText(text);
        setIsScrambling(false);
        return;
      }

      let result = '';
      for (let i = 0; i < length; i++) {
        if (text[i] === ' ') {
          result += ' ';
        } else if (Math.random() < progress) {
          result += text[i];
        } else {
          result += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      setDisplayText(result);
    }, 16);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      triggerScramble();
    }, delay * 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className={`relative p-[1px] tech-cut-btn group overflow-hidden ${containerClassName}`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-r from-transparent ${gradientClassName} to-transparent group-hover:animate-border-spin pointer-events-none rounded-none`}
        style={{ backgroundSize: '200% 200%' }}
      ></div>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full transition-colors py-4 font-bold tracking-widest tech-cut-btn relative z-10 uppercase flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName} ${isScrambling ? 'opacity-70 text-[var(--color-brand-gray)]' : 'opacity-100'}`}
      >
        {iconSrc && !isScrambling && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconSrc}
            alt={iconAlt || text}
            width={20}
            height={20}
            className="object-contain"
          />
        )}
        <span>{displayText}</span>
      </button>
    </motion.div>
  );
}
