export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getPayments, getMerchantNames } from '@/app/actions/payments';
import { getChains } from '@/app/actions/chains';
import PaymentsClient from './PaymentsClient';

export default async function PaymentsPage() {
  const [payments, merchants, chains] = await Promise.all([
    getPayments(),
    getMerchantNames(),
    getChains(),
  ]);

  if ('error' in payments) redirect('/login');
  if ('error' in merchants) redirect('/login');
  if ('error' in chains) redirect('/login');

  return <PaymentsClient payments={payments} merchants={merchants} chains={chains} />;
}
