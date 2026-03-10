export const dynamic = 'force-dynamic';

import { getMerchants } from '@/app/actions/merchants';
import { getChains } from '@/app/actions/chains';
import MerchantsClient from './MerchantsClient';

export default async function MerchantsPage() {
  const [merchants, chains] = await Promise.all([getMerchants(), getChains()]);

  return (
    <MerchantsClient
      merchants={merchants}
      chains={chains.map((chain) => ({
        id: chain.id,
        name: chain.name,
        network_id: chain.network_id,
      }))}
    />
  );
}
