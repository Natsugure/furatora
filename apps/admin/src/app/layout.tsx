import type { Metadata } from 'next';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { AdminShell } from '@/components/AdminShell';
import { auth } from '@/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admin - ふらとら',
  description: 'Administration panel',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider defaultColorScheme="light">
          {session ? (
            <AdminShell>{children}</AdminShell>
          ) : (
            <main style={{ padding: '1.5rem' }}>{children}</main>
          )}
        </MantineProvider>
      </body>
    </html>
  );
}
