import type { Metadata } from 'next';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Sidebar } from '@/components/Sidebar';
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
    <html lang="ja">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body className="flex">
        <MantineProvider defaultColorScheme="light">
          {session && <Sidebar />}
          <main className="flex-1 p-6">{children}</main>
        </MantineProvider>
      </body>
    </html>
  );
}
