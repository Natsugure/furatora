import { test, expect } from '@playwright/test';

test('ダッシュボードページが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
});

test('サイドバーのナビゲーションリンクが表示される', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'ダッシュボード' })).toBeVisible();
  await expect(nav.getByRole('link', { name: '事業者' })).toBeVisible();
  await expect(nav.getByRole('link', { name: '路線' })).toBeVisible();
  await expect(nav.getByRole('link', { name: '駅' })).toBeVisible();
  await expect(nav.getByRole('link', { name: '列車' })).toBeVisible();
});

test('ページタイトルが正しい', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Admin - ふらとら/);
});

test('ダッシュボードから各マスタ管理ページへ遷移できる', async ({ page }) => {
  await page.goto('/');
  // 「路線」カードの説明文（方向・隣接駅の編集）に「駅」の字が含まれるため、
  // アクセシブルネームではなく href で対象リンクを特定する
  await page.getByRole('main').locator('a[href="/stations"]').click();
  await expect(page).toHaveURL(/\/stations/);
});
