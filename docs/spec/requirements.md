# 要件: 設備コードの定数と facility_types・seed の一致を仕組みで守る (Issue #139)

## 概要

- **対象**: 設備コードの一覧を定数 `FACILITY_TYPE_CODES` に一本化し、DB（`facility_types` の CHECK 制約）と seed（型）をそれに従わせる。あわせて `@furatora/database/enums` をディレクトリにし、`packages/database` に ESLint を入れる
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #139](https://github.com/Natsugure/furatora/issues/139) /
  [ADR-0015](../adr/0015-shared-domain-packages-and-vocabulary.md) / ADR-0011 / ADR-0012
- **ブランチ**: `refactor/issue139-facility-type-codes`
- **信頼度**: 85%（高〜中）
  - 方針は Issue と ADR-0015 で決まっている
  - 未確定は `db:push` が CHECK 制約を毎回差分と誤認するかどうかだけ。development で確かめる

## 背景

設備コードの一覧は3か所にあり、一致しているかは人が確かめるしかない。

1. 定数 `FACILITY_TYPE_CODES`（`packages/transfer-difficulty`）
2. `facility_types` テーブル
3. seed

定数に無いコードが DB に入ると、問題が2つ起きる。

- Web と Admin は、そのコードを `isFacilityCode` で黙って捨てる。そのため、誤った案内を出しうる
- Admin では、そのルートの駅対を開いて保存しただけで、そのコードの行が消える

## 要件（EARS記法）

- **REQ-1**: システムは、設備コードの一覧を `@furatora/database/enums` の `FACILITY_TYPE_CODES` の1か所だけで定義すること
- **REQ-2**: 定数に無いコードを `facility_types.code` に INSERT / UPDATE した場合、DB は CHECK 制約で拒否すること
- **REQ-3**: 定数を変更して `db:generate` を実行したとき、システムは CHECK 制約を作り直すマイグレーションを生成すること。変更が無ければ生成しないこと
- **REQ-4**: システムは、`transfer_route_facilities.type_code`・`station_facilities.type_code`・`facility_types.code` を読むときの型を `FacilityTypeCode` にすること
  - Web と Admin は、`isFacilityCode` でコードを絞り込まないこと
- **REQ-5**: 定数にあって seed の表示名に無いコードがある場合、システムはコンパイルエラーにすること
- **REQ-6**: Admin の駅レイアウトの保存に定数に無い設備コードが含まれる場合、システムは入力検証で拒否すること
- **REQ-7**: `src/enums/` 配下のファイルが `drizzle-orm`・`../schema`・`../client`・`../tx`・`@furatora/database` を import した場合、システムは lint エラーにすること
- **REQ-8**: システムは、`@furatora/database/enums` を唯一の入口に保つこと。`@furatora/transfer-difficulty/domain` から `FACILITY_TYPE_CODES` / `FacilityTypeCode` を export し続けること
- **REQ-9**: `typecheck` / `lint` / `test` / `build` を実行したとき、システムはすべて成功すること。`build` は DB に触れないこと

## エッジケース

| ケース | 扱い |
|---|---|
| 値を `${}` や `inArray` で埋め込む | drizzle-kit が `IN ($1, …)` を出力し、マイグレーションが壊れる。`sql.raw` でリテラルとして展開する |
| PostgreSQL が `IN (...)` を `= ANY (ARRAY[...])` に変換して保存する | `db:push` が毎回差分と誤認するかもしれない。development で確かめる |
| 既存の環境に、定数に無いコードの行がある | 制約の追加が失敗する。main と development に無いことを SELECT で確認した（7コード） |
| 定数にコードを足し、`facility_types` への INSERT を忘れる | CHECK では検出できない。Admin の保存時に外部キーのエラーになる（黙って誤判定はしない） |
| 子テーブル（`transfer_route_facilities` / `station_facilities`）に未知のコードを入れる | 外部キーで `facility_types` を参照しており、親の CHECK だけで防げる |
