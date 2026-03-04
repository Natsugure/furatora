import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('認証セットアップ', async ({ page }) => {
  await page.goto('/api/auth/signin');

  await page.getByLabel('Username').fill('test-admin');
  await page.getByRole('button', { name: /sign in with credentials/i }).click();

  await page.waitForURL('/');

  await page.context().storageState({ path: authFile });
});
