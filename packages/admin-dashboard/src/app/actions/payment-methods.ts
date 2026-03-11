'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@solo-pay/database';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

const paymentMethodSchema = z.object({
  merchant_id: z.coerce.number().int().positive(),
  token_id: z.coerce.number().int().positive(),
});

export async function getPaymentMethods() {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  return prisma.merchantPaymentMethod.findMany({
    orderBy: { created_at: 'desc' },
  });
}

export async function createPaymentMethod(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  const parsed = paymentMethodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    await prisma.merchantPaymentMethod.create({ data: parsed.data });
    revalidatePath('/payment-methods');
    return { success: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { error: 'This token is already added for that merchant.' };
    throw e;
  }
}

export async function togglePaymentMethod(id: number, is_enabled: boolean) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  await prisma.merchantPaymentMethod.update({ where: { id }, data: { is_enabled } });
  revalidatePath('/payment-methods');
}

export async function deletePaymentMethod(id: number) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  await prisma.merchantPaymentMethod.delete({ where: { id } });
  revalidatePath('/payment-methods');
}
