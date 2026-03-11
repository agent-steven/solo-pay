'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@solo-pay/database';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

const chainSchema = z.object({
  network_id: z.coerce.number().int().positive(),
  name: z.string().min(1),
  rpc_url: z.string().url(),
  gateway_address: z.string().optional().or(z.literal('')),
  forwarder_address: z.string().optional().or(z.literal('')),
  relayer_url: z.string().url().optional().or(z.literal('')),
  is_testnet: z.coerce.boolean().optional(),
});

export async function getChains() {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  return prisma.chain.findMany({
    orderBy: { network_id: 'asc' },
  });
}

export async function createChain(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  const parsed = chainSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    await prisma.chain.create({
      data: {
        ...parsed.data,
        gateway_address: parsed.data.gateway_address || null,
        forwarder_address: parsed.data.forwarder_address || null,
        relayer_url: parsed.data.relayer_url || null,
      },
    });
    revalidatePath('/chains');
    return { success: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { error: 'Network ID already exists.' };
    throw e;
  }
}

export async function updateChain(id: number, formData: FormData) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  const parsed = chainSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await prisma.chain.update({
    where: { id },
    data: {
      ...parsed.data,
      gateway_address: parsed.data.gateway_address || null,
      forwarder_address: parsed.data.forwarder_address || null,
      relayer_url: parsed.data.relayer_url || null,
    },
  });
  revalidatePath('/chains');
  return { success: true };
}

export async function toggleChain(id: number, is_enabled: boolean) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  await prisma.chain.update({ where: { id }, data: { is_enabled } });
  revalidatePath('/chains');
}

export async function deleteChain(id: number) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  await prisma.chain.delete({ where: { id } });
  revalidatePath('/chains');
}
