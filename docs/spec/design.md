# 設計: Web アプリのデザインシステムを Soft Rose に刷新する (Issue #166)

配色・書体・形の値と、その根拠は [ADR-0017](../adr/0017-soft-rose-palette-and-typography.md)、
意味色は [ADR-0018](../adr/0018-semantic-colors-for-facilities.md)、
アイコンは [ADR-0019](../adr/0019-app-icon-train-on-flat-line.md) による。ここには実装だけを書く。

## アーキテクチャ: トークンの流れ

```
packages/platform-diagram/src/styles.css   ホーム図の値（号車・フリースペース・優先席・出口・サイン書体）
        │  Web の layout.tsx でも import する（新規。Admin は既に import 済み）
        ▼
apps/web/src/app/globals.css
  :root        プリミティブ（--brand-* / --neutral-* / --butter-* / --slate-* / --sage-* / --amber-* / --vermilion-*）
               意味のトークン（--color-bg-app / --color-text-primary / --color-primary … 既存の名前を残す）
               形（--radius-* / --shadow-*）、書体（--font-display）
  @theme inline  Tailwind のユーティリティへ（bg-canvas / bg-surface / text-ink / text-muted / bg-brand-600 …）
        │
        ▼
apps/web/src/theme/mantineTheme.ts        createTheme（brand の10段階を複製、primaryShade 6、書体、角丸）
apps/web/src/theme/mantineTheme.test.ts   複製した値と globals.css の --brand-* が一致することを確かめる
```

### トークンの置き場（重複の解消）

- いまは、ホーム図のトークンが `globals.css` と `styles.css` の両方にある（Web は `styles.css` を読み込んでいない）
- Web の `layout.tsx` で `@furatora/platform-diagram/styles.css` を `globals.css` より前に import する
- `globals.css` から、ホーム図だけが使うトークン（`--color-train-*` / `--color-free-*` / `--color-prio-*` / `--sign-*` / `--card-transfer-*` / `--card-prio-*` / `--font-sign`）を消す
- 両方にある汎用の名前（`--color-bg-card` / `--color-border-default` / `--color-border-strong` / `--color-text-primary` / `--color-text-secondary`）は、両ファイルで同じ値にする。
  Web では後に読む `globals.css` が勝つ

## インターフェース

### プリミティブ（`globals.css` の `:root`）

値は ADR-0017・ADR-0018 の表のとおり。名前は次の形にする。

| 系統 | 変数 |
|---|---|
| ブランド | `--brand-50` 〜 `--brand-900` |
| ニュートラル | `--neutral-0` / `-25` / `-50` / `-100` / `-300` / `-500` / `-700` / `-900` |
| 出口 | `--butter-100` / `-300` / `-700` / `-900` |
| 車いす | `--slate-50` / `-500` / `-700` |
| ルートあり | `--sage-50` / `-500` / `-700` |
| ルートなし | `--amber-50` / `-500` / `-700` |
| 優先席 | `--vermilion-50` / `-200` / `-500` / `-700` |

既存の `--blue-*` / `--red-*` / `--orange-*` / `--gray-*` / `--green-*` は消す。

### 意味のトークン（既存の名前を残し、参照先を差し替える）

| トークン | 新しい参照先 |
|---|---|
| `--color-bg-app` | `--neutral-25` |
| `--color-bg-card` | `--neutral-0` |
| `--color-bg-subtle` | `--neutral-50` |
| `--color-border-default` | `--neutral-100` |
| `--color-border-strong` | `--neutral-300` |
| `--color-border-focus` | `--brand-300` |
| `--color-text-primary` / `-secondary` / `-disabled` | `--neutral-900` / `-500` / `-300` |
| `--color-primary` / `-hover` / `-active` | `--brand-600` / `-700` / `-800` |
| `--color-primary-subtle` / `-muted` / `-text` | `--brand-50` / `-100` / `-700` |
| `--color-accent*` | `--vermilion-*` |
| `--color-warning*` | `--amber-*` |
| `--color-success*` | `--sage-*` |

