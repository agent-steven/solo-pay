import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/* ────────────── SquarePixelDebris ────────────── */
export const SquarePixelDebris: React.FC<{
  count?: number;
  radius?: number;
  className?: string;
  duration?: number;
}> = ({ count = 20, radius = 80, className, duration = 0.5 }) => {
  const particles = React.useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dist = radius * (0.6 + Math.random() * 0.4);
      const size = Math.random() > 0.6 ? 4 : 2;
      const color = Math.random() > 0.5 ? 'bg-white' : 'bg-[#22c55e]';
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size,
        color,
        delay: Math.random() * 0.1,
      };
    });
  }, [count, radius]);

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none flex items-center justify-center z-50',
        className
      )}
    >
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className={cn('absolute', p.color)}
          style={{ width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
          transition={{
            duration: duration,
            delay: p.delay,
            ease: [0.1, 0.9, 0.2, 1],
          }}
        />
      ))}
    </div>
  );
};

/* ────────────── TwinkleParticles ────────────── */
export const TwinkleParticles: React.FC<{
  count?: number;
  radius?: number;
  className?: string;
}> = ({ count = 15, radius = 40, className }) => {
  const particles = React.useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const moveDist = 10 + Math.random() * 10;
      const size = Math.random() > 0.6 ? 2 : Math.random() > 0.3 ? 3 : 1;
      const color = Math.random() > 0.4 ? 'bg-white' : 'bg-[#22c55e]';
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        moveX: Math.cos(angle) * moveDist,
        moveY: Math.sin(angle) * moveDist,
        size,
        color,
        delay: Math.random() * 2,
        duration: 1.5 + Math.random() * 1.5,
      };
    });
  }, [count, radius]);

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none flex items-center justify-center z-10',
        className
      )}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={cn('absolute', p.color)}
          style={{
            width: p.size,
            height: p.size,
            left: '50%',
            top: '50%',
            marginLeft: p.x - p.size / 2,
            marginTop: p.y - p.size / 2,
          }}
          initial={{ opacity: 0, x: 0, y: 0 }}
          animate={{ opacity: [0, 0.8, 0], x: p.moveX, y: p.moveY }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

/* ────────────── InnerShockwave ────────────── */
export const InnerShockwave: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
      <motion.div
        className="absolute rounded-full pointer-events-none mix-blend-screen"
        style={{
          background: 'radial-gradient(circle, rgba(34,197,94,0.4) 0%, rgba(34,197,94,0) 70%)',
        }}
        initial={{ width: '0px', height: '0px', opacity: 0.8 }}
        animate={{ width: '200%', height: '200%', opacity: 0 }}
        transition={{
          duration: 1.2,
          ease: 'easeOut',
        }}
      />
      <motion.div
        className="absolute inset-0 pointer-events-none mix-blend-screen"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(34,197,94,0.15) 0%, transparent 100%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      />
    </div>
  );
};

