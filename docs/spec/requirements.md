# 要件: 停車位置パターンを「1号車の外側の端＋向き」で持ち、号車の区間は号車構成から導く (Issue #215)

## 概要

- **対象**: `train_stop_patterns` / `train_stop_pattern_cars`、Admin の駅レイアウト編集、Web・Admin の停車位置の読み取り
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #215](https://github.com/Natsugure/furatora/issues/215) /
  [ADR-0025](../adr/0025-stop-pattern-as-car-one-anchor.md)
- **進め方**: 二段階の1段目（`refactor/stop-pattern-anchor-215`）。`train_stop_pattern_cars` の DROP と `NOT NULL` 化は2段目の PR（#224）
- **信頼度**: 85%（中〜高）。本番の全パターンが新しい形へ損失なく移せることを確かめた。Admin の編集 UI の変更範囲が広い

## 背景

列車の両数を減らしても、停車位置パターンの号車（`train_stop_pattern_cars`）は作り直されず、列車に無い号車が図に残る。
原因は、パターンが号車ごとに独立した区間を持っていることにある。号車の長さは列車の属性（`trainCarStructures.carLength`）で、
駅ごとに変わることはない。パターンが持つべきなのは「編成をどこに、どちら向きに置くか」だけである。

本番（2026-11-06、Neon main）の 42 パターン・266 号車行は、どれも号車の長さが `COALESCE(carLength, 20.0)` と一致し、
号車構成と号車の数が食い違うパターンも無かった。

## 要件（EARS）

- **REQ-1** システムは、停車位置パターンに「1号車の外側の端の座標」と「号車番号が増えていく向き（`plusX` / `minusX`）」だけを保存すること
- **REQ-2** 停車位置パターンを読むとき、システムは号車の区間を列車の号車構成（`carLength`、未指定なら 20m）から算出すること
- **REQ-3** 列車の両数・号車構成を変えたとき、システムは、そのあとに読むパターンの号車を新しい号車構成に合わせること。1号車の位置は変えないこと
- **REQ-4** 列車に号車構成が1件も無い場合、システムは `carCount` 両の標準構成（20m）として区間を算出すること
- **REQ-5** 既存のパターンを移したとき、システムは、算出した区間を移す前の `train_stop_pattern_cars` と一致させること
- **REQ-6** Admin で停車位置を編集するとき、システムは編成全体の平行移動だけを許し、号車の長さを変える操作を出さないこと
- **REQ-7** 基準点の座標が ±9999.99 を超える場合、システムは保存を 400 で拒むこと
- **REQ-8** 基準点を持たないパターン（2段目の前に旧コードが書いた行）の場合、システムはそのパターンを表示しないこと

## 対象外

- `train_stop_pattern_cars` の DROP、新しい列の `NOT NULL` 化（2段目）
- 方面別のパターン（`docs/domain/train-stop-patterns.md`「現在の制約」）
