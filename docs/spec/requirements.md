# 要件: 使われなくなった設備の対応フラグ・メモと廃止日の列を DROP する (Issue #217)

## 概要

- **対象**: `station_facilities.is_wheelchair_accessible` / `is_stroller_accessible` / `notes`、`stations.abolished_at`、`lines.abolished_at`
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #217](https://github.com/Natsugure/furatora/issues/217) /
  [PR #220](https://github.com/Natsugure/furatora/pull/220)（1段目）
- **進め方**: 1 つの PR（`chore/drop-unused-columns-217`）
- **信頼度**: 95%（高）。1段目で、5列を読み書きするコードはすでに無い

## 背景

PR #220（二段階の削除の1段目）で、5列をテーブル定義とコードから外した。DB の列は残っている。
この作業で列を落とし、テーブル定義と DB を一致させる。

## 要件（EARS）

- **REQ-1** マイグレーションを流したとき、システムは5列を DROP し、ほかの列・テーブルを変えないこと
- **REQ-2** システムは、1段目のコードが Web・Admin の両方で本番に出たあとでだけ、マイグレーションを流すこと（PR のマージ前に確かめる）
- **REQ-3** 列を落としたあとも、Admin の駅レイアウト編集と Web の駅ページのホーム図が動くこと

## 対象外

- 場所メモの Web 表示（#218）
- 駅の新規作成でメモが保存されない不具合（#219）