/* ────────────── LetterGlitch ────────────── */
export const LetterGlitch: React.FC<{
  glitchColors?: string[];
  glitchSpeed?: number;
  centerVignette?: boolean;
  outerVignette?: boolean;
  smooth?: boolean;
  characters?: string;
  className?: string;
}> = ({
  glitchColors = ['#ffffff', '#e5e5e5', '#a3a3a3', '#737373', '#404040'],
  glitchSpeed = 50,
  centerVignette = false,
  outerVignette = true,
  smooth = true,
  characters = '.,:;-*#',
  className = '',
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animationRef = React.useRef<number | null>(null);
  const letters = React.useRef<
    Array<{ char: string; color: string; targetColor: string; colorProgress: number }>
  >([]);
  const grid = React.useRef({ columns: 0, rows: 0 });
  const context = React.useRef<CanvasRenderingContext2D | null>(null);
  const lastGlitchTime = React.useRef(Date.now());

  const lettersAndSymbols = React.useMemo(() => Array.from(characters), [characters]);
  const fontSize = 11;
  const charWidth = 7;
  const charHeight = 14;

  const getRandomChar = React.useCallback(
    () => lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)],
    [lettersAndSymbols]
  );
  const getRandomColor = React.useCallback(
    () => glitchColors[Math.floor(Math.random() * glitchColors.length)],
    [glitchColors]
  );

  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const normalized = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : null;
  };

  const interpolateColor = (
    start: { r: number; g: number; b: number },
    end: { r: number; g: number; b: number },
    factor: number
  ) =>
    `rgb(${Math.round(start.r + (end.r - start.r) * factor)},${Math.round(
      start.g + (end.g - start.g) * factor
    )},${Math.round(start.b + (end.b - start.b) * factor)})`;

  const calculateGrid = (width: number, height: number) => ({
    columns: Math.ceil(width / charWidth),
    rows: Math.ceil(height / charHeight),
  });

  const initializeLetters = (columns: number, rows: number) => {
    grid.current = { columns, rows };
    const total = columns * rows;
    letters.current = Array.from({ length: total }, () => ({
      char: getRandomChar(),
      color: getRandomColor(),
      targetColor: getRandomColor(),
      colorProgress: 1,
    }));
  };

  const drawLetters = () => {
    if (!context.current || !canvasRef.current) return;
    const ctx = context.current;
    const { width, height } = canvasRef.current.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    letters.current.forEach((letter, index) => {
      const x = (index % grid.current.columns) * charWidth;
      const y = Math.floor(index / grid.current.columns) * charHeight;
      ctx.fillStyle = letter.color;
      ctx.fillText(letter.char, x, y);
    });
  };

  const updateLetters = () => {
    const updateCount = Math.max(1, Math.floor(letters.current.length * 0.05));
    for (let i = 0; i < updateCount; i++) {
      const idx = Math.floor(Math.random() * letters.current.length);
      const item = letters.current[idx];
      item.char = getRandomChar();
      item.targetColor = getRandomColor();
      if (!smooth) {
        item.color = item.targetColor;
        item.colorProgress = 1;
      } else {
        item.colorProgress = 0;
      }
    }
  };

  const handleSmoothTransitions = () => {
    let needsRedraw = false;
    letters.current.forEach((letter) => {
      if (letter.colorProgress < 1) {
        const startRgb = hexToRgb(letter.color);
        const endRgb = hexToRgb(letter.targetColor);
        letter.colorProgress = Math.min(1, letter.colorProgress + 0.05);
        if (startRgb && endRgb) {
          letter.color = interpolateColor(startRgb, endRgb, letter.colorProgress);
          needsRedraw = true;
        }
      }
    });
    if (needsRedraw) drawLetters();
  };

  const animate = () => {
    const now = Date.now();
    if (now - lastGlitchTime.current >= glitchSpeed) {
      updateLetters();
      drawLetters();
      lastGlitchTime.current = now;
    }
    if (smooth) handleSmoothTransitions();
    animationRef.current = requestAnimationFrame(animate);
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    if (context.current) context.current.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { columns, rows } = calculateGrid(rect.width, rect.height);
    initializeLetters(columns, rows);
    drawLetters();
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    context.current = canvas.getContext('2d');
    resizeCanvas();
    animate();

    let resizeTimeout: number | undefined;
    const handleResize = () => {
      if (resizeTimeout) window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        resizeCanvas();
        animate();
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glitchSpeed, smooth]);

  return (
    <div className={cn('relative w-full h-full overflow-hidden', className)}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      {outerVignette && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,_rgba(0,0,0,0)_60%,_rgba(0,0,0,1)_100%)]" />
      )}
      {centerVignette && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,_rgba(0,0,0,0.8)_0%,_rgba(0,0,0,0)_60%)]" />
      )}
    </div>
  );
};

/* ────────────── DotFlow Loader ────────────── */
const activeStepFrames = [
  [0, 2, 4, 6, 20, 34, 48, 46, 44, 42, 28, 14, 8, 22, 36, 38, 40, 26, 12, 10, 16, 30, 24, 18, 32],
  [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47],
  [16, 30, 24, 18, 32],
  [24],
  [16, 30, 24, 18, 32],
  [0, 2, 4, 6, 20, 34, 48, 46, 44, 42, 28, 14, 8, 22, 36, 38, 40, 26, 12, 10, 16, 30, 24, 18, 32],
];

const successCheckFrame = [22, 30, 24, 18, 12, 6];

