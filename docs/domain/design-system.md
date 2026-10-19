# デザインシステム（Soft Rose）

- **適用状況**: Web アプリ（`apps/web`）の全画面と、ホーム図パッケージ（`@furatora/platform-diagram`）に適用済み。
  Admin（`apps/admin`）は、ホーム図の色だけが従う。Admin の画面そのものと、ダークモードは対象外
- **決定の根拠**: [ADR-0017](../adr/0017-soft-rose-palette-and-typography.md)（配色・書体・形）、
  [ADR-0018](../adr/0018-semantic-colors-for-facilities.md)（設備・状態の意味色）、
  [ADR-0019](../adr/0019-app-icon-train-on-flat-line.md)（アプリアイコン）
- **決定時点の見本**: [`docs/adr/assets/0017/`](../adr/assets/0017/README.md)（書き換えない。いまの値はこの文書とコードを見る）

## トークンの置き場

| 置き場 | 中身 | 読む側 |
|---|---|---|
| `apps/web/src/app/globals.css` の `:root` | プリミティブ（`--brand-*` など）と、意味のトークン（`--color-*`）。**Web の値の正** | Web |
| `apps/web/src/app/globals.css` の `@theme inline` / `@theme` | Tailwind のユーティリティ名（色・書体・角丸・影） | Web の Tailwind |
| `apps/web/src/theme/mantineTheme.ts` | ブランドの10段階と文字色の**複製**（Mantine は CSS 変数を受け付けない） | Web の Mantine |
| `packages/platform-diagram/src/styles.css` | ホーム図のトークン（解決済みの値） | Web と Admin のホーム図 |

値を変えるときに、片方だけ直すと無言でずれる組み合わせがある。テストが一致を確かめる。

| 組み合わせ | 確かめるテスト |
|---|---|
| `globals.css` の `--brand-*`・`--neutral-900` と `mantineTheme.ts` | `src/theme/mantineTheme.test.ts` |
| `globals.css` と `styles.css` に同じ名前である `--color-bg-card` など5つ | `src/app/globals.test.ts` |
| `--color-rail-line-fallback` とホーム図の `DEFAULT_LINE_COLOR` | `src/app/globals.test.ts` |

Web は `styles.css` を `globals.css` より前に読む。同じ名前のトークンは `globals.css` が勝つ。

## 色

### プリミティブ

| 系統 | 段階 | 用途 |
|---|---|---|
| `--brand-*`（ローズ） | 50〜900。500 = `#DF5286`（アイコンの地） | 主色、フリースペース、ベビーカー |
| `--neutral-*`（ローズを含む暖かいニュートラル） | 0・25・50・100・300・500・700・900 | 地・枠・文字。純白の背景と純黒の文字は使わない |
| `--butter-*` | 100・300・700・900 | 出口 |
| `--slate-*` | 50・500・700 | 車いす |
| `--sage-*` | 50・500・700 | 乗換: バリアフリールートあり |
| `--amber-*` | 50・500・700 | 乗換: バリアフリールートなし |
| `--vermilion-*` | 50・200・500・700 | 優先席 |

白い文字を載せる面はブランドの 600（`#C63D71`）にする。500 と白は 3.69:1 で、本文の基準（4.5:1）に届かない。

### 意味色の対応

| 意味 | Tailwind のクラス名 | 記号・形 |
|---|---|---|
| フリースペース | `brand-*`（一部編成は 300 の地に 800 の記号） | ホーム図の丸 |
| 優先席 | `priority-50` / `200` / `500` / `700` | ホーム図では四角（赤い路線色と形で分ける） |
| 出口 | `exit-100` / `300` / `700` / `900` | プレートの地は 300、文字は 900、輪郭は 700 |
| ベビーカー | `brand-*` | |
| 車いす | `wheelchair-50` / `500` / `700` | |
| 乗換: バリアフリールートあり | `route-ok-50` / `500` / `700` | ◎ |
| 乗換: バリアフリールートなし | `route-none-50` / `500` / `700` | × |
| 乗換: 確認できていない | `subtle` / `muted` | ＊ |

- 意味色は、その意味にだけ使う。`accent`・`warning`・`success` のような汎用の名前は無い
- 色だけで意味を伝えない。乗換の状態には記号と文言を、ホーム図の印には凡例を付ける
- 路線色は DB から来る。無いとき（null・空文字）は `railLineColor()`（`src/theme/railLineColor.ts`）で
  `--color-rail-line-fallback`（neutral-500）にする。路線色で塗った面に白い文字を載せず、輪にして白地に `text-ink` で書く

