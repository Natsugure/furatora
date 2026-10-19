import type { Metadata } from 'next';
import { Noto_Sans_JP, BIZ_UDPGothic, Zen_Maru_Gothic } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';
import Link from 'next/link';
import Image from 'next/image';
import { Providers } from './providers';
import { Container } from '@/components/ui/Container';
// レイヤーの順序を最初に宣言する（layers.css のコメント）
import './layers.css';
import '@mantine/core/styles.layer.css';
// ホーム図のトークン。globals.css より前に読む（同じ名前の汎用トークンは globals.css を勝たせる）
import '@furatora/platform-diagram/styles.css';
import './globals.css';
// ヘッダーは案のままの文字なし版を使う。タブの 16px 版（線が太い）は favicon.ico にだけ入れる（ADR-0019）
import iconSvg from '@/assets/app-icon-mark.svg';

// 本文書体（Noto Sans JP）・見出しと数字の書体（Zen Maru Gothic）・ホーム図のサイン用書体（BIZ UDPGothic）。
// 変数クラスは <html> に付けること。globals.css の --font-sans / --font-display と styles.css の --font-sign は
// :root で宣言されており、中の var() は :root 時点で解決される。<body> に付けると
// :root では未定義となり宣言全体が無効になる（Issue #107）
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

const zenMaruGothic = Zen_Maru_Gothic({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-zen-maru-gothic',
  display: 'swap',
});

const bizUdpGothic = BIZ_UDPGothic({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-biz-udpgothic',
  display: 'swap',
});

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
    <html lang="ja" className={`${notoSansJP.variable} ${zenMaruGothic.variable} ${bizUdpGothic.variable}`}>
      <body className="font-sans antialiased flex flex-col min-h-screen">
        <Providers>
          {/* Header */}
          <header className="bg-canvas sticky top-0 z-50">
            <Container className="h-20 flex items-center">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Image src={iconSvg} alt="ふらとらアイコン" width={36} height={36} unoptimized />
                <div>
                  <p className="font-display font-bold text-xl leading-tight text-ink">
                    ふらとら
                  </p>
                  <p className="text-xs text-muted">
                    首都圏の鉄道のベビーカー・車いすに優しい乗り換えルートを表示
                  </p>
                </div>
              </Link>
            </Container>
          </header>

          {/* Main content */}
          <main className="flex-1 flex flex-col">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-surface border-t border-line">
            <Container className="py-4 text-center">
              <p className="text-xs text-muted">
                Copyright © ふらとら All Rights Reserved
              </p>
            </Container>
          </footer>
        </Providers>
      </body>
      { process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID } />
      )}
    </html>
  );
}
