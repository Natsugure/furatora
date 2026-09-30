# 要件: line_directions の代表駅・終点駅の除去 — 1段目 (Issue #129)

## 概要

- **対象**: `line_directions` の `representativeStationId` / `terminalStationIds` を、読み書きするコードと `schema.ts` から外し、
  DB の `representative_station_id` の `NOT NULL` を外す（二段階マイグレーションの1段目）。列の `DROP` は次のデプロイ（2段目）
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) /
  [Issue #129](https://github.com/Natsugure/furatora/issues/129) /
  `docs/domain/line-directions.md` / ADR-0014 / CLAUDE.md「禁止事項」（破壊的マイグレーションの二段階ルール）
- **ブランチ**: `feat/issue129-line-directions-drop-representative`（#136 のブランチ `feat/issue136-drop-legacy-difficulty-columns` から分岐。PR #142 のマージ後に base を `develop` へ付け替える）
- **信頼度**: 90%（高）。変更は削除が中心。不確実なのは手書きマイグレーションと Drizzle のスナップショットの扱いだけ

## 背景

両列は `schema.ts` の初期コミットからあり、ODPT の方面の代表駅に対応させる意図だったとみられる。ADR-0007 で ODPT 同期を止めたあと、
解決規則（ADR-0014）にも Web にも使われていない。現在の読み手は Admin の方面一覧の「代表駅」の表示と、方面フォームの初期値だけである。

Issue 本文との読み替え:

| Issue 本文 | 本書での扱い |
|---|---|
| 「読み取り側は存在しない」 | Admin の方面一覧が「代表駅」を表示している（本文の調査後に入った）。この表示も外す |
| 1段目で `representativeStationId` を `nullable()` にする | **`schema.ts` から両列を消す**。`NOT NULL` の解除は手書きマイグレーションで行う（design.md 決定1。Issue 本文も修正済み） |

## 要件（EARS記法）

- **REQ-1**: システムは、`schema.ts` の `lineDirections` に `representativeStationId` / `terminalStationIds` を持たないこと
- **REQ-2**: マイグレーションが適用されたとき、システムは `line_directions.representative_station_id` の `NOT NULL` を外し、列と既存の値は残すこと
- **REQ-3**: 管理者が方面を作成・更新するとき、システムは代表駅・終点駅の入力を求めないこと
- **REQ-4**: 代表駅・終点駅を含むリクエストが方面の API に送られたとき、システムはそれらを無視して処理すること
- **REQ-5**: 管理者が方面一覧を開いたとき、システムは代表駅を表示しないこと。それ以外の表示（表示名・既定・タイプ・備考）は変えないこと
- **REQ-6**: 方面の既定（`isDefault`）の設定・置き換え・409 の扱いは変えないこと
- **REQ-7**: Web の駅詳細の方面の表示は変えないこと
- **REQ-8**: `pnpm run build` は DB に触れないこと

## 対象外

- 両列の `DROP COLUMN`（2段目。次のデプロイ）
- ADR-0014 の本文（却下案「代表駅から組み立てる」の説明。ADR は不変）

## エッジケース

| ケース | 扱い |
|---|---|
| マイグレーション適用後、旧コードが稼働している間に方面を作成・更新する | 旧コードは代表駅を書くが、列は残っているので成功する |
| 1段目のデプロイ後に作られた方面 | `representative_station_id` は NULL になる（`NOT NULL` を外したため） |
| 1段目と2段目の間に、別の作業で `db:generate` / `db:push` を実行する | `schema.ts` から列が消えているので、両列の DROP が混ざる。間に挟まない（design.md 決定1） |
