'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavLink, Stack, Button } from '@mantine/core';
import { logout } from '@/actions';

const navItems = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/trains', label: '列車' },
  { href: '/stations', label: '駅' },
  { href: '/lines', label: '路線' },
  { href: '/unresolved-connections', label: '未解決接続' },
];

type Props = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <Stack justify="space-between" h="100%">
      <div>
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <NavLink
              key={item.href}
              component={Link}
              href={item.href}
              label={item.label}
              active={isActive}
              onClick={onNavigate}
            />
          );
        })}
      </div>
      <form action={logout}>
        <Button
          type="submit"
          variant="subtle"
          color="gray"
          fullWidth
          justify="flex-start"
        >
          ログアウト
        </Button>
      </form>
    </Stack>
  );
}
