import { test, expect } from '@playwright/test';

test('ダッシュボードページが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
});

test('サイドバーのナビゲーションリンクが表示される', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'ダッシュボード' })).toBeVisible();
  await expect(page.getByRole('link', { name: '事業者' })).toBeVisible();
  await expect(page.getByRole('link', { name: '路線' })).toBeVisible();
  await expect(page.getByRole('link', { name: '駅' })).toBeVisible();
  await expect(page.getByRole('link', { name: '列車' })).toBeVisible();
});

test('ページタイトルが正しい', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Admin - ふらとら/);
});
