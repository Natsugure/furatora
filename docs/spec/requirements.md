# 要件: web のフォント変数クラス位置を修正する (Issue #107)

## 概要

- **対象**: `apps/web`、`packages/platform-diagram`
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) /
  [ADR-0006](../adr/0006-diagram-text-in-html-overlay.md) /
  [ADR-0010](../adr/0010-platform-diagram-package-edit-layer.md)
- **作成日**: 2026-09-18
- **ブランチ**: `fix/issue107-font-variable-class-on-html`
- **信頼度**: 95%（高）— 原因は CSS カスケードの既知の挙動（`var()` は宣言時点で
  解決される）で確定しており、admin 側（PR #105）で同型の修正実績がある。

## 背景

PR #105 のコードレビューで、ホーム図のサイン用書体（BIZ UDPGothic）が `apps/web` で
適用されていないことが判明した。`next/font` のフォント変数クラスが `<body>` に付いており、
それを参照する `--font-sign` は `:root` で宣言されているため、`var()` の解決に失敗し
宣言全体が無効値になる。同じ問題を持つ admin 側は PR #105 で先に修正済み。

調査の結果、本文書体（`--font-sans` / Noto Sans JP）も同じ原因で無効化されており、
かつ `body` の `font-family` 宣言が Mantine の既定フォントも上書きしているため、
web の本文は現状ブラウザ既定フォントで描画されていることを確認した（詳細は design.md）。

## 要件（EARS記法）

- **REQ-1**: `apps/web` のいずれのページが読み込まれたときも、システムは
  `document.documentElement`（`<html>`）に `next/font` の書体変数クラス
  （`--font-noto-sans-jp` / `--font-biz-udpgothic`）を適用すること。
- **REQ-2**: ホーム図のサイン要素（号車番号・出口プレート・乗換プレート・対面乗換バナー）が
  描画されたとき、システムはそれらの `font-family` の解決結果（Rendered Fonts）を
  BIZ UDPGothic とすること。
- **REQ-3**: web の本文（`<body>` 配下の通常テキスト）が描画されたとき、システムは
  `font-family` の解決結果を Noto Sans JP とすること。
- **REQ-4**: `--font-sign` および `--font-sans` の宣言において、参照先の書体変数が
  何らかの理由で未定義であった場合、システムは宣言全体を無効値にするのではなく、
  後続のフォールバック書体（`"BIZ UDPGothic"` 等の汎用名指定）へ処理を継続すること。

## 対象外

- `--font-sign` の二重定義（`apps/web/globals.css` と
  `packages/platform-diagram/src/styles.css`）の統合。`apps/web` は
  `packages/platform-diagram/styles.css` を import しておらず、現状は import 順の
  衝突が発生していないため、開発者確認のうえ本 Issue のスコープ外とした
  （コメント整備のみ行う）。