export const DotFlowLoader: React.FC<{
  status: 'waiting' | 'active' | 'success';
  className?: string;
}> = ({ status, className }) => {
  const [frameIndex, setFrameIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const totalDots = 49;

  React.useEffect(() => {
    if (status !== 'active') return;

    let timeoutId: NodeJS.Timeout;
    const updateFrame = () => {
      setFrameIndex((prev) => (prev + 1) % activeStepFrames.length);
      timeoutId = setTimeout(updateFrame, 150);
    };

    updateFrame();

    return () => clearTimeout(timeoutId);
  }, [status]);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      const dots = containerRef.current.querySelectorAll('.dot-item');

      if (status === 'success') {
        const tl = gsap.timeline();

        dots.forEach((dot, i) => {
          const col = i % 7;
          const row = Math.floor(i / 7);
          const dx = (3 - col) * 2.5;
          const dy = (3 - row) * 2.5;

          tl.to(
            dot,
            {
              x: dx,
              y: dy,
              duration: 0.2,
              ease: 'power2.inOut',
            },
            0
          );
        });

        dots.forEach((dot, i) => {
          const isCheck = successCheckFrame.includes(i);
          tl.to(
            dot,
            {
              x: 0,
              y: 0,
              backgroundColor: isCheck ? '#ffffff' : 'rgba(255,255,255,0.05)',
              boxShadow: isCheck ? '0 0 4px rgba(255,255,255,0.9)' : 'none',
              duration: 0.3,
              ease: 'back.out(2)',
            },
            0.2
          );

          if (isCheck) {
            tl.to(
              dot,
              {
                backgroundColor: '#22c55e',
                boxShadow: '0 0 6px rgba(34,197,94,0.9)',
                duration: 0.3,
              },
              0.5
            );
          } else {
            tl.to(
              dot,
              {
                backgroundColor: 'transparent',
                boxShadow: 'none',
                duration: 0.3,
              },
              0.5
            );
          }
        });
      } else if (status === 'active') {
        gsap.set(dots, { x: 0, y: 0, clearProps: 'all' });
      }
    },
    { dependencies: [status], scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'grid grid-cols-7 gap-[1.5px] w-[19px] h-[19px] flex-shrink-0 relative',
        className
      )}
    >
      {Array.from({ length: totalDots }).map((_, i) => {
        let isHighlighted = false;

        if (status === 'active') {
          isHighlighted = activeStepFrames[frameIndex].includes(i);
        }

        return (
          <div
            key={i}
            className={cn(
              'dot-item w-[1.5px] h-[1.5px] rounded-full',
              status === 'waiting' && 'bg-white/5',
              status === 'active' &&
                (isHighlighted
                  ? 'bg-white shadow-[0_0_3px_rgba(255,255,255,0.9)] scale-110'
                  : 'bg-white/5'),
              status === 'success' && 'bg-white/5'
            )}
            style={{
              transition:
                status === 'success'
                  ? 'none'
                  : 'background-color 0.2s, box-shadow 0.2s, transform 0.2s',
            }}
          />
        );
      })}
    </div>
  );
};

/* ────────────── AsciiProgressBar ────────────── */
export const AsciiProgressBar: React.FC<{
  progress: number;
  className?: string;
  isSuccess?: boolean;
}> = ({ progress, className, isSuccess }) => {
  const [animatedProgress, setAnimatedProgress] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(t);
  }, [progress]);

  const totalBars = 18;
  const filledBars = Math.floor((animatedProgress / 100) * totalBars);
  const characters = Array.from({ length: totalBars }, (_, index) => ({
    char: index < filledBars ? '\u2593' : '\u2591',
    isFilled: index < filledBars,
    index,
  }));

  return (
    <div
      className={cn('font-mono text-sm sm:text-base w-full max-w-full overflow-hidden', className)}
    >
      <div className="flex items-center justify-center text-white/80 whitespace-nowrap">
        <span className="text-white/60 mr-1.5 sm:mr-2">[</span>
        <div className="flex text-[11px] sm:text-sm md:text-base tracking-tighter">
          {characters.map((item, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0.3 }}
              animate={{ opacity: 1, scale: item.isFilled ? [1, 1.2, 1] : 1 }}
              transition={{
                delay: item.isFilled ? index * 0.03 : 0,
                duration: item.isFilled ? 0.3 : 0.1,
                scale: { repeat: item.isFilled ? 1 : 0, duration: 0.4 },
              }}
              className={
                item.isFilled
                  ? isSuccess && index === characters.length - 1
                    ? 'text-[var(--color-brand-success)] drop-shadow-[0_0_8px_rgba(72,255,145,0.8)]'
                    : 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]'
                  : 'text-white/40'
              }
            >
              {item.char}
            </motion.span>
          ))}
        </div>
        <span className="text-white/60 ml-1.5 sm:ml-2">]</span>
        <span
          className={cn(
            'ml-2 sm:ml-4 font-bold text-sm sm:text-base drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] shrink-0',
            isSuccess ? 'text-[var(--color-brand-success)]' : 'text-white'
          )}
        >
          {Math.round(animatedProgress)}%
        </span>
      </div>
    </div>
  );
};

