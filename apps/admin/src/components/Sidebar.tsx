'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/actions';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/trains', label: 'Trains' },
  { href: '/stations', label: 'Stations' },
  { href: '/lines', label: 'Lines' },
  { href: '/unresolved-connections', label: '未解決接続' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] flex flex-col">
      <div className="p-4 border-b border-slate-600">
        <h1 className="text-lg font-bold">Admin</h1>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm ${
                isActive
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-slate-600">
        <form action={logout}>
          <button
            type="submit"
            className="w-full px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white text-left"
          >
            ログアウト
          </button>
        </form>
      </div>
    </aside>
  );
}
