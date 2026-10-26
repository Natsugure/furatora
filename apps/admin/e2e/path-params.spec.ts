import { test, expect } from '@playwright/test';

// 動的ルートのパスパラメータの検証（#108）と小文字化（#160）。
// 実DB（Neon development）に依存する。「東京メトロ」はシード済みの事業者

/** 駅一覧の「管理」リンク（/stations/{id}/layout）から stationId を得る */
async function findStationId(page: import('@playwright/test').Page, query: string): Promise<string> {
  await page.goto('/stations');
  await page.getByRole('link', { name: /東京メトロ/ }).click();
  await page.getByLabel('検索').fill(query);
  await page.waitForURL(/q=/);
  const href = await page.getByRole('link', { name: '管理' }).first().getAttribute('href');
  const match = href?.match(/\/stations\/([^/]+)\/layout/);
  if (!match) throw new Error(`駅「${query}」の管理リンクが見つからない: ${href}`);
  return match[1]!;
}

// next dev は notFound() 後もステータス200を返すため、404ページの内容で判定する
for (const path of [
  '/stations/not-a-uuid/edit',
  '/stations/not-a-uuid/publish',
  '/lines/not-a-uuid/edit',
  '/lines/not-a-uuid/directions',
  '/operators/not-a-uuid/edit',
  '/trains/not-a-uuid/edit',
]) {
  test(`UUID形式でないID（${path}）は500にならず404になる`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  });
}

test('UUID形式でないIDの API は404を返す', async ({ request }) => {
  const response = await request.put('/api/stations/not-a-uuid', { data: {} });
  expect(response.status()).toBe(404);
});

test('乗換接続の追加画面は、不正な operatorId・lineId でも500にならず開く', async ({ page }) => {
  const stationId = await findStationId(page, '渋谷');

  const response = await page.goto(`/stations/${stationId}/connections/new?operatorId=not-a-uuid&lineId=also-invalid`);
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: /乗換接続を追加/ })).toBeVisible();
});

test('駅対の乗換の編集画面は、大文字の駅IDの URL でも駅名を出す（#160）', async ({ page }) => {
  const stationId = await findStationId(page, '渋谷');
  await page.goto(`/stations/${stationId}/edit`);
  const href = await page.locator('a[href$="/transfer"]').first().getAttribute('href');
  const match = href?.match(/\/connections\/([^/]+)\/transfer$/);
  if (!match) throw new Error(`渋谷に乗換の接続が無い: ${href}`);
  const connectedStationId = match[1]!;

  await page.goto(`/stations/${stationId}/connections/${connectedStationId}/transfer`);
  const heading = page.getByRole('heading', { name: /^乗換難易度:/ });
  const expected = await heading.textContent();
  // 駅名が欠けると「乗換難易度:  ↔ 」になる。比べる前に、小文字の URL で駅名が出ていることを確かめる
  expect(expected).toMatch(/^乗換難易度: \S.* ↔ \S/);

  await page.goto(`/stations/${stationId.toUpperCase()}/connections/${connectedStationId.toUpperCase()}/transfer`);
  await expect(heading).toHaveText(expected!);
});
