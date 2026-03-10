'use client';

import { useState } from 'react';
import { createPaymentMethod, deletePaymentMethod } from '@/app/actions/payment-methods';
import { Modal } from '@/components/ui';
import type { MerchantPaymentMethod } from '@solo-pay/database';

interface Props {
  paymentMethods: MerchantPaymentMethod[];
  merchants: { id: number; name: string }[];
  tokens: { id: number; symbol: string; chain_id: number }[];
  chains: { id: number; name: string }[];
}

export default function PaymentMethodsClient({ paymentMethods, merchants, tokens, chains }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function handleFormSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    handleCreate(new FormData(e.currentTarget));
  }

  async function handleCreate(formData: FormData) {
    setIsPending(true);
    try {
      const result = await createPaymentMethod(formData);
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

  async function handleDelete(id: number) {
    if (!confirm('Delete this payment method?')) return;
    setIsPending(true);
    try {
      await deletePaymentMethod(id);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payment Methods</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage which tokens each merchant accepts</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          + New Payment Method
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Merchant</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Token</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paymentMethods.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-gray-400">
                  No payment methods yet
                </td>
              </tr>
            ) : (
              paymentMethods.map((method) => {
                const merchant = merchants.find((merchant) => merchant.id === method.merchant_id);
                const token = tokens.find((token) => token.id === method.token_id);
                return (
                  <tr key={method.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {merchant?.name ?? method.merchant_id}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {token ? token.symbol : method.token_id}
                      {token && (
                        <span className="ml-1.5 text-gray-400">
                          (
                          {chains.find((chain) => chain.id === token.chain_id)?.name ??
                            token.chain_id}
                          )
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(method.id)}
                        disabled={isPending}
                        className="px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
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
          title="New Payment Method"
          onClose={() => {
            setIsCreateOpen(false);
            setFormError(null);
          }}
        >
          <form onSubmit={handleFormSubmit} className="space-y-3">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Merchant <span className="text-red-500">*</span>
              </label>
              <select
                name="merchant_id"
                required
                defaultValue=""
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select merchant</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Token <span className="text-red-500">*</span>
              </label>
              <select
                name="token_id"
                required
                defaultValue=""
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select token</option>
                {tokens.map((token) => (
                  <option key={token.id} value={token.id}>
                    {token.symbol} (
                    {chains.find((chain) => chain.id === token.chain_id)?.name ?? token.chain_id})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setFormError(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md"
              >
                {isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
