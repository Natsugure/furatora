import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';
import Link from 'next/link';
import Image from 'next/image';
import { Train } from 'lucide-react';
import { Providers } from './providers';
import { Container } from '@/components/ui/Container';
import '@mantine/core/styles.css';
import './globals.css';
import iconSvg from './icon.svg';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'ふらとら | バリアフリー駅・列車案内',
  description: '首都圏の鉄道のベビーカー・車いすに優しい乗り換えルートを検索できます。他社線同士の乗り換えや、実際に列車に乗ったあとのフリースペース情報までわかりやすくご案内します。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${geist.variable} antialiased flex flex-col min-h-screen`}>
        <Providers>
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <Container className="h-20 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="flex items-end gap-1 text-blue-500">
                  <Image src={iconSvg} alt="ふらとらアイコン" width={30} height={30} unoptimized />
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight text-gray-900">
                    ふらとら
                  </p>
                  <p className="text-xs text-gray-500">
                    首都圏の鉄道のベビーカー・車いすに優しい乗り換えルートを表示
                  </p>
                </div>
              </Link>
              <Train size={28} className="text-gray-300 flex-shrink-0" />
            </Container>
          </header>

          {/* Main content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-8">
            <Container className="py-4 text-center">
              <p className="text-xs text-gray-500">
                Copyright © ふらとら All Rights Reserved
              </p>
            </Container>
          </footer>
        </Providers>
      </body>
      <GoogleAnalytics gaId={process.env.GA_ID || ''} />
    </html>
  );
}
