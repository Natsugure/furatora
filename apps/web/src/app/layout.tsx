import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Link from 'next/link';
import { Accessibility, Baby, Train } from 'lucide-react';
import { Providers } from './providers';
import '@mantine/core/styles.css';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'バリアフリー駅・列車案内',
  description: '各駅のホーム設備と列車内フリースペース情報',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${geist.variable} antialiased flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-blue-100`}>
        <Providers>
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-3xl mx-auto px-4 h-20 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="flex items-end gap-1 text-blue-500">
                  <Accessibility size={30} />
                  <Baby size={26} />
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight text-gray-900">
                    バリアフリー駅・列車案内
                  </p>
                  <p className="text-xs text-gray-500">
                    各駅のホーム設備と列車内フリースペース情報
                  </p>
                </div>
              </Link>
              <Train size={28} className="text-gray-300 flex-shrink-0" />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-8">
            <div className="max-w-3xl mx-auto px-4 py-4 text-center">
              <p className="text-xs text-gray-500">
                Copyright © ベビフリ乗換 | 車いす・ベビーカーに優しい乗換案内アプリ All Rights Reserved
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
