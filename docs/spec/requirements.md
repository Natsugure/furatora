# 要件: 停車位置パターンの基準点を NOT NULL にし、train_stop_pattern_cars を DROP する (Issue #224)

## 概要

- **対象**: `train_stop_patterns` / `train_stop_pattern_cars`、Web・Admin の停車位置の読み取り
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #224](https://github.com/Natsugure/furatora/issues/224) /
  [ADR-0025](../adr/0025-stop-pattern-as-car-one-anchor.md)
- **進め方**: 二段階の移行（CLAUDE.md「禁止事項」）の2段目。1段目は #215（PR #225）
- **信頼度**: 92%（高）。本番・development とも基準点が NULL の行は 0 件 / 全 42 件（2026-11-07）

## 背景

1段目で2列（`car_one_outer_meters` / `car_numbers_ascend_toward`）を nullable で足し、旧表 `train_stop_pattern_cars` を
テーブル定義から外した。読み取りは、基準点が NULL のパターン（1段目のデプロイ中に旧コードが作った行）を表示しない分岐を持っている。

## 要件（EARS）

- **REQ-1** マイグレーションが走るとき、システムは、基準点が NULL のパターンを旧表から埋めてから、2列を `NOT NULL` にすること
- **REQ-2** マイグレーションが走るとき、システムは `train_stop_pattern_cars` を DROP すること
- **REQ-3** 停車位置を読むとき、システムは、すべてのパターンの号車を基準点と号車構成から算出して表示すること（NULL の分岐を持たない）
- **REQ-4** システムは、Web と Admin の読み取りで「基準点を数値にする → 区間を算出する → 設備を添える」を同じ関数で行うこと（PR #225 レビュー指摘9）
- **REQ-5** 移行の前後で、システムは、Web・Admin の図の号車・ドア・設備の位置を変えないこと

## 対象外

- 停車位置パターンの形や編集 UI の変更
