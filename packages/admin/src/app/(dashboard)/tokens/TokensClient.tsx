'use client';

import { useState } from 'react';
import { createToken, updateToken, toggleToken, deleteToken } from '@/app/actions/tokens';
import { Modal, Field } from '@/components/ui';
import type { Token } from '@solo-pay/database';

interface Props {
  tokens: Token[];
  chains: { id: number; name: string }[];
}

export default function TokensClient({ tokens, chains }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Token | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleCreate(formData: FormData) {
    setIsPending(true);
    try {
      const result = await createToken(formData);
      if ('error' in result) {
        setFormError(result.error ?? 'Unknown error');
        return;
      }
      setFormError(null);
      setIsCreateOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  async function handleEdit(formData: FormData) {
    if (!editTarget) return;
    setIsPending(true);
    try {
      const result = await updateToken(editTarget.id, formData);
      if ('error' in result) {
        setFormError(result.error ?? 'Unknown error');
        return;
      }
      setFormError(null);
      setEditTarget(null);
    } finally {
      setIsPending(false);
    }
  }

  async function handleToggle(id: number, current: boolean) {
    setIsPending(true);
    try {
      await toggleToken(id, !current);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: number, symbol: string) {
    if (!confirm(`Delete token "${symbol}"?`)) return;
    setIsPending(true);
    try {
      await deleteToken(id);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tokens</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage supported ERC-20 tokens</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          + New Token
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Symbol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Chain</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Address</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Decimals</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No tokens yet
                </td>
              </tr>
            ) : (
              tokens.map((token) => {
                const chain = chains.find((chain) => chain.id === token.chain_id);
                return (
                  <tr key={token.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">
                      {token.symbol}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{chain?.name ?? token.chain_id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[160px] truncate">
                      {token.address}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{token.decimals}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          token.is_enabled
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {token.is_enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditTarget(token);
                            setFormError(null);
                          }}
                          disabled={isPending}
                          className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded disabled:opacity-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggle(token.id, token.is_enabled)}
                          disabled={isPending}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded disabled:opacity-50 transition-colors"
                        >
                          {token.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                        <div className="w-px h-4 bg-gray-200" />
                        <button
                          onClick={() => handleDelete(token.id, token.symbol)}
                          disabled={isPending}
                          className="px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded disabled:opacity-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <Modal
          title="New Token"
          onClose={() => {
            setIsCreateOpen(false);
            setFormError(null);
          }}
        >
          <TokenForm
            chains={chains}
            onSubmit={handleCreate}
            onCancel={() => {
              setIsCreateOpen(false);
              setFormError(null);
            }}
            formError={formError}
            isPending={isPending}
            submitLabel="Create"
          />
        </Modal>
      )}

      {editTarget && (
        <Modal
          title="Edit Token"
          onClose={() => {
            setEditTarget(null);
            setFormError(null);
          }}
        >
          <TokenForm
            chains={chains}
            defaultValues={editTarget}
            onSubmit={handleEdit}
            onCancel={() => {
              setEditTarget(null);
              setFormError(null);
            }}
            formError={formError}
            isPending={isPending}
            submitLabel="Save"
          />
        </Modal>
      )}
    </div>
  );
}

interface TokenFormProps {
  chains: { id: number; name: string }[];
  defaultValues?: Token;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  formError: string | null;
  isPending: boolean;
  submitLabel: string;
}

function TokenForm({
  chains,
  defaultValues,
  onSubmit,
  onCancel,
  formError,
  isPending,
  submitLabel,
}: TokenFormProps) {
  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {formError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {formError}
        </p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Chain <span className="text-red-500">*</span>
        </label>
        <select
          name="chain_id"
          required
          defaultValue={defaultValues?.chain_id ?? ''}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Select chain</option>
          {chains.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Symbol"
        name="symbol"
        required
        defaultValue={defaultValues?.symbol}
        placeholder="USDC"
      />
      <Field
        label="Address"
        name="address"
        required
        defaultValue={defaultValues?.address}
        placeholder="0x..."
      />
      <Field
        label="Decimals"
        name="decimals"
        type="number"
        required
        defaultValue={defaultValues?.decimals?.toString()}
        placeholder="18"
      />
      <Field
        label="CoinMarketCap Slug"
        name="cmc_slug"
        defaultValue={defaultValues?.cmc_slug ?? ''}
        placeholder="usd-coin"
      />
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="permit_enabled"
          id="permit_enabled"
          value="true"
          defaultChecked={defaultValues?.permit_enabled ?? false}
          className="rounded border-gray-300"
        />
        <label htmlFor="permit_enabled" className="text-sm text-gray-700">
          Permit enabled (EIP-2612)
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md"
        >
          {isPending ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
