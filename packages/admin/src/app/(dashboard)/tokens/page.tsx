import { getTokens } from '@/app/actions/tokens';
import { getChains } from '@/app/actions/chains';
import TokensClient from './TokensClient';

export default async function TokensPage() {
  const [tokens, chains] = await Promise.all([getTokens(), getChains()]);
  return (
    <TokensClient
      tokens={tokens}
      chains={chains.map((chain) => ({ id: chain.id, name: chain.name }))}
    />
  );
}
