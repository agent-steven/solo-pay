'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@solo-pay/database';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

function hashKey(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateApiKey() {
  const raw = `sk_live_${crypto.randomBytes(20).toString('hex')}`;
  return { raw, hash: hashKey(raw) };
}

function generatePublicKey() {
  const key = `pk_live_${crypto.randomBytes(20).toString('hex')}`;
  return { key, hash: hashKey(key) };
}

const merchantSchema = z.object({
  name: z.string().min(1),
  merchant_key: z.string().min(1),
  chain_id: z.coerce.number().int().positive(),
  webhook_url: z.string().url().optional().or(z.literal('')),
  recipient_address: z.string().optional().or(z.literal('')),
});

export async function getMerchants() {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  return prisma.merchant.findMany({
    orderBy: { created_at: 'desc' },
  });
}

export async function getMerchant(id: number) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  return prisma.merchant.findFirst({ where: { id } });
}

export async function createMerchant(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  const parsed = merchantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const apiKey = generateApiKey();
  const publicKey = generatePublicKey();

  try {
    const merchant = await prisma.merchant.create({
      data: {
        ...parsed.data,
        webhook_url: parsed.data.webhook_url || null,
        recipient_address: parsed.data.recipient_address || null,
        api_key_hash: apiKey.hash,
        public_key: publicKey.key,
        public_key_hash: publicKey.hash,
      },
    });

    revalidatePath('/merchants');
    return { merchant, apiKey: apiKey.raw, publicKey: publicKey.key };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { error: 'Merchant key already exists.' };
    throw e;
  }
}

export async function updateMerchant(id: number, formData: FormData) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  const parsed = merchantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await prisma.merchant.update({
    where: { id },
    data: {
      ...parsed.data,
      webhook_url: parsed.data.webhook_url || null,
      recipient_address: parsed.data.recipient_address || null,
    },
  });

  revalidatePath('/merchants');
  return { success: true };
}

export async function rotateApiKey(id: number) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  const apiKey = generateApiKey();
  await prisma.merchant.update({ where: { id }, data: { api_key_hash: apiKey.hash } });
  revalidatePath('/merchants');
  return { apiKey: apiKey.raw };
}

export async function rotatePublicKey(id: number) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  const publicKey = generatePublicKey();
  await prisma.merchant.update({
    where: { id },
    data: { public_key: publicKey.key, public_key_hash: publicKey.hash },
  });
  revalidatePath('/merchants');
  return { publicKey: publicKey.key };
}

export async function deleteMerchant(id: number) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  await prisma.merchant.delete({ where: { id } });
  revalidatePath('/merchants');
}
