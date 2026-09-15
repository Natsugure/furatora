import { test, expect } from '@playwright/test';

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

/**
 * 駅一覧の「管理」リンクから stationId を得る（路線指定版）。
 * 同名駅が複数路線にまたがる場合（例: 表参道は東京メトロ銀座線・半蔵門線・千代田線の
 * 3行に分かれる）に、目的の路線の行を一意に選ぶために使う
 */
async function findStationIdByLine(
  page: import('@playwright/test').Page,
  query: string,
  lineName: string,
): Promise<string> {
  await page.goto('/stations');
  await page.getByRole('link', { name: /東京メトロ/ }).click();
  await page.getByLabel('検索').fill(query);
  await page.waitForURL(/q=/);
  const row = page.getByRole('row', { name: new RegExp(query) }).filter({ hasText: lineName });
  const href = await row.getByRole('link', { name: '管理' }).first().getAttribute('href');
  const match = href?.match(/\/stations\/([^/]+)\/layout/);
  if (!match) throw new Error(`駅「${query}」（${lineName}）の管理リンクが見つからない: ${href}`);
  return match[1]!;
}

test('駅レイアウトページが表示され、ホームタブで切り替えられる', async ({ page }) => {
  const stationId = await findStationId(page, '渋谷');

  await page.goto(`/stations/${stationId}/layout`);
  await expect(page.getByRole('heading', { name: '渋谷' })).toBeVisible();

  // ホームタブが1つ以上表示される（駅にホームが登録されていれば）
  const platformTabs = page.getByRole('link', { name: /番線$/ });
  const tabCount = await platformTabs.count();
  if (tabCount > 1) {
    // 2つ目のタブに切り替えるとURLの platformId が変わる
    await platformTabs.nth(1).click();
    await expect(page).toHaveURL(/platformId=/);
  }
});

test('不正なUUIDの platformId を渡しても500にならず先頭ホームにフォールバックする', async ({ page }) => {
  const stationId = await findStationId(page, '渋谷');

  const response = await page.goto(`/stations/${stationId}/layout?platformId=not-a-uuid&patternId=also-invalid`);
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: '渋谷' })).toBeVisible();
});

test('存在しない駅IDは404になる', async ({ page }) => {
  // next dev は notFound() 後もステータス200を返すため、404ページの内容で判定する
  await page.goto('/stations/00000000-0000-0000-0000-000000000000/layout');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});

test('UUID形式でない駅IDは500にならず404になる', async ({ page }) => {
  const response = await page.goto('/stations/not-a-uuid/layout');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});

test('駅一覧の「管理」リンクは /layout を指す', async ({ page }) => {
  const stationId = await findStationId(page, '渋谷');
  const href = await page.getByRole('link', { name: '管理' }).first().getAttribute('href');
  // 一覧の絞り込み状態（この経路では operatorId・q）を戻り先復元用にクエリで運ぶため、
  // パス部分だけを比較する（stations-list.spec.ts が状態保持そのものを検証する）
  expect(href).toMatch(new RegExp(`^/stations/${stationId}/layout(\\?|$)`));
});

test('旧ルート（/facilities、/platforms/new）は削除済みで404になる', async ({ page }) => {
  const stationId = await findStationId(page, '渋谷');

  await page.goto(`/stations/${stationId}/facilities`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();

  await page.goto(`/stations/${stationId}/platforms/new`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});

// 反転編成（carNumber昇順でxが減少する編成。docs/domain/train-stop-patterns.md
// 「隣接号車は境界を共有する」参照）でのドラッグ編集。表参道 東京メトロ半蔵門線3番線が
// development に存在する唯一の反転編成データ（2026-09-14確認）。PR3で発覚した
// バグ（editDraft.ts の moveCarBoundary/moveCarEdge と DiagramEditLayer.tsx の
// ハンドル配置が非反転前提で書かれており、反転編成で図上編集すると無関係な号車の
// 座標を書き換えて編成を破壊する）の再発を防ぐための回帰テスト。
// 保存はせず（ページ遷移で破棄）、development のデータへは書き込まない
test('反転編成のホームでドラッグしても無関係な号車の境界は変化しない（表参道 東京メトロ半蔵門線3番線）', async ({ page }) => {
  const stationId = await findStationIdByLine(page, '表参道', '半蔵門線');
  await page.goto(`/stations/${stationId}/layout`);
  await page.getByRole('link', { name: '3番線' }).click();
  await page.waitForURL(/platformId=/);
  await expect(page.getByRole('heading', { name: '表参道' })).toBeVisible();

  // 反転編成であることの前提確認: 1号車の先頭のx座標が、最終号車の末尾より大きい
  // （非反転ならこの大小関係は逆になる）
  const leadHandle = page.getByRole('slider', { name: /^1号車の先頭/ });
  const tailHandle = page.getByRole('slider', { name: /号車の末尾/ });
  await expect(leadHandle).toBeVisible();
  const leadValue = Number(await leadHandle.getAttribute('aria-valuenow'));
  const tailValue = Number(await tailHandle.getAttribute('aria-valuenow'));
  expect(leadValue).toBeGreaterThan(tailValue);

  // ドラッグ対象の境界と、無関係なはずの境界（センチネル）の値を保存
  const targetHandle = page.getByRole('slider', { name: /5号車と6号車の境界/ });
  const sentinelHandles = [
    page.getByRole('slider', { name: /1号車と2号車の境界/ }),
    page.getByRole('slider', { name: /9号車と10号車の境界/ }),
  ];
  await expect(targetHandle).toBeVisible();
  const beforeTarget = await targetHandle.getAttribute('aria-valuenow');
  const beforeSentinels = await Promise.all(
    sentinelHandles.map((h) => h.getAttribute('aria-valuenow')),
  );

  await targetHandle.scrollIntoViewIfNeeded();
  const box = await targetHandle.boundingBox();
  if (!box) throw new Error('境界ハンドルの位置が取得できない');
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX - 30, centerY, { steps: 5 });
  await page.mouse.up();

  // ドラッグした境界は変化し、他の号車の境界は無変化のまま保たれること
  await expect(targetHandle).not.toHaveAttribute('aria-valuenow', beforeTarget ?? '');
  for (const [i, sentinel] of sentinelHandles.entries()) {
    await expect(sentinel).toHaveAttribute('aria-valuenow', beforeSentinels[i] ?? '');
  }
});
