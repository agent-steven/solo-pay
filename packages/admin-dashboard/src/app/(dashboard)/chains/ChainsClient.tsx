'use client';

import { useState } from 'react';
import { createChain, updateChain, toggleChain, deleteChain } from '@/app/actions/chains';
import { Modal, Field } from '@/components/ui';
import type { Chain } from '@solo-pay/database';

interface Props {
  chains: Chain[];
}

export default function ChainsClient({ chains }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Chain | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleCreate(formData: FormData) {
    setIsPending(true);
    try {
      const result = await createChain(formData);
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
      const result = await updateChain(editTarget.id, formData);
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
      await toggleChain(id, !current);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete chain "${name}"?`)) return;
    setIsPending(true);
    try {
      await deleteChain(id);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Chains</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage supported blockchain networks</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          + New Chain
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Network ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">RPC URL</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {chains.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No chains yet
                </td>
              </tr>
            ) : (
              chains.map((chain) => (
                <tr key={chain.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{chain.name}</td>
                  <td className="px-4 py-3 text-gray-600">{chain.network_id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[200px] truncate">
                    {chain.rpc_url}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        chain.is_testnet
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {chain.is_testnet ? 'Testnet' : 'Mainnet'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        chain.is_enabled
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {chain.is_enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditTarget(chain);
                          setFormError(null);
                        }}
                        disabled={isPending}
                        className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded disabled:opacity-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(chain.id, chain.is_enabled)}
                        disabled={isPending}
                        className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded disabled:opacity-50 transition-colors"
                      >
                        {chain.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                      <div className="w-px h-4 bg-gray-200" />
                      <button
                        onClick={() => handleDelete(chain.id, chain.name)}
                        disabled={isPending}
                        className="px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <Modal
          title="New Chain"
          onClose={() => {
            setIsCreateOpen(false);
            setFormError(null);
          }}
        >
          <ChainForm
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
          title="Edit Chain"
          onClose={() => {
            setEditTarget(null);
            setFormError(null);
          }}
        >
          <ChainForm
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

interface ChainFormProps {
  defaultValues?: Chain;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  formError: string | null;
  isPending: boolean;
  submitLabel: string;
}

function ChainForm({
  defaultValues,
  onSubmit,
  onCancel,
  formError,
  isPending,
  submitLabel,
}: ChainFormProps) {
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
      <Field label="Name" name="name" required defaultValue={defaultValues?.name} />
      <Field
        label="Network ID"
        name="network_id"
        type="number"
        required
        defaultValue={defaultValues?.network_id?.toString()}
      />
      <Field
        label="RPC URL"
        name="rpc_url"
        type="url"
        required
        defaultValue={defaultValues?.rpc_url}
        placeholder="https://..."
      />
      <Field
        label="Relayer URL"
        name="relayer_url"
        type="url"
        defaultValue={defaultValues?.relayer_url ?? ''}
        placeholder="https://..."
      />
      <Field
        label="Gateway Address"
        name="gateway_address"
        defaultValue={defaultValues?.gateway_address ?? ''}
        placeholder="0x..."
      />
      <Field
        label="Forwarder Address"
        name="forwarder_address"
        defaultValue={defaultValues?.forwarder_address ?? ''}
        placeholder="0x..."
      />
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="is_testnet"
          id="is_testnet"
          value="true"
          defaultChecked={defaultValues?.is_testnet ?? false}
          className="rounded border-gray-300"
        />
        <label htmlFor="is_testnet" className="text-sm text-gray-700">
          Testnet
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
