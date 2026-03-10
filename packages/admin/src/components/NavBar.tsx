'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';

const navItems = [
  { href: '/payments', label: 'Payments' },
  { href: '/merchants', label: 'Merchants' },
  { href: '/payment-methods', label: 'Payment Methods' },
  { href: '/tokens', label: 'Tokens' },
  { href: '/chains', label: 'Chains' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <Link href="/payments" className="font-semibold text-gray-900 text-sm">SoloPay Admin</Link>
          <nav className="flex gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
