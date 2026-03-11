import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { validateWidgetUrlParams } from '../lib/validation';
import type { UrlParamsValidationResult } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { LocaleProvider, useLocale } from '../context/LocaleContext';
import { parseLocale, SUPPORTED_LOCALES } from '../lib/i18n';

const PaymentStep = dynamic(() => import('../components/payment/PaymentStep'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

function PaymentContent() {
  const router = useRouter();
  const { t } = useLocale();
  const [validationResult, setValidationResult] = useState<UrlParamsValidationResult | null>(null);

  // Validate URL parameters after mount (client-side only) to avoid hydration mismatch
  useEffect(() => {
    if (!router.isReady) return;
    const searchParams = {
      get: (key: string) => {
        const value = router.query[key];
        return typeof value === 'string' ? value : null;
      },
    };
    setValidationResult(validateWidgetUrlParams(searchParams));
  }, [router.isReady, router.query]);

  if (validationResult === null) return <LoadingSpinner />;

  if (!validationResult.isValid) {
    return (
      <div className="text-center py-8">
        <div className="text-[var(--color-brand-error)] mb-4">
          <svg
            className="w-12 h-12 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="font-medium">{t('error.invalidParams')}</p>
        </div>
        <ul className="text-sm text-zinc-400 space-y-1">
          {validationResult.errors?.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  return <PaymentStep urlParams={validationResult.params} />;
}

function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex gap-2 text-xs font-quantico text-[var(--color-brand-gray)] bg-zinc-800 px-2 py-1 rounded">
      {SUPPORTED_LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          className={`hover:text-white transition-colors ${
            locale === loc ? 'text-white font-bold' : ''
          }`}
        >
          {loc === 'en' ? 'EN' : 'KO'}
        </button>
      ))}
    </div>
  );
}

function WidgetLayout() {
  const { t } = useLocale();
  return (
    <div className="relative z-10 overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 flex flex-col h-full">
      {/* Modal Header (Sticky with Glassmorphism) */}
      <div className="sticky top-0 z-50 p-4 sm:p-6 pb-4 flex justify-between items-start bg-[var(--color-brand-bg)]/95 backdrop-blur-md border-b border-zinc-800/50 relative">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <img
              src="/symbol.svg"
              alt="Solo Pay Symbol"
              width={12}
              height={16}
              className="object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
            />
            <h1 className="text-lg leading-none font-quantico font-bold tracking-tight text-white">
              {t('app.title')}
            </h1>
          </div>
          <p className="text-[10px] sm:text-xs text-[var(--color-brand-gray)] mt-1 opacity-80">
            {t('app.tagline')}
          </p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Modal Body with Step Content */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <PaymentContent />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-zinc-600 border-t border-zinc-800/50 font-mono shrink-0 w-full mt-auto">
        Copyright &copy; 2026 Solo Pay
        <br />
        All rights reserved
      </div>
    </div>
  );
}

const Home: NextPage = () => {
  const router = useRouter();
  const locale = useMemo(
    () => parseLocale(router.query.lang as string | undefined),
    [router.query.lang]
  );

  return (
    <>
      <Head>
        <title>Solo Pay</title>
        <meta content="Solo Pay - Mobile Payment" name="description" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="/favicon.ico" rel="icon" />
      </Head>
      <main className="flex items-center justify-center min-h-screen bg-black">
        <div className="bg-[var(--color-brand-bg)] border border-zinc-800 w-full max-w-md h-screen sm:h-[600px] sm:max-h-[90dvh] relative flex flex-col tech-cut-modal overflow-hidden">
          {/* Corner accent line */}
          <div
            className="absolute h-[1px] rotate-[-45deg] z-20 pointer-events-none bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.8)]"
            style={{ width: '42.43px', right: '-6.21px', bottom: '14.5px' }}
          />
          <LocaleProvider
            locale={locale}
            onLocaleChange={(loc) => {
              const url = new URL(window.location.href);
              url.searchParams.set('lang', loc);
              router.replace(url.pathname + url.search, undefined, { shallow: true });
            }}
          >
            <WidgetLayout />
          </LocaleProvider>
        </div>
      </main>
    </>
  );
};

export const getServerSideProps = () => ({ props: {} });

export default Home;
