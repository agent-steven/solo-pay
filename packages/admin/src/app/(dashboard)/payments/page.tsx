import { getPayments, getMerchantNames } from '@/app/actions/payments';
import { getChains } from '@/app/actions/chains';
import PaymentsClient from './PaymentsClient';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const [payments, merchants, chains] = await Promise.all([
    getPayments(),
    getMerchantNames(),
    getChains(),
  ]);
  return <PaymentsClient payments={payments} merchants={merchants} chains={chains} />;
}
