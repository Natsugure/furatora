# 設計: 設備コードの定数と facility_types・seed の一致を仕組みで守る (Issue #139)

「定数が正で、DB と seed が従う」という決定と却下した案は [ADR-0016](../adr/0016-facility-type-codes-constant-as-source.md) に置く。
語彙の置き場は [ADR-0015](../adr/0015-shared-domain-packages-and-vocabulary.md) 決定3 による。ここには実装だけを書く。

## 変更するファイル

```
packages/database/src/enums.ts                      削除
packages/database/src/enums/{index,stationMaster,facility}.ts   新規（stationMaster は旧 enums.ts の中身）
packages/database/package.json                      "./enums" → ./src/enums/index.ts、lint スクリプトと ESLint の devDependencies
packages/database/eslint.config.mjs                 新規。src/enums/** の import を制限
packages/database/src/schema/platform.ts            facility_types に CHECK、code と station_facilities.type_code に $type
packages/database/src/schema/transfer.ts            transfer_route_facilities.type_code に $type
packages/database/drizzle/0018_*.sql と snapshot    db:generate で生成
packages/transfer-difficulty/src/domain/requirement.ts   定数を enums から import して再 export
apps/web/src/external/query/transferPartnerRows.ts(.test.ts)   isFacilityCode と未知のコードの扱いを削除
apps/admin/src/external/query/transferPairEditPageQuery.ts      isFacilityCode を削除
apps/admin/src/features/facility/schema.ts           typeCode を z.enum(FACILITY_TYPE_CODES) に
apps/scripts/src/seed-master-data.ts                 表示名を Record<FacilityTypeCode, string> に
```

## データの流れ

```
FACILITY_TYPE_CODES（@furatora/database/enums/facility.ts）
 ├─ schema/platform.ts の CHECK（sql.raw で展開）→ db:generate → マイグレーション → facility_types
 │     └─ 外部キー ← transfer_route_facilities.type_code / station_facilities.type_code
 ├─ $type<FacilityTypeCode>() → Drizzle が読む値の型
 ├─ seed の Record<FacilityTypeCode, string> → 新しい環境の facility_types
 └─ transfer-difficulty が再 export → Web / Admin の判定と入力検証
```

## CHECK 制約

```ts
check(
  'facility_types_code_known',
  sql`${t.code} IN (${sql.raw(FACILITY_TYPE_CODES.map((code) => `'${code}'`).join(', '))})`,
)
```

- `sql.raw` を使ってよいのは、値がコード内の定数（利用者の入力ではない）だからである
- 制約は親の `facility_types` だけに付ける。子は外部キーで守られる

## ESLint（packages/database）

`files: ['src/enums/**/*.ts']` に次を設定する。

```js
regex: '^(drizzle-orm(/.*)?|@furatora/database(/.*)?|\\.\\./(schema|client|tx)(/.*)?)$'
```

- `@furatora/database` 自身も禁止する。自分自身を経由して `schema` を読む抜け道になるため

## エラーマトリックス

| 状況 | 結果 |
|---|---|
| 未知のコードを `facility_types` に入れる | DB が CHECK 違反で拒否する |
| 未知のコードを子テーブルに入れる | DB が外部キー違反で拒否する |
| Admin の駅レイアウトの保存に未知のコードがある | zod の検証で 400 |
| Admin の駅対の保存に未知のコードがある | zod の検証で 400（既存の `z.enum(FACILITY_TYPE_CODES)`） |
| seed の表示名が欠ける | コンパイルエラー |

## 恒久知識の振り分け

- 「定数が正で、DB と seed が従う」と却下した案: ADR-0016（新規）
- CHECK 制約・外部キーで守っていることと、設備の種類を足すときの手順:
  - `docs/domain/station-master-model.md`（制約の表と「ルートと設備」）
  - `facility.ts` のコメント
- `src/enums/` の構成と ESLint で守っていること: `packages/database/CLAUDE.md` と `.github/instructions/drizzle.instruction.md`
- `db:push` の挙動（確認の結果）: 問題があれば `docs/domain/` と `packages/database/CLAUDE.md` に書く

## テスト戦略

- 既存のテスト（`requirement.test.ts` が、規則の表と定数の一致を見ている）はそのまま通す
- `transferPartnerRows.test.ts` から、未知のコードのテスト（型の上で書けなくなる）を消す
- ESLint の発火確認: `eslint --stdin --stdin-filename src/enums/facility.ts` で、禁止した import がエラーになり、`./stationMaster` が通ること
- `db:generate` を2回実行し、1回目が CHECK の ADD だけ、2回目が差分なしになること
- 開発者が development で `db:migrate` → `db:push` を実行し、push が差分を出さないこと