/* ────────────── Wallet Processing Card ────────────── */
interface WalletProcessingCardProps {
  walletName: string;
  status: 'connecting' | 'succeeded' | 'failed';
  progress: number;
}

export const WalletProcessingCard: React.FC<WalletProcessingCardProps> = ({
  walletName,
  status,
}) => {
  return (
    <div className="w-full relative h-[160px] sm:h-[240px] rounded-none border border-zinc-700/50 bg-white/[0.02] overflow-hidden mb-4 sm:mb-6 flex flex-col shadow-2xl">
      {/* ASCII glitch backdrop */}
      <div className="absolute inset-0 opacity-[0.07] z-0 mix-blend-screen pointer-events-none">
        <LetterGlitch glitchSpeed={60} characters="10!<>-_/[]" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-zinc-950 to-transparent blur-md"></div>
          <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-zinc-950 to-transparent blur-md"></div>
        </div>
      </div>

      {/* Subtle white radial glow */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,255,255,0.03), transparent 80%)',
        }}
      />

      {/* Success Impact */}
      <AnimatePresence>
        {status === 'succeeded' && (
          <motion.div
            key="card-success-impact"
            className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <InnerShockwave />
            <SquarePixelDebris count={24} radius={140} duration={0.5} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Foreground content */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full pt-4">
        <div className="relative flex items-center justify-center">
          {status === 'succeeded' && <TwinkleParticles count={20} radius={45} />}
          <div
            className={cn(
              'relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-500',
              status === 'connecting'
                ? 'bg-zinc-900'
                : status === 'succeeded'
                  ? 'bg-zinc-900 border-2 border-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.6)]'
                  : status === 'failed'
                    ? 'bg-zinc-900 border-2 border-[var(--color-brand-error)] shadow-[0_0_20px_rgba(255,72,72,0.6)] animate-shake'
                    : 'border border-zinc-700 bg-zinc-900 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
            )}
          >
            {status === 'connecting' && (
              <>
                <div
                  className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_280deg,#ffffff_360deg)] animate-spin"
                  style={{ animationDuration: '2s' }}
                />
                <div className="absolute inset-[1px] rounded-[15px] bg-zinc-900 z-0" />
              </>
            )}

            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <AnimatePresence mode="wait">
                {status === 'succeeded' ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
                    className="relative flex items-center justify-center text-[var(--color-brand-success)] drop-shadow-[0_0_8px_rgba(72,255,145,0.8)] w-full h-full"
                  >
                    <Check className="w-8 h-8 relative z-10" strokeWidth={3} />
                  </motion.div>
                ) : status === 'failed' ? (
                  <motion.div
                    key="failed"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-[var(--color-brand-error)] drop-shadow-[0_0_8px_rgba(255,72,72,0.8)]"
                  >
                    <X className="w-8 h-8" strokeWidth={3} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="logo"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative w-8 h-8 flex items-center justify-center drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"
                  >
                    {walletName === 'MetaMask' || walletName === 'Trust Wallet' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={walletName === 'MetaMask' ? '/metamask.svg' : '/trustwallet.svg'}
                        alt={walletName}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <svg
                        className="w-6 h-6 text-white/70"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
                        />
                      </svg>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
