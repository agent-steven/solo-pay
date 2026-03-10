'use client';

import { useState } from 'react';
import {
  createMerchant,
  updateMerchant,
  deleteMerchant,
  rotateApiKey,
} from '@/app/actions/merchants';
import { Modal, Field } from '@/components/ui';
import type { Merchant } from '@solo-pay/database';

interface Props {
  merchants: Merchant[];
  chains: { id: number; name: string; network_id: number }[];
}

export default function MerchantsClient({ merchants, chains }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Merchant | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function handleCreateSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    handleCreate(new FormData(e.currentTarget));
  }

  function handleEditSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    handleEdit(new FormData(e.currentTarget));
  }

  async function handleCreate(formData: FormData) {
    setIsPending(true);
    try {
      const result = await createMerchant(formData);
      if ('error' in result) {
        setFormError(result.error ?? 'Unknown error');
        return;
      }
      setFormError(null);
      setNewApiKey(result.apiKey);
      setIsCreateOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  async function handleEdit(formData: FormData) {
    if (!editTarget) return;
    setIsPending(true);
    try {
      const result = await updateMerchant(editTarget.id, formData);
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

  async function handleRotateKey(id: number) {
    if (!confirm('Rotate API key? The old key will stop working immediately.')) return;
    setIsPending(true);
    try {
      const result = await rotateApiKey(id);
      setNewApiKey(result.apiKey);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete merchant "${name}"?`)) return;
    setIsPending(true);
    try {
      await deleteMerchant(id);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Merchants</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage merchant accounts and API keys</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          + New Merchant
        </button>
      </div>

      {newApiKey && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800 mb-1">
            Save this API key — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-white border border-amber-200 rounded px-3 py-1.5 font-mono text-amber-900 break-all">
              {newApiKey}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(newApiKey)}
              className="px-3 py-1.5 text-xs border border-amber-300 rounded hover:bg-amber-100 text-amber-800 whitespace-nowrap"
            >
              Copy
            </button>
            <button
              onClick={() => setNewApiKey(null)}
              className="px-3 py-1.5 text-xs border border-amber-300 rounded hover:bg-amber-100 text-amber-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Merchant Key</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Public Key</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Chain</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {merchants.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No merchants yet
                </td>
              </tr>
            ) : (
              merchants.map((merchant) => {
                const chain = chains.find((chain) => chain.id === merchant.chain_id);
                return (
                  <tr key={merchant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{merchant.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[160px] truncate">
                      {merchant.merchant_key}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate">
                      {merchant.public_key ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {chain ? `${chain.name} (${chain.network_id})` : merchant.chain_id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          merchant.is_enabled
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {merchant.is_enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditTarget(merchant)}
                            disabled={isPending}
                            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded disabled:opacity-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRotateKey(merchant.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded disabled:opacity-50 transition-colors"
                          >
                            Rotate Key
                          </button>
                        </div>
                        <div className="w-px h-4 bg-gray-200" />
                        <button
                          onClick={() => handleDelete(merchant.id, merchant.name)}
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
          title="New Merchant"
          onClose={() => {
            setIsCreateOpen(false);
            setFormError(null);
          }}
        >
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}
            <Field label="Name" name="name" required />
            <Field label="Merchant Key" name="merchant_key" required placeholder="e.g. my-shop" />
            <ChainSelect chains={chains} />
            <Field label="Webhook URL" name="webhook_url" type="url" placeholder="https://..." />
            <Field label="Recipient Address" name="recipient_address" placeholder="0x..." />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md"
              >
                {isPending ? 'Saving...' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editTarget && (
        <Modal title="Edit Merchant" onClose={() => setEditTarget(null)}>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <Field label="Name" name="name" required defaultValue={editTarget.name} />
            <Field
              label="Merchant Key"
              name="merchant_key"
              required
              defaultValue={editTarget.merchant_key}
            />
            <ChainSelect chains={chains} defaultValue={editTarget.chain_id} />
            <Field
              label="Webhook URL"
              name="webhook_url"
              type="url"
              defaultValue={editTarget.webhook_url ?? ''}
              placeholder="https://..."
            />
            <Field
              label="Recipient Address"
              name="recipient_address"
              defaultValue={editTarget.recipient_address ?? ''}
              placeholder="0x..."
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md"
              >
                {isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

interface ChainSelectProps {
  chains: { id: number; name: string; network_id: number }[];
  defaultValue?: number;
}

function ChainSelect({ chains, defaultValue }: ChainSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Chain <span className="text-red-500">*</span>
      </label>
      <select
        name="chain_id"
        required
        defaultValue={defaultValue ?? ''}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      >
        <option value="">Select chain</option>
        {chains.map((chain) => (
          <option key={chain.id} value={chain.id}>
            {chain.name} ({chain.network_id})
          </option>
        ))}
      </select>
    </div>
  );
}
