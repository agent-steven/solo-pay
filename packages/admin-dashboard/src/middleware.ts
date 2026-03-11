import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'admin_session';
const PUBLIC_PATHS = ['/login'];

async function computeHmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SESSION_SECRET ?? '';

  if (!secret) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const session = request.cookies.get(COOKIE_NAME)?.value;
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const dotIndex = session.lastIndexOf('.');
  if (dotIndex === -1) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = session.slice(0, dotIndex);
  const storedHmac = session.slice(dotIndex + 1);

  let valid = false;
  try {
    const computedHmac = await computeHmac(secret, token);
    valid = computedHmac === storedHmac;
  } catch {
    valid = false;
  }

  if (!valid) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
