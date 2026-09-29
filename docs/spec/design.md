# 設計: line_directions の代表駅・終点駅の除去 — 1段目 (Issue #129)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 変更対象

```
packages/database/src/schema.ts            lineDirections から2列を削除
packages/database/drizzle/0016_*           【新規・手書き】representative_station_id の DROP NOT NULL
apps/admin/src/
  lib/validations.ts                       directionSchema から2項目を削除（zod は未知のキーを捨てる）
  features/line/ports.ts                   LineDirectionWriteInput・LineDirectionEditContext から2項目と stations を削除、
                                           DirectionStationOption を削除
  external/repository/lineDirectionRepository.ts   returning の列から2項目を削除
  external/query/lineEditPageQuery.ts      getLineStations を削除（方面フォームの選択肢にしか使っていない）
  components/LineDirectionForm.tsx         代表駅・終点駅の入力欄と stations プロパティを削除
  app/lines/[lineId]/directions/page.tsx   代表駅の表示と駅の取得を削除
  app/lines/[lineId]/directions/new・[directionId]/edit/page.tsx   stations の受け渡しを削除
  各テスト                                  2項目・代表駅の選択を外す
CLAUDE.md                                  二段階ルールに Drizzle での 1段目の意味を補足
docs/domain/line-directions.md             モデル図から2列を外す、適用状況の更新
```

Web（`stationDetailQuery` の `line_directions` の全列 SELECT を含む）は変更しない。`schema.ts` から列が消えると、全列 SELECT は2列を読まなくなる。

## 決定

### 決定1: 1段目で `schema.ts` から列を消し、`NOT NULL` の解除は手書きマイグレーションで行う

- **コンテキスト**: Drizzle は `schema.ts` にある列を、全列 SELECT（`db.select().from(t)`）と INSERT の SQL に必ず含める。
  `schema.ts` に列を残したまま2段目で列を落とすと、2段目のデプロイ中（マイグレーション適用後〜新コードへの切り替え）に
  旧コードが消えた列を読み書きして失敗する。`line_directions` は Web の `stationDetailQuery` が全列 SELECT しているため、公開サイトの駅詳細も含む
- **オプション**:
  - (a) `schema.ts` から消す（本決定）。デプロイ中の障害が起きず、あとから全列 SELECT が書かれても壊れない。
    段階の間、`schema.ts` と Drizzle のスナップショットが食い違う
  - (b) `schema.ts` に `nullable` で残し、全列 SELECT を列の明示に直す。スナップショットは一致するが、
    2段目のデプロイ中に方面の INSERT が失敗し、全列 SELECT を書かない注意に頼る
- **理論的根拠**: CLAUDE.md の1段目は「その列を読まないコード」をデプロイすることであり、Drizzle では `schema.ts` に列がある時点で
  読み書きしている。(a) はルールの正しい読み方であって新しい決定ではないため、ADR にせず CLAUDE.md に補足する（開発者確認済み、2026-09-30）
- **影響**:
  - マイグレーションは `drizzle-kit generate --custom` で空のファイルを作って手で書く。スナップショットは直前と同じになり、両列が残る
  - 2段目では `pnpm run db:generate` が両列の `DROP COLUMN` を生成する
  - 1段目と2段目の間に `db:generate` / `db:push` を実行すると DROP が混ざる。2段目を次の作業にする
- **レビュー**: Drizzle が全列 SELECT・INSERT の列の出し方を変えたとき

### 決定2: 方面一覧の「代表駅」の表示は外す

- **コンテキスト**: 表示は1段目のあと NULL の行が増えて意味を失い、2段目で列が消える
- **理論的根拠**: 表示の値は ODPT 由来の書き込み専用のデータで、解決規則にも使われない（ADR-0014）
- **影響**: 一覧のカードから1行減る。駅の取得（`stations` への問い合わせ1回）も無くなる

## エラーハンドリング

新しいエラー経路は無い。API は2項目を受け取っても zod が捨てる（REQ-4）。

## テスト戦略

- 型検査で読み書きの取り残しを検出する（`schema.ts` から列が消えるため、参照は型エラーになる）
- `validations.test.ts`: 2項目なしでパースできる。2項目を送っても結果に含まれない
- `LineDirectionForm.test.tsx`: 代表駅・終点駅の入力が無い。送信内容に2項目が無い
- API ルート・Repository のテスト: 2項目を外して既存の期待が通る
- development: マイグレーション適用後に `NOT NULL` が外れ、行数と値が変わらないこと。方面の作成・編集・一覧、Web の駅詳細

## 恒久知識の振り分け

- CLAUDE.md の禁止事項: Drizzle での1段目の意味（決定1）。ADR にしない理由は決定1
- `docs/domain/line-directions.md`: モデル図から2列を外す。2段目までの適用状況を書く
