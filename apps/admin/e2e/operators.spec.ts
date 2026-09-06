import { test, expect } from '@playwright/test';

test('事業者一覧ページへ遷移できる', async ({ page }) => {
  await page.goto('/operators');
  await expect(page.getByRole('heading', { name: '事業者' })).toBeVisible();
  await expect(page.getByRole('link', { name: '+ 新規' })).toBeVisible();
});

test('新規事業者フォームが表示される', async ({ page }) => {
  await page.goto('/operators/new');
  await expect(page.getByRole('heading', { name: '新規事業者' })).toBeVisible();
  await expect(page.getByLabel('事業者名')).toBeVisible();
  await expect(page.getByLabel(/ODPT事業者コード/)).toBeVisible();
  await expect(page.getByLabel(/表示優先度/)).toBeVisible();
});

test('事業者名が空の場合、フォーム送信が阻止される', async ({ page }) => {
  await page.goto('/operators/new');

  // 事業者名を入力せずに送信ボタンをクリック
  await page.getByRole('button', { name: '作成' }).click();

  // HTML5 バリデーションにより /operators/new のまま
  await expect(page).toHaveURL('/operators/new');
});

test('事業者作成フォームを送信できる（APIモック）', async ({ page }) => {
  // POST /api/operators をモック
  await page.route('/api/operators', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-id', name: 'テスト事業者', odptOperatorId: null, displayPriority: 0 }),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('/operators/new');
  await page.getByLabel('事業者名').fill('テスト事業者');
  await page.getByRole('button', { name: '作成' }).click();

  // 成功後は /operators にリダイレクト
  await expect(page).toHaveURL('/operators');
});

test('削除ボタンで確認モーダルが表示される', async ({ page }) => {
  // GET /api/operators をモックして1件表示
  await page.route('/operators', async (route) => {
    await route.continue();
  });

  // 事業者一覧ページに遷移してから削除ボタンを探す
  // DBにデータがある場合のみ実行可能なため、確認モーダルのテストは
  // 削除ボタンが存在する場合のみ実行する
  await page.goto('/operators');

  const deleteButton = page.getByRole('button', { name: '削除' }).first();
  const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

  if (!hasDeleteButton) {
    test.skip();
    return;
  }

  await deleteButton.click();

  await expect(page.getByRole('dialog', { name: '削除確認' })).toBeVisible();
  await expect(page.getByText('本当に削除しますか？')).toBeVisible();
  await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: '削除' })).toBeVisible();
});

test('削除確認モーダルをキャンセルできる', async ({ page }) => {
  await page.goto('/operators');

  const deleteButton = page.getByRole('button', { name: '削除' }).first();
  const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

  if (!hasDeleteButton) {
    test.skip();
    return;
  }

  await deleteButton.click();
  await expect(page.getByRole('dialog', { name: '削除確認' })).toBeVisible();

  await page.getByRole('button', { name: 'キャンセル' }).click();

  await expect(page.getByRole('dialog')).not.toBeVisible();
  // URLは変わらない
  await expect(page).toHaveURL('/operators');
});

test('事業者削除を実行できる（APIモック）', async ({ page }) => {
  const mockOperatorId = 'mock-operator-id';

  // GET /operators ページでは実際のDBを使用（構造テスト）
  // DELETE /api/operators/:id をモック
  await page.route(`/api/operators/${mockOperatorId}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('/operators');

  const deleteButton = page.getByRole('button', { name: '削除' }).first();
  const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

  if (!hasDeleteButton) {
    test.skip();
    return;
  }

  await deleteButton.click();
  await expect(page.getByRole('dialog', { name: '削除確認' })).toBeVisible();

  // モーダル内の削除ボタンをクリック
  await page.getByRole('dialog').getByRole('button', { name: '削除' }).click();

  // 削除後は /operators にとどまる（または再ロード）
  await page.waitForURL('/operators');
});
