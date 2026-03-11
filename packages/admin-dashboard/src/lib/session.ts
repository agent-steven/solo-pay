'use server';

import crypto from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_session';
const SECRET = process.env.ADMIN_SESSION_SECRET ?? '';

export async function createSession() {
  const cookieStore = await cookies();
  const token = crypto.randomBytes(32).toString('hex');
  const hmac = crypto.createHmac('sha256', SECRET).update(token).digest('hex');
  cookieStore.set(COOKIE_NAME, `${token}.${hmac}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const getSession = cache(async function getSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return null;

  const dotIndex = value.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const token = value.slice(0, dotIndex);
  const storedHmac = value.slice(dotIndex + 1);
  const computedHmac = crypto.createHmac('sha256', SECRET).update(token).digest('hex');

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(computedHmac, 'hex'),
      Buffer.from(storedHmac, 'hex')
    );
    return valid ? { user: { username: process.env.ADMIN_USERNAME } } : null;
  } catch {
    return null;
  }
});
