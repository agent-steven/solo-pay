export const dynamic = 'force-dynamic';

import { getChains } from '@/app/actions/chains';
import ChainsClient from './ChainsClient';

export default async function ChainsPage() {
  const chains = await getChains();
  return <ChainsClient chains={chains} />;
}
