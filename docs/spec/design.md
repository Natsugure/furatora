# 設計: Admin のパスパラメータを UUID か確かめ、小文字にそろえる (Issue #108・#160)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 方針

入口（Page・Route Handler の先頭）で、パスパラメータを丸ごと検証して小文字にそろえる。**その後は、検証の戻り値だけを使う。**
下の層（Query・Repository・ドメイン関数）は、受け取る ID が小文字の UUID であることを前提にしてよい。

## インターフェース

`apps/admin/src/shared/list/params.ts` に置く（`parseUuidParam` と同じ `uuidSchema` を使うため）。

```ts
/** UUID の形なら小文字にして返す。不正・未指定は undefined（既存。小文字化を足す） */
export function parseUuidParam(value: string | string[] | undefined): string | undefined;

/**
 * パスパラメータ（`await params` の結果）を丸ごと検証する。
 * すべて UUID の形なら、同じキーで小文字にした値を返す。1 つでも不正なら null。
 */
export function parseUuidParams<T extends Record<string, string>>(params: T): T | null;
```

- `shared/` は Next.js を import しない（ADR-0001、`params.ts` の冒頭コメント）。`notFound()` や `NextResponse` は呼び出し側で使う
- パラメータごとに `parseUuidParam` を並べる形をやめ、オブジェクトを丸ごと渡す形にしたのは、2 つ目のパラメータの検証漏れを防ぐため（駅対のルートは 2 つ並べて書いていた）

## 呼び出し側の形

Page:

```ts
const ids = parseUuidParams(await params);
if (!ids) notFound();
const { stationId } = ids;
```

Route Handler:

```ts
const ids = parseUuidParams(await params);
if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
const { operatorId } = ids;
```

- `await params` が `try` の外にあるルートは、検証も `try` の外に置く（`await params` が投げることはない）。中にあるルートは中に置く。どちらでも 404 は `catch` に落ちない
- `layout/page.tsx` と駅対の乗換の Page・Route Handler も、この形に置き換える

## #160 が直る理由

駅対の乗換の Page が `transferPairEditPageQuery.getContext()` に小文字の id を渡すようになるので、`stationName.get(stationId)` が DB の返す小文字のキーと一致する。
Query 側の Map は変えない。Query のテストに大文字の id のケースは足さない（入口で小文字にするので、その経路が無くなる）。代わりに、ヘルパーが小文字にすることをユニットテストで、画面の駅名を e2e で確かめる。

## エラーハンドリング

| 状況 | Page | Route Handler |
|---|---|---|
| パスパラメータが UUID の形でない | `notFound()` | 404 `{ error: 'Not found' }`。DB は呼ばない |
| 形は正しいが存在しない | これまでどおり（`notFound()`） | これまでどおり（404） |
| 乗換接続の追加画面のクエリ文字列が不正 | 未指定として画面を開く | — |

## テスト戦略

- `params.test.ts`: `parseUuidParam` の小文字化、`parseUuidParams` の全部正しい・片方不正・大文字・空オブジェクト
- Route Handler: テストファイルがあるルート（`operators/[operatorId]`、`trains/[trainId]`、`lines/[lineId]/directions/[directionId]`、`lines/[lineId]/directions`、`lines/[lineId]/adjacencies`、`stations/[stationId]/connections`、`stations/[stationId]/publication`）に、不正な UUID で 404 を返し DB を呼ばないケースを足す。テストファイルが無いルートは、ヘルパーのテストと、全ルートで同じ形に書くこと（レビューで目で揃いを確かめる）に頼る
- e2e（`station-layout.spec.ts` の既存の 404 のケースにならう）: 代表的な Page（`/stations/not-a-uuid/edit`、`/lines/not-a-uuid/edit`、`/trains/not-a-uuid/edit`）が 404 になる。駅対の乗換の画面を大文字の駅 ID で開き、駅名が出る

## 恒久知識の振り分け

- 「パスパラメータは入口で検証し、小文字にそろえて下に渡す」は Admin の実装の約束で、ドメインルールではない。`docs/domain/` には置かず、`parseUuidParams` のコメントに書く
- ADR にはしない（却下した案と比べて選んだ設計上の決定ではなく、既存の修正の形を全ルートに広げるだけ）
