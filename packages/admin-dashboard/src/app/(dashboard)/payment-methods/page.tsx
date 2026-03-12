export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getPaymentMethods } from '@/app/actions/payment-methods';
import { getMerchants } from '@/app/actions/merchants';
import { getTokens } from '@/app/actions/tokens';
import { getChains } from '@/app/actions/chains';
import PaymentMethodsClient from './PaymentMethodsClient';

export default async function PaymentMethodsPage() {
  const [paymentMethods, merchants, tokens, chains] = await Promise.all([
    getPaymentMethods(),
    getMerchants(),
    getTokens(),
    getChains(),
  ]);

  if ('error' in paymentMethods) redirect('/login');
  if ('error' in merchants) redirect('/login');
  if ('error' in tokens) redirect('/login');
  if ('error' in chains) redirect('/login');

  return (
    <PaymentMethodsClient
      paymentMethods={paymentMethods}
      merchants={merchants.map((merchant) => ({ id: merchant.id, name: merchant.name }))}
      tokens={tokens.map((token) => ({
        id: token.id,
        symbol: token.symbol,
        chain_id: token.chain_id,
      }))}
      chains={chains.map((chain) => ({ id: chain.id, name: chain.name }))}
    />
  );
}