### Tailwind での使い方

- 既定の色（`gray`・`blue` など）は `--color-*: initial` で無効にしてある。使える色は `@theme inline` に書いた名前だけ
  （`bg-canvas` / `bg-surface` / `bg-subtle` / `border-line` / `border-line-strong` / `text-ink` / `text-ink-soft` / `text-muted` / `bg-brand-600` / 上の意味色 / `white`）
- 既定の色クラスや16進の色を書くと、色が付かないままエラーにならない。`src/theme/defaultColorClasses.test.ts` が見つける。
  例外（許可リスト）は `mantineTheme.ts` とホーム図の `DEFAULT_LINE_COLOR`

### Mantine での使い方

- `primaryColor` は `brand`、`primaryShade` は 6（`#C63D71`）。`black` は neutral-900
- `defaultRadius` は `lg`（16px）
- `SegmentedControl` は角丸のセグメント（選択中は白地・太字・影）にしてある。選択中の文字色は呼び出し側が `classNames.label` で足す
- Mantine の CSS は `@layer mantine` にあり、Tailwind のユーティリティが勝つ（`app/layers.css` がレイヤーの順序を最初に宣言する）

## 書体

| 用途 | 書体 | Tailwind |
|---|---|---|
| 本文 | Noto Sans JP（字間 0.02em） | `font-sans`（既定） |
| 見出し・数字（駅番号など） | Zen Maru Gothic | `font-display`。Mantine の見出しも同じ |
| ホーム図のサイン | BIZ UDPGothic | `--font-sign`（`styles.css`） |

`next/font` の変数クラスは `layout.tsx` で `<html>` に付ける（`<body>` だと `:root` の変数が無効になる）。

## 形

| 名前 | 値 | Tailwind |
|---|---|---|
| タグ | 10px | `rounded-tag` |
| 入力欄 | 16px | `rounded-input` |
| カード | 22px | `rounded-card` |
| 本文エリアの上端 | 28px | `rounded-t-sheet` |
| 影（カード・浮いた部品・本文エリア） | ローズを含む影 | `shadow-card` / `shadow-raised` / `shadow-sheet` |

## アプリアイコン

図柄は、正面の電車・平らな線・「ふらっと」（ADR-0019）。地はブランドの 500、図柄は白。

| ファイル | 版 | 角 |
|---|---|---|
| `apps/web/icon-source/app-icon.svg` | 文字あり（PNG の元データ。文字はパス） | 正方形 |
| `apps/web/icon-source/app-icon-16.svg` | 文字なし・16px 用（脚と線が太く、前照灯なし。`favicon.ico` の 16 の元データ） | 丸める |
| `apps/web/src/assets/app-icon-mark.svg` | 文字なし。ヘッダー（36px） | 丸める |
| `apps/web/src/app/favicon.ico` | 16: `app-icon-16.svg` ／ 32・48: `app-icon-mark.svg`。タブのファビコン | 丸める |
| `apps/web/src/app/apple-icon.png`（180） | 文字あり | 正方形・透過なし |
| `apps/web/public/icons/android-chrome-192x192.png` / `-512x512.png` | 文字あり | 正方形・透過なし |

- 60px 未満で出す所は、文字なしの版を使う
- タブのアイコンは `favicon.ico` だけにし、`src/app/icon.svg` は置かない。Next は `app/icon.svg` を `sizes="any"` で出し、
  SVG に対応したブラウザはどの大きさでもそれを使うため、16px 用の版が 32px 以上でも出てしまう
- `manifest.json` の `id`・`start_url`・`scope` は `/`。`id` を変えると、インストール済みのアプリとは別のアプリになる
- iOS 向けは、角を OS が丸める。透過した角は iOS で黒くなるため、地を正方形に塗る
- Android（Chrome でホーム画面に追加）は `purpose: "any"` のアイコンを切り抜かず、白い円の中に縮めて置く。
  ローズの正方形が白い円の中に入った見た目になり、これを受け入れている（Android の実機では確かめていない）
- 文字が maskable の安全領域からはみ出すため、`manifest.json` のアイコンは `purpose: "any"` だけにする
  （`src/app/manifest.test.ts`）
