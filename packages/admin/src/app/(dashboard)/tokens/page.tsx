export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getTokens } from '@/app/actions/tokens';
import { getChains } from '@/app/actions/chains';
import TokensClient from './TokensClient';

export default async function TokensPage() {
  const [tokens, chains] = await Promise.all([getTokens(), getChains()]);

  if ('error' in tokens) redirect('/login');
  if ('error' in chains) redirect('/login');

  return (
    <TokensClient
      tokens={tokens}
      chains={chains.map((chain) => ({ id: chain.id, name: chain.name }))}
    />
  );
}
