'use server';

import { prisma } from '@/lib/db';

export async function getPayments() {
  const payments = await prisma.payment.findMany({
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      merchant_id: true,
      amount: true,
      token_decimals: true,
      token_symbol: true,
      fiat_amount: true,
      currency_code: true,
      status: true,
      tx_hash: true,
      network_id: true,
      created_at: true,
    },
  });

  return payments.map((payment) => ({
    ...payment,
    amount: payment.amount.toString(),
    fiat_amount: payment.fiat_amount?.toString() ?? null,
  }));
}

export async function getMerchantNames() {
  return prisma.merchant.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