角丸・影・見出しの書体は Tailwind からしか使わないので、`:root` ではなく Tailwind のテーマに直接書く（次節）。
同じ名前を `:root` と `@theme inline` の両方に書くと `--x: var(--x)` の循環になるため、置き場を1か所にする。

### Tailwind（`@theme inline`）

```css
@theme inline {
  --color-*: initial;                 /* 既定の色を無効にする（TASK-3.5 で入れる） */
  --color-white: #FFFFFF;
  --color-transparent: transparent;
  --color-canvas: var(--color-bg-app);
  --color-surface: var(--color-bg-card);
  --color-subtle: var(--color-bg-subtle);
  --color-line: var(--color-border-default);
  --color-ink: var(--color-text-primary);
  --color-ink-soft: var(--neutral-700);
  --color-muted: var(--color-text-secondary);
  --color-brand-50: var(--brand-50);  /* … 900 まで。butter / slate / sage / amber / vermilion も同様 */
  /* 既存の --font-sans と同じ書き方。var() の第2引数で宣言全体の無効化を防ぐ（Issue #107） */
  --font-display: var(--font-zen-maru-gothic, "Zen Maru Gothic"), var(--font-noto-sans-jp, "Noto Sans JP"), system-ui, sans-serif;
}

@theme {
  --radius-tag: 10px;     /* rounded-tag */
  --radius-input: 16px;   /* rounded-input */
  --radius-card: 22px;    /* rounded-card */
  --radius-sheet: 28px;   /* rounded-t-sheet */
  --shadow-card: 0 6px 24px rgba(110, 33, 64, 0.06);   /* shadow-card */
  --shadow-raised: 0 2px 8px rgba(110, 33, 64, 0.10);  /* shadow-raised */
}
```

`--color-*: initial` は、置き換えが終わる PR 3 の最後で入れる。それまでは既定の色と共存させる。

### Mantine（`apps/web/src/theme/mantineTheme.ts`）

```ts
export const BRAND_COLORS: MantineColorsTuple = [
  '#FDF3F6', '#FAE3EB', '#F5C5D6', '#EE9FBA', '#E6789E',
  '#DF5286', '#C63D71', '#A02F5B', '#6E2140', '#4A1630',
];
export const mantineTheme = createTheme({
  colors: { brand: BRAND_COLORS },
  primaryColor: 'brand',
  primaryShade: 6,
  fontFamily: 'var(--font-sans)',
  headings: { fontFamily: 'var(--font-display)' },
  defaultRadius: 'xl',
});
```

`providers.tsx` の `MantineProvider` に `theme={mantineTheme}` を渡す。
Mantine の10段階は index 0〜9 で、CSS の `--brand-50`〜`--brand-900` と次のように対応する（`primaryShade: 6` = `--brand-600`）。

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| CSS | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |

### 書体（`layout.tsx`）

`next/font/google` の `Zen_Maru_Gothic`（weight 500 / 700、`variable: '--font-zen-maru-gothic'`）を足し、
変数クラスを `<html>` に付ける（`<body>` ではない。Issue #107）。

## ホーム図のトークンの値の変更（`packages/platform-diagram/src/styles.css`）

