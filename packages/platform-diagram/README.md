# @furatora/platform-diagram

ホーム図（SVG + HTML オーバーレイ）の domain 純関数と描画コンポーネント。
`apps/web`（公開表示）と `apps/admin`（編集ビュー）の両方から使われる。

詳細な設計・座標系の定義は以下を参照:

- [ADR-0006](../../docs/adr/0006-diagram-text-in-html-overlay.md) — レイヤ構成
- [ADR-0010](../../docs/adr/0010-platform-diagram-package-edit-layer.md) — このパッケージへの切り出し理由
- [`docs/domain/platform-coordinate-system.md`](../../docs/domain/platform-coordinate-system.md) — 座標系

## 依存の制約

このパッケージは **Next.js にも `@furatora/database` にも依存しない**（`eslint.config.mjs`
で機械的に強制）。`apps/web` / `apps/admin` の両方から import されるため、
どちらかのアプリ固有の型・APIに依存すると他方が壊れる。

## 公開面

```ts
import { computeBounds, layoutRows, xFraction, /* ... */ } from '@furatora/platform-diagram/domain';
import { PlatformDiagram } from '@furatora/platform-diagram/components';
import '@furatora/platform-diagram/styles.css'; // layout.tsx で1回だけ import する
```

**利用側の `globals.css` に `@source` の追加が必須。** Tailwind v4 の自動ソース検出は
利用側アプリ（`apps/web`・`apps/admin`）を起点に走り、`packages/` 配下までは辿らない。
`PlatformDiagram` 等が使う Tailwind ユーティリティ（`rounded-3xl` 等）を生成させるため、
`@import "tailwindcss";` の直後に以下を追加すること（無いと図のスタイルが無言で消える）。

```css
@source "../../../../packages/platform-diagram/src";
```

**`next/font` の変数クラスは `<body>` ではなく `<html>` に付けること。** `styles.css` の
`--font-sign` は `:root` で宣言されており、中の `var(--font-biz-udpgothic)` は `:root`
時点で解決される。変数クラスを `<body>` に付けると `:root` では未定義のままになり、
`--font-sign` 宣言全体が無効値になる（サイン書体が無言で既定フォントにフォールバック
する。Issue #107）。

```tsx
// layout.tsx
<html lang="ja" className={bizUdpGothic.variable}>
  <body>{/* ... */}</body>
</html>
```

**web はこの `styles.css` を import していない。** `--sign-*` 等5トークンは
`apps/web/src/app/globals.css` に web 全体の基盤トークンとして既に定義されており
（下記「CSS変数について」参照）、`--font-sign` も web 側で自前定義している。
`styles.css` を実際に import して恩恵を受けるのは admin のみ。

## アイコンの複製について

`DiagramSvg` は設備アイコンを `<img>`/`<image>` の `href` で参照する。Next.js の
`public/` はアプリごとに独立配信されるため、パッケージからアイコンを配信することは
できない。**`iconBasePath` prop（既定値 `/icons`）で配信元を注入する**ので、
このパッケージを使う各アプリは自分の `public/icons/` に以下の6ファイルを置くこと。

```
elevator.png, escalator.png, stairs.png, wheelchair_ramp.png, stair_lift.png, wheelchair.png
```

`apps/web/public/icons/` にあるものと同一のファイルを `apps/admin/public/icons/` にも
複製している。将来アイコンを更新するときは両方を更新すること。

## CSS変数について

`styles.css` はホーム図が使うトークン（`--sign-*` / `--color-train-car-*` /
`--color-free-*` 等）を**解決済みの具体値**で定義する。`apps/web/src/app/globals.css`
にある primitive scale（`--gray-*` 等）を参照しないのは、admin がweb全体の
デザイントークンを取り込まずに済むようにするため。

うち5つ（`--color-bg-card` / `--color-border-default` / `--color-border-strong` /
`--color-text-primary` / `--color-text-secondary`）は web 全体の基盤トークンでもあり
（`body` の背景色・文字色に使われる）、`globals.css` からは削除していない。値が
完全に一致する解決済みコピーとして両方に存在する。

## 引き出し線の経路

`layoutConcoursePlates()` が返す `ConcoursePlateGroup.route` は、深いレーンのプレートへ
降りる引き出し線が手前のレーンをどう通るかを持つ（`domain/leaderRoute.ts`）。
`segments` は lane 0..lane-1 の通過区間、`arrivalFraction` は自レーン上端への到達位置で、
値はすべて描画範囲に対する割合（`xFraction()` と同じ）。`ConcoursePlateRow` が
縦線（z 0）・プレート（z 1）・余白帯の横線（z 2）の3レイヤに描き分ける。

## テスト

`src/domain/*.test.ts` は Vitest（`pnpm --filter @furatora/platform-diagram test`）。
純関数のみで DOM に依存しないため `environment: 'node'` で実行する。
