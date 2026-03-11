import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'admin_session';
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
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
  const computedHmac = crypto.createHmac('sha256', secret).update(token).digest('hex');

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(computedHmac, 'hex'),
      Buffer.from(storedHmac, 'hex')
    );
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
