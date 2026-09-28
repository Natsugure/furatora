# 実装タスク: station_connections の旧4列と難易度 enum の削除 (Issue #136)

- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **ブランチ**: `feat/issue136-drop-legacy-difficulty-columns`（`develop` から作成）
- **前提**: #125 が `main` にリリース済み（2026-09-28 に確認）

## フェーズ1〜2: 分析・設計

- [x] **TASK-1** 旧4列・enum 型の参照箇所と、`stationConnections` の SELECT / INSERT / DELETE の形を確認する
- [x] **TASK-2** `docs/spec/` の3点セットを本 Issue 用に全面的に書き換える

## フェーズ3: 実装

- [x] **TASK-3** `schema.ts` から4列と enum 型の import を、`enums.ts` から2型を削除する（依存: なし）
- [x] **TASK-4** `pnpm run db:generate` でマイグレーションを生成し、DROP COLUMN ×4 だけであることを確認する（依存: TASK-3）。
      結果: `0015_drop_legacy_transfer_difficulty.sql`。0011 に倣い、削除が安全な理由を冒頭のコメントに書いた
- [x] **TASK-5** Admin のテスト・コメント、`packages/database/CLAUDE.md` を更新する（依存: TASK-3）

## フェーズ4: 検証

- [x] **TASK-6** `pnpm run typecheck` / `lint` / `test` / `build` が通ること。旧4列・enum 型の参照が残っていないこと。
      結果（2026-09-29）: typecheck 6・lint 4・build 2 タスク成功、test は admin 625・platform-diagram 203・
      transfer-difficulty 55・frontend 42 が成功。参照は `schema.ts` の削除済みの注記のみ
- [x] **TASK-7** 開発者が development に `db:migrate` を適用する。Neon MCP で列が消え行数が変わらないことを確認し、
      Admin の接続の追加・削除と Web の駅詳細を確認する。
      結果（2026-09-29）: 適用済みマイグレーション 15→16、`station_connections` は 10列→6列・6,950行のまま。main は15件・10列のまま。
      Admin の API で淡路町↔神田（銀座線）の接続を作成（201・有向2行・`manual`）→ 削除（200）し、6,950行・接続60・ルート21 に戻った。
      Admin の駅編集・レイアウト・駅対の編集画面が 200 で表示され、Web の淡路町は乗換先5件と評価を表示した。
      Web のホーム図でハイドレーションの不一致（`FreeSpaceBadges` の `<title>`）がコンソールに出たが、本変更の対象外

## フェーズ5〜6: 振り返り・引き渡し

- [x] **TASK-8** `docs/domain/station-master-model.md` の凍結の記述を削除する。ADR の変更が無いことを確認する。
      あわせて「乗換難易度」の適用状況を本番反映済みに上書きした（Neon MCP で main に 0000〜0014 の15件・接続60・ルート21 を確認）
- [x] **TASK-9** PR（base: `develop`）を作成する。デプロイ中は Admin で接続を追加しない旨を書く 結果: #142