| トークン | 現在 | 新しい値 |
|---|---|---|
| `--color-bg-card` | `#ffffff` | `#FFFFFF` |
| `--color-border-default` / `-strong` | `#e0e0e0` / `#cccccc` | `#EBE4E7` / `#C9BEC2` |
| `--color-text-primary` / `-secondary` | `#222222` / `#666666` | `#2A2326` / `#7A6E72` |
| `--color-train-car-bg` / `-border` | `#d6d3d1` / `#a8a29e` | `#EFE8EB` / `#C9BEC2` |
| `--color-free-standard` / `-text` | `#4072b3` / `#ffffff` | `#DF5286` / `#FFFFFF` |
| `--color-free-nonstandard` / `-text` | `#a5c0e6` / `#1a2d4e` | `#F5C5D6` / `#A02F5B` |
| `--sign-exit-bg` / `-ink` / `-edge` | `#ffd400` / `#111111` / `#c99a00` | `#F0DC85` / `#4A3F0A` / `#F0DC85` |
| `--sign-boarding-mark` / `--sign-leader` | `#aaaaaa` | `#C9BEC2` |
| `--card-transfer-bg` / `-border` / `-heading` | `#ebf1fa` / `#4072b3` / `#264370` | `#FDF3F6` / `#F5C5D6` / `#A02F5B` |
| `--card-prio-bg` / `-border` / `-heading` | `#fff8e1` / `#ffe082` / `#ffb300` | `#FCEEE8` / `#F4C3B1` / `#A3361A` |

`--sign-transfer-*`（白地に黒い輪郭）は変えない。出口のプレートと見分けるため。
`--sign-exit-edge` は地と同じ値にして輪郭を見えなくする。目視で白地から浮かないと分かったら、`--butter-700` に寄せた色にする（ADR-0018「影響」）。
`globals.css` と `styles.css` の「出口は黄地に黒」のコメントは、ADR-0018 を参照する内容に書き換える。

## 画面ごとの変更

| PR | ファイル | 変更 |
|---|---|---|
| 2 | `app/layout.tsx` | ヘッダー（アイコン＋ふらとら＋説明）・フッターの色と書体。右端の `Train` アイコンは消す（意味を持たない装飾のため） |
| 2 | `components/ui/Container.tsx` | 余白（スマホ 16px）は変えない |
| 2 | `components/ui/StationBadge.tsx` | 路線色のリング＋白地＋Zen Maru Gothic の数字。路線色が無いときは `--neutral-300` |
| 2 | `components/BackButton.tsx` | 白い丸（44px）に左向きの山形 |
| 2 | `components/SearchTabs.tsx` | 角丸のセグメント（選択中は白地・ローズ文字・影） |
| 2 | `components/StationSearch.tsx` | 白い検索欄（角丸 18px、影、ローズの虫眼鏡） |
| 2 | `components/StationCard.tsx` | 路線の駅一覧のタイムライン（`isFirst` / `isLast` で線の端を切る）。右端は淡いローズの丸に山形 |
| 2 | `components/OperatorList.tsx` | 事業者のチップ |
| 3 | `app/page.tsx` | 見出し「どの駅へ行きますか？」（一部をローズ）、できることの一覧（丸アイコン＋点線） |
| 3 | `app/lines/[slug]/stations/page.tsx` | 路線の見出し（路線記号の丸＋路線名＋英語名・駅数）、本文エリアの構成 |
| 3 | `app/stations/[slug]/page.tsx` | 駅の見出し、路線のチップ、ご利用案内 |
| 3 | `components/TransferDifficultySection.tsx` | ベビーカー／車いすを Mantine の `SegmentedControl` で切り替える。状態の色を ADR-0018 に揃える |
| 3 | `constants/transferDifficulty.ts` | `iconColorHex` を `--sage-500` / `--amber-500` / `--neutral-500` の値にする |
| 3 | `features/platform/components/PlatformTabs.tsx` / `PlatformDisplay.tsx` | ホームのタブ・見出しの色 |
| 3 | `app/**/loading.tsx` / `error.tsx` / `not-found.tsx` | スケルトン・エラー画面の色 |
| 4 | `packages/platform-diagram/src/styles.css` | 上の表のとおり |
| 4 | `packages/platform-diagram/src/components/PlatformDiagram.tsx` | 凡例の見本の色（トークン経由なので値の変更だけで足りるかを確かめる） |
| 5 | `app/icon.svg` / `apple-icon.png` / `favicon.ico` / `public/icons/android-chrome-*.png` / `app/manifest.json` | ADR-0019 の図柄。manifest のパスを `/icons/…` に直し、`name` / `short_name` を入れる |

