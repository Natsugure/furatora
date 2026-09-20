import { test, expect } from '@playwright/test';

// next/font の変数クラス（--font-biz-udpgothic）は、layout.tsx で <html> に付ける必要がある。
// --font-sign 等 :root で宣言された変数の var() 参照は、<html> 自身に変数が定義されていないと
// 解決に失敗する。<body> など html の子孫要素にクラスを付けても、CSSカスタムプロパティは
// 上位（html）へは伝播しないため、:root の宣言が壊れる（Issue #107）。
//
// コメントだけに頼らず、配置が崩れたら落ちるようにするための回帰テスト。
// next/font が生成するクラス名のハッシュ値には依存せず、<html> 自身で
// --font-biz-udpgothic が実際に解決できているかを直接検証する。
test('next/font の --font-biz-udpgothic 変数クラスが <html> に付与されている', async ({ page }) => {
  await page.goto('/');

  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--font-biz-udpgothic').trim()
  );

  expect(value).not.toBe('');
});
