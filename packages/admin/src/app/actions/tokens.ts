'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@solo-pay/database';
import { prisma } from '@/lib/db';

const tokenSchema = z.object({
  chain_id: z.coerce.number().int().positive(),
  address: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.coerce.number().int().min(0).max(18),
  cmc_slug: z.string().optional().or(z.literal('')),
  permit_enabled: z.coerce.boolean().optional(),
});

export async function getTokens() {
  return prisma.token.findMany({
    orderBy: { symbol: 'asc' },
  });
}

export async function createToken(formData: FormData) {
  const parsed = tokenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    await prisma.token.create({
      data: { ...parsed.data, cmc_slug: parsed.data.cmc_slug || null },
    });
    revalidatePath('/tokens');
    return { success: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { error: 'Token address already exists on this chain.' };
    throw e;
  }
}

export async function updateToken(id: number, formData: FormData) {
  const parsed = tokenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await prisma.token.update({
    where: { id },
    data: { ...parsed.data, cmc_slug: parsed.data.cmc_slug || null },
  });
  revalidatePath('/tokens');
  return { success: true };
}

export async function toggleToken(id: number, is_enabled: boolean) {
  await prisma.token.update({ where: { id }, data: { is_enabled } });
  revalidatePath('/tokens');
}

export async function deleteToken(id: number) {
  await prisma.token.delete({ where: { id } });
  revalidatePath('/tokens');
}