路線記号（銀座線の「G」など）は、駅番号の先頭の英字から取る。DB の列は増やさない。

## データフロー

色の変更だけで、データの流れは変わらない。
`TransferDifficultySection` は、いま両方の移動手段の評価（`assessRoutes` の結果）を同時に描いている。
切り替え後も評価は両方受け取り、選んでいる側だけを描く。選択はコンポーネントの `useState` に持つ（URL には載せない）。

## エラーマトリックス

| 状況 | 結果 | 対処 |
|---|---|---|
| Zen Maru Gothic の読み込みに失敗 | `--font-display` のフォールバックで表示 | なし |
| `--font-zen-maru-gothic` の変数クラスを `<body>` に付けた | `--font-display` が第2引数の値で解決される（宣言全体は無効にならない） | Issue #107 のコメントを `layout.tsx` に残す |
| Mantine の複製した値と CSS がずれた | `mantineTheme.test.ts` が失敗 | 両方を直す |
| 既定の色クラスが残ったまま `--color-*: initial` を入れた | そのクラスの色が付かない（エラーにならない） | `defaultColorClasses.test.ts` が失敗する |
| `globals.css` と `styles.css` の汎用トークンの値がずれた | Web と Admin でカードの色が少し違う | design.md の表で揃える。PR 4 で目視 |

## テスト戦略

- **単体**
  - `apps/web/src/theme/mantineTheme.test.ts`: `globals.css` を読み、`--brand-50`〜`--brand-900` が `BRAND_COLORS` と一致することを確かめる
  - `apps/web/src/theme/defaultColorClasses.test.ts`（TASK-3.5 で追加）: `apps/web/src` と `packages/platform-diagram/src` の `.tsx` に、
    Tailwind の既定の色クラス（`(bg|text|border|ring|divide|fill|stroke)-(gray|blue|red|…)-数字`）と、トークンを通さない16進の色が無いことを確かめる。
    路線色のフォールバック値など、意図した例外は許可リストで持つ
  - `TransferDifficultySection.test.tsx`: 移動手段の切り替えに合わせて書き換える
    - 初期はベビーカーの評価だけが出る
    - 「車いす」を選ぶと車いすの評価だけが出る
    - 乗換先の選択は切り替えても保たれる
    - 「ペルソナごとに判定が分かれる」系のテストは、切り替えてから確かめる形にする
- **静的検査**: 各 PR で `turbo run typecheck lint test` と `pnpm run build`
- **目視**（dev。スマホ幅 390px と PC 幅 1280px）
  - PR 1: トップ画面だけ。新しい背景・文字色・書体・ボタンが効くこと（中信頼度の PoC）
  - PR 2・3: 全画面。見本（`docs/adr/assets/0017/`）との差
  - PR 4: Web と Admin のホーム図。出口のプレートが白地から浮くか
  - PR 5: ブラウザのタブ、iOS のホーム画面に追加したときのアイコン
- **アクセシビリティ**: PR 3 の後に Lighthouse のアクセシビリティ監査を、トップ・路線の駅一覧・駅の詳細で行う。コントラストの指摘が0件であること

## 恒久知識の振り分け

| 内容 | 置き場 | 時期 |
|---|---|---|
| 配色・書体・トークンの構成と、Mantine への複製の理由 | ADR-0017 | PR 0 |
| 意味色と、却下した色 | ADR-0018 | PR 0 |
| アイコンの図柄 | ADR-0019 | PR 0 |
| 現在のトークンの一覧と、意味色の対応表（いまの姿） | `docs/domain/design-system.md`（新規） | 最後の PR（フェーズ5） |
| 画面ごとの変更、ファイル一覧 | 本ファイル（使い捨て） | — |
