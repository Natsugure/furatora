import { test, expect } from '@playwright/test';

// このファイルのテストは storageState を使わない（未認証状態のテスト）
test.use({ storageState: { cookies: [], origins: [] } });

test('未認証ユーザーは /login にリダイレクトされる', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});

test('ログインページに GitHubログインボタンが表示される', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'GitHubでログイン' })).toBeVisible();
});
