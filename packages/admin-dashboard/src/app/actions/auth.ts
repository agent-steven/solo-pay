'use server';

import crypto from 'crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSession, deleteSession } from '@/lib/session';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: 'Invalid username or password.' };
  }

  const { username, password } = parsed.data;

  const adminUsername = process.env.ADMIN_USERNAME ?? '';
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';

  if (!adminUsername || !adminPassword) {
    return { error: 'Invalid username or password.' };
  }

  const usernameMatch = crypto.timingSafeEqual(
    crypto.createHash('sha256').update(username).digest(),
    crypto.createHash('sha256').update(adminUsername).digest()
  );

  const passwordMatch = crypto.timingSafeEqual(
    crypto.createHash('sha256').update(password).digest(),
    crypto.createHash('sha256').update(adminPassword).digest()
  );

  if (!usernameMatch || !passwordMatch) {
    return { error: 'Invalid username or password.' };
  }

  await createSession();
  redirect('/payments');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}
