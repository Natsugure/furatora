# 実装タスク: line_directions の代表駅・終点駅の除去 — 1段目 (Issue #129)

- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **ブランチ**: `feat/issue129-line-directions-drop-representative`（`feat/issue136-drop-legacy-difficulty-columns` から作成）
- **前提**: #136（PR #142）のマイグレーション 0015 の上に積む

## フェーズ1〜2: 分析・設計

- [x] **TASK-1** 両列の読み書き箇所と、`line_directions` の全列 SELECT（Web `stationDetailQuery`・Admin の一覧・API の GET・`lineEditPageQuery`）を確認する
- [x] **TASK-2** 開発者確認（2026-09-30）: 1段目で `schema.ts` から消す方式（決定1）。ADR にせず CLAUDE.md に補足する。Issue #129 の本文を修正する
- [x] **TASK-3** `docs/spec/` の3点セットを本 Issue 用に全面的に書き換える

## フェーズ3: 実装

- [ ] **TASK-4** `schema.ts` から2列を削除し、`drizzle-kit generate --custom` で `0016` を作って `DROP NOT NULL` を書く（依存: なし）
- [ ] **TASK-5** Admin の zod・ports・Repository・Query・フォーム・一覧・ページから2項目と `stations` を外す。テストを更新する（依存: TASK-4）
- [ ] **TASK-6** CLAUDE.md の二段階ルールに補足する

## フェーズ4: 検証

- [ ] **TASK-7** `pnpm run typecheck` / `lint` / `test` / `build`。2項目の参照が残っていないこと。`db:generate` を試しに実行すると DROP ×2 だけが出ること（生成物は破棄する）
- [ ] **TASK-8** 開発者が development に `db:migrate` を適用する。Neon MCP で `NOT NULL` が外れ、行数・値が変わらないことを確認し、
      Admin の方面の作成・編集・一覧、Web の駅詳細を確認する

## フェーズ5〜6: 振り返り・引き渡し

- [ ] **TASK-9** `docs/domain/line-directions.md` を更新する。ADR の変更が無いことを確認する
- [ ] **TASK-10** 2段目の Issue を起票し、PR を作成する（base は PR #142 のマージ前は `feat/issue136-drop-legacy-difficulty-columns`）
