import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import { auth } from '@/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admin - RailEase Navi',
  description: 'Administration panel',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="ja">
      <body className="flex">
        {session && <Sidebar />}
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
