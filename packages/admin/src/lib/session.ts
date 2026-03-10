'use server';

import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_session';
const SECRET = process.env.ADMIN_SESSION_SECRET ?? 'dev-secret';

export async function createSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, SECRET, {
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

export async function getSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  return value === SECRET ? { user: { username: process.env.ADMIN_USERNAME } } : null;
}
