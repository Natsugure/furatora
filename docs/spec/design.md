# 設計: web のフォント変数クラス位置を修正する (Issue #107)

## 参照

[requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 原因

`apps/web/src/app/layout.tsx` で `next/font` のフォント変数クラス（`notoSansJP.variable` /
`bizUdpGothic.variable`。それぞれ `--font-noto-sans-jp` / `--font-biz-udpgothic` を定義する）が
`<body>` に付いていた。一方、それらを参照する CSS カスタムプロパティは `:root`
（= `<html>`）で宣言されている。

CSS カスタムプロパティの値に含まれる `var()` は、**宣言した要素の時点で解決される**。
`:root` の時点では `--font-biz-udpgothic` も `--font-noto-sans-jp` も未定義であり、
`var()` にフォールバック（第2引数）も無かったため、参照元の宣言全体が無効値になり、
その無効値が子孫要素へ継承されていた。

### 影響範囲（調査で確定）

| 対象 | 参照元 | 実装 |
|---|---|---|
| ホーム図のサイン（号車番号・出口/乗換プレート・対面乗換バナー） | `--font-sign`（`globals.css`） | `DiagramSvg.tsx:232` / `ConcoursePlateRow.tsx:46` / `FacingTransferBannerRow.tsx:31` |
| web 本文 | `--font-sans`（`globals.css` の `@theme inline`） | `body { font-family: var(--font-sans) }`（`globals.css:202`） |

`--font-sans` は `@theme inline` 内で宣言されているが、Tailwind v4 はこれをビルド時に
`:root` へ出力する（ビルド済みCSSで実測: `@layer theme{:root,:host{--font-sans:var(--font-noto-sans-jp),...}}`）。
そのため `--font-sign` と同じ理由で無効値になる。

さらに、`@mantine/core/styles.css` は `body,:host { font-family: var(--mantine-font-family) }`
を持つが、`globals.css` の `body { font-family: var(--font-sans) }` が後から読み込まれ
上書きする。無効値になった `var()` 宣言は「無視されて前の宣言が生きる」のではなく
`unset`（＝親要素からの継承。`<body>` の親は `<html>` で、`<html>` にも書体指定が
無いためブラウザ既定フォントに落ちる）として扱われる。したがって修正前の web は
**本文がブラウザ既定フォントで描画されている**状態だった。

### 二重定義（issue 記載の修正方針3）について

issue 本文は「`--font-sign` が `apps/web/globals.css` と
`packages/platform-diagram/src/styles.css` の2箇所で定義され、どちらが勝つかは
import 順で決まる」としていたが、調査の結果 `apps/web` は
`@furatora/platform-diagram/styles.css` を **import していない**ことを確認した
（`apps/web/src/app/layout.tsx` に import 文なし。`packages/platform-diagram/README.md`
にも「`styles.css` を実際に import して恩恵を受けるのは admin のみ」と明記されている）。
そのため import 順の衝突は現状発生しておらず、統合は本 Issue のスコープ外とし、
両ファイルのコメントを揃える対応に留める（開発者確認済み）。

## 修正内容

### 1. 変数クラスの付け替え（根本原因の除去）

`apps/web/src/app/layout.tsx` の `<html>` に書体変数クラスを付け、`<body>` からは外す。
Tailwind ユーティリティクラス（`font-sans` 等）は `<body>` に残す。

```tsx
<html lang="ja" className={`${notoSansJP.variable} ${bizUdpGothic.variable}`}>
  <body className="font-sans antialiased flex flex-col min-h-screen">
```

admin（`apps/admin/src/app/layout.tsx`、PR #105 で対応済み）と同じパターンにする。

### 2. `var()` へのフォールバック追加（防御的修正）

`--font-sign` / `--font-sans` の `var(--font-biz-udpgothic)` /
`var(--font-noto-sans-jp)` に第2引数（汎用フォント名）を追加する。

```css
--font-sign: var(--font-biz-udpgothic, "BIZ UDPGothic"), "BIZ UDPGothic", ...
--font-sans: var(--font-noto-sans-jp, "Noto Sans JP"), system-ui, sans-serif;
```

これにより、将来また変数クラスの位置を誤っても、宣言全体が無効値になるのではなく
後続のフォールバック書体へ処理が継続する（REQ-4）。`--font-sign` は
`apps/web/src/app/globals.css` と `packages/platform-diagram/src/styles.css` の
両方に同じ修正を入れる。

### 3. コメント整備

- `packages/platform-diagram/src/styles.css` の `--font-sign` 定義に「変数クラスは
  `<html>` に付けること」を追記
- `packages/platform-diagram/README.md` の「公開面」節に、変数クラスの位置に関する
  利用側の必須手順と、web がこのファイルを import していない旨を追記

## ドメイン知識への影響

書体（BIZ UDPGothic / Noto Sans JP）の適用先はドメインルールではなく実装の詳細であり、
`docs/domain/` に該当する記述も無い。`docs/domain/` の更新は不要（詳細は tasks.md
「フェーズ5」参照）。

## エラーハンドリング

CSS の設定ミスであり、実行時エラーは発生しない（サイレントなスタイル欠落）。
本修正自体に新たなエラーケースは発生しない。

## 検証方針

Chrome DevTools で対象要素の Computed → Rendered Fonts を確認する（issue 記載の
確認方法）。加えて `document.fonts.check()` で next/font の webfont が実際に
ロードされていることも確認する（tasks.md「検証」参照）。
