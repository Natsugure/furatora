# 要件: Admin のパスパラメータを UUID か確かめ、小文字にそろえる (Issue #108・#160)

## 概要

- **対象**: Admin の動的ルート（`apps/admin/src/app` 配下の `[xxxId]` を持つ Page と Route Handler）
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #108](https://github.com/Natsugure/furatora/issues/108) / [Issue #160](https://github.com/Natsugure/furatora/issues/160)
- **進め方**: 1 つの PR（`fix/issue108-uuid-path-params`）で両方を閉じる
- **信頼度**: 92%（高）。直し方は先に直した 2 か所（`stations/[stationId]/layout/page.tsx`、駅対の乗換の Page・Route Handler）と同じで、それを全ルートに広げるだけ。不確かな点は、ルートごとに別の層が検証しているかどうか（着手時に確かめた。下の「現状」）

## 背景

### #108

パスパラメータを UUID か確かめずに `eq(table.id, param)` へ渡しているため、`/stations/not-a-uuid/edit` のような URL では Postgres が `invalid input syntax for type uuid` を返す。
Page は 500 のエラーページになり、Route Handler は `catch` で 500 を返す。存在しない ID なので 404 が正しい。

### #160

駅対の乗換の編集画面を大文字の駅 ID の URL で開くと、駅名が空になる。uuid 型の列は大文字小文字を区別しないので DB の絞り込みは一致するが、
`transferPairEditPageQuery` の `stationName` の Map は DB が返す小文字の id をキーにしているため、大文字の id で引くと外れる。

Issue は Map の側を直す案だったが、入口（#108 で全ルートに入れる検証）で小文字にそろえれば、この Map も、
同じ形の Map が他の Query にあっても、まとめて直る（2026-10-25 に開発者と決めた）。

### 現状（2026-10-25 時点）

Issue #108 の一覧のうち、次のルートはもう無い:
`stations/[stationId]/facilities/**`、`stations/[stationId]/platforms/new`、`stations/[stationId]/platforms/[platformId]/edit`、`stations/[stationId]/platforms/[platformId]/stop-patterns/**`、
`api/station-connections/[connectionId]`、`api/stations/[stationId]/platform-locations/[locationId]/duplicate`。

いまあるのは Page 12 件、Route Handler 18 件（メソッド 28 個）。どれも、パスパラメータを Query や Drizzle に渡す前に検証する層は無い。
すでに検証している 3 件（`layout/page.tsx`、駅対の乗換の Page・Route Handler）も、検証の戻り値を捨てて元の値を下に渡している。

あわせて、`stations/[stationId]/connections/new/page.tsx` は `?operatorId=`・`?lineId=` を検証せずに Query へ渡していて、不正な値で 500 になる（#108 と同じ種類の不具合のため、ここで直す）。

## 要件（EARS）

- **REQ-1**: Page のパスパラメータが UUID の形でない場合、システムは 404 のページを返すこと（500 にしない）
- **REQ-2**: Route Handler のパスパラメータが UUID の形でない場合、システムは DB に問い合わせず、ステータス 404 と `{ error: 'Not found' }` を返すこと
- **REQ-3**: パスパラメータが大文字を含む UUID のとき、システムは小文字にそろえた値で Query・Repository を呼び、画面に出す href もその値で作ること
- **REQ-4**: 駅対の乗換の編集画面を大文字の駅 ID の URL で開いたとき、システムは自駅・相手駅の駅名と、接続の表示の駅名を、小文字の URL で開いたときと同じに表示すること（#160）
- **REQ-5**: `parseUuidParam` は、UUID の形の値を小文字にして返すこと。クエリ文字列の UUID（`?operatorId=` など）にも同じく効く
- **REQ-6**: 乗換接続の追加画面の `?operatorId=`・`?lineId=` が UUID の形でない場合、システムはその値を未指定として扱い、画面を開くこと（500 にしない）

## 対象外

- `api/auth/[...nextauth]`
- Web（`apps/web`）のルート。Web のパスは slug で、uuid の列には渡らない
- 既存の 404 の扱い（UUID の形だが存在しない ID）。いまの各ルートのとおり

## エッジケース

| 入力 | 期待 |
|---|---|
| `not-a-uuid` | 404 |
| 空文字（`/api/lines//directions` のようなパスは Next.js が別ルートに解決するので、実際には来ない） | ヘルパーは null を返す |
| 大文字の UUID | 小文字にして通す |
| 2 つのパラメータの片方だけ不正 | 404 |
| 形は正しいが存在しない UUID | これまでどおり（各ルートの 404） |
