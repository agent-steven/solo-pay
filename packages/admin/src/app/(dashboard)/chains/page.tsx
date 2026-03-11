export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getChains } from '@/app/actions/chains';
import ChainsClient from './ChainsClient';

export default async function ChainsPage() {
  const chains = await getChains();

  if ('error' in chains) redirect('/login');

  return <ChainsClient chains={chains} />;
}
