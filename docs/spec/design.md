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

汎用の `--color-accent*` / `--color-warning*` / `--color-success*` / `--color-text-on-accent` は消す（参照なし）。
意味色に付け替えると、一般の警告やボタンに優先席・ルートなしの色が流用されるため（ADR-0018）。

ホーム図の乗換プレートの文字（`--sign-transfer-ink` / `-note`）は、`styles.css` で `--color-text-primary` / `-secondary` を参照する。
`globals.css` と `styles.css` に重複する5つの値（`--color-bg-card` / `--color-border-default` / `-strong` / `--color-text-primary` / `-secondary`）は、
`apps/web/src/app/globals.test.ts` で一致を確かめる。

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
  --color-brand-50: var(--brand-50);  /* … 900 まで */
  --color-exit-100: var(--butter-100); /* 意味色は意味の名前で出す: exit / wheelchair / route-ok / route-none / priority */
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

ADR-0018 の意味色は、Tailwind では意味の名前で出す（`butter` → `exit`、`slate` → `wheelchair`、`sage` → `route-ok`、`amber` → `route-none`、`vermilion` → `priority`）。
`slate`・`amber` は Tailwind の既定パレットにもあり、一部の段階（`amber-50` など）だけを上書きすると、
同じ画面で既定の `amber-200` と混ざる（`stations/[slug]/page.tsx` が `bg-amber-50 border-amber-200` を使っている）。
CSS 変数のプリミティブ名（`--butter-*` など）は ADR のとおり。

`globals.css` の使われていない別名（`--btn-*` / `--banner-*` / `--card-exit-*` / `--color-prio-*` / `--color-train-empty-*` /
`--color-same-floor-fallback` / `--color-connector-line` / `--color-background` / `--color-foreground`）は消す。
どのファイルからも参照されておらず、消すプリミティブ（`--gray-*` など）を参照していたため。

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
  defaultRadius: 'lg', // 16px（入力欄）。xl は 32px で大きすぎる
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
| `--color-train-car-bg` / `-border` | `#d6d3d1` / `#a8a29e` | `#EFE8EB` / `#7A6E72` |
| `--color-free-standard` / `-text` | `#4072b3` / `#ffffff` | `#DF5286` / `#FFFFFF` |
| `--color-free-nonstandard` / `-text` | `#a5c0e6` / `#1a2d4e` | `#EE9FBA` / `#6E2140` |
| `--sign-exit-bg` / `-ink` / `-edge` | `#ffd400` / `#111111` / `#c99a00` | `#F0DC85` / `#4A3F0A` / `#6B5A0E` |
| `--sign-boarding-mark` / `--sign-leader` | `#aaaaaa` | `#4A4044` / `#C9BEC2` |
| `--card-transfer-bg` / `-border` / `-heading` | `#ebf1fa` / `#4072b3` / `#264370` | `#FDF3F6` / `#F5C5D6` / `#A02F5B` |
| `--card-prio-bg` / `-border` / `-heading` | `#fff8e1` / `#ffe082` / `#ffb300` | `#FCEEE8` / `#F4C3B1` / `#A3361A` |

`--sign-transfer-*`（白地に黒い輪郭）は変えない。出口のプレートと見分けるため。
`--sign-exit-edge` は `--butter-700` にする。地と白地のコントラスト比は 1.37:1 しかなく、プレートと凡例の見本の外形は輪郭で出す（ADR-0018「影響」）。
出口のプレートの補足の文字（11px）は透過させない（`opacity-75` だと 4.16:1）。

乗車位置の印（通常のドア）は、`--neutral-700` を 55% で重ねる（白地 2.91:1）。不透明の `--neutral-500`（4.88:1）は 3:1 を満たすが、
全編成のフリースペース（3.69:1）より目立ってしまう。一部編成のフリースペースは `--brand-300` にし、印とは色相と明度の両方で見分ける。
号車の地は濃くしない（`--neutral-300` にすると一部編成の丸が 1.19:1 で沈む）。列車の輪郭は枠（`--neutral-500`）で出す。

DB に路線色が無い路線の代わりの色は、Web の `--color-rail-line-fallback` とホーム図の `DEFAULT_LINE_COLOR` の両方を `--neutral-500` にする。
`--neutral-300` では白地 1.81:1 で、対面乗換の左のバーが見えず、ホーム帯・号車の枠とも区別できない。
2つは `apps/web/src/app/globals.test.ts` で一致を確かめる。
`globals.css` と `styles.css` の「出口は黄地に黒」のコメントは、ADR-0018 を参照する内容に書き換える。

## 画面ごとの変更

| PR | ファイル | 変更 |
|---|---|---|
| 2 | `app/layout.tsx` | ヘッダー（アイコン＋ふらとら＋説明）・フッターの色と書体。右端の `Train` アイコンは消す（意味を持たない装飾のため） |
| 2 | `components/ui/Container.tsx` | 余白（スマホ 16px）は変えない |
| 2 | `components/ui/StationBadge.tsx` | 路線色のリング＋白地＋Zen Maru Gothic の数字。路線色が無いときは `--color-rail-line-fallback`（= `--neutral-500`） |
| 2 | `components/BackButton.tsx` | 白い丸（44px）に左向きの山形（戻り方は下の「戻るボタン」の段落。PR 3） |
| 2 | `components/SearchTabs.tsx` | Mantine の `SegmentedControl`（ラジオボタンのグループ）で、角丸のセグメント（選択中は白地・ローズ文字・影）。`TransferDifficultySection`（PR 3）と同じ部品にそろえる |
| 2 | `components/StationSearch.tsx` | 白い検索欄（角丸 18px、影、ローズの虫眼鏡） |
| 2 | `components/StationCard.tsx` | 路線の駅一覧のタイムライン（`isFirst` / `isLast` で線の端を切る）。右端は淡いローズの丸に山形 |
| 2 | `components/OperatorList.tsx` | 事業者のアコーディオンの色・角丸（開閉の動きは変えない。`operators` に色の列が無く、見本のチップの色の丸は描けないため） |
| 2 | `components/LineAccordion.tsx` | 路線の行。路線色は縦線だけに使い、路線名は `text-ink`（路線色の文字は白地とのコントラストが足りない。REQ-10） |
| 2 | `app/lines/[slug]/stations/page.tsx` | 駅の行の間の隙間（`space-y-2`）だけを外す（タイムラインの線が途切れるため。他は PR 3） |
| 3 | `components/ui/Sheet.tsx`（新規）／ `app/layout.tsx` | 上端を丸めた白い本文エリア（REQ-5）。3画面で共用する。画面の下端まで伸ばすため `<main>` を flex の縦並びにし、`Container` に `w-full` を足す |
| 3 | `app/page.tsx` | 見出し「どの駅へ行きますか？」（一部をローズ）、できることの一覧（丸アイコン＋点線） |
| 3 | `app/lines/[slug]/stations/page.tsx` | 路線の見出し（路線記号の丸＋路線名＋英語名・駅数）、本文エリアの構成 |
| 3 | `components/StationTimeline.tsx`（新規）／ `components/StationCard.tsx`（削除） | 駅一覧のタイムラインを一覧ごと部品にする（下の「駅一覧のタイムラインの部品化」） |
| 3 | `app/stations/[slug]/page.tsx` | 駅の見出し、路線のチップ（下の「路線のチップ」）、ご利用案内 |
| 3 | `components/TransferDifficultySection.tsx` | ベビーカー／車いすを Mantine の `SegmentedControl` で切り替える。状態の色を ADR-0018 に揃える |
| 3 | `constants/transferDifficulty.ts` | `iconColorHex` を `iconClassName` に改め、意味色のクラス（`bg-route-ok-500` / `bg-route-none-500` / `bg-muted`）で塗る。状態の文言の色（`labelClassName`）を足す |
| 3 | `features/platform/components/PlatformTabs.tsx` / `PlatformDisplay.tsx` | ホームのタブ・見出しの色 |
| 3 | `app/**/loading.tsx` / `error.tsx` / `not-found.tsx` | スケルトン・エラー画面の色 |
| 4 | `packages/platform-diagram/src/styles.css` | 上の表のとおり |
| 4 | `packages/platform-diagram/src/components/PlatformDiagram.tsx` | 凡例の見本の色（トークン経由なので値の変更だけで足りるかを確かめる） |
| 5 | `apple-icon.png` / `favicon.ico` / `public/icons/android-chrome-*.png` / `app/manifest.json` | ADR-0019 の図柄（キャンバスの案X-1。下の「アイコンの書き出し」）。manifest のパスを `/icons/…` に直し、`name` / `short_name` を入れる |
| 5 | `assets/app-icon-mark.svg`（新規） / `app/layout.tsx` | ヘッダーは文字なし・案のままの版を読む |
| 5 | `app/icon.svg`（削除） → `icon-source/app-icon-16.svg` | 16px 用の版は `favicon.ico` の元データにだけ使う（PR #180 のレビュー。Next が `sizes="any"` で出し、全サイズで使われるため） |
| 5 | `icon-source/app-icon.svg`（新規） | 文字ありの版の元データ（文字はパス） |

### アイコンの書き出し

キャンバスの案（`Icons3.dc.html`）をそのまま使い、清書はしない。ファイルと版の対応は `docs/domain/design-system.md`「アプリアイコン」。

- 文字（ふらっと）は、Zen Maru Gothic Bold の字形を fontTools でパスにした（font-size 19、字間 1、中央揃え、ベースライン y=86。案と同じ）
- PNG はリポジトリの sharp で書き出し、`favicon.ico` は 16（`app-icon-16.svg`）・32・48（`app-icon-mark.svg`）の PNG を埋め込んで作った。スクリプトはコミットしない
- 16px では前照灯（半径 約0.5px）が消え、脚と線（約0.7px）がかすれるため、16px 用だけ脚と線を 4 → 7 にし、前照灯を省く

路線記号（銀座線の「G」など）は、`lines.line_code`（`Line.lineCode`）を使う。null の路線だけ、先頭の駅の駅番号の英字にフォールバックする（`components/ui/LineSymbol.tsx`）。
駅番号の英字と番号への分け方は `features/station/domain/stationCode.ts` の `parseStationCode()` にまとめ、`StationBadge` と共有する。

路線色の丸に白い文字を載せない。銀座線（`#F39700`）や日比谷線など明るい路線色、白とのコントラストが 3:1 にも届かない（REQ-10）。路線色の無い路線の代わりの色（`neutral-500`）も、白い文字は載せない。文字を載せる路線色の印（路線記号・番線・駅のバッジ）は、路線色を輪だけに使い、白地に `text-ink` で書く。
路線色で塗ってよいのは、文字を載せない線・帯・小さな丸だけにする。

戻るボタン（`BackButton`）は、行き先（`href`）へのリンクにする。`navigation.canGoBack`（同じオリジンの履歴）があるときだけ、
リンク先へ行かずに前の画面に戻る。共有されたリンクを直接開いたときにも行き先がある。`history.length` はサイトの外の履歴も数えるため使わない。
DB の列は増やさない。

### 路線のチップ（駅の詳細）

駅の路線一覧は `StationDetailDTO` に無いため、クエリは増やさず、ホームの路線（`platforms[].lineName/lineColor`）→ 乗換先の路線（`transferPartners[].lineName/lineColor`）の順に、
路線名で重複を除いて並べる（`features/station/domain/stationLineChips.ts`）。乗換先は相手駅の路線なので、自駅の路線と相手駅の路線が同じ並びに入る。
路線記号は DTO に無いため、チップは路線色の丸と路線名だけにする。

これは暫定の実装で、ホームの無い駅（春日など）では自駅の路線が出ない。「駅から乗り換えられる路線」はアプリ全体で使う見込みがあり、
出どころ（`stationLines` と乗換接続から導くか、`stationGroups` の全路線か）の決定とあわせて、ドメインの関数として #172 で作り直す。

### 駅一覧のタイムラインの部品化（PR 3）

PR 2 の `StationCard` は1行だけの部品で、次の2つの前提を呼び出し側と手書きの値に頼っている。

- 行の間に隙間があると線が途切れる。守るのは呼び出し側（`page.tsx`）で、コメントで注意しているだけ
- 線の位置 `left-6`（24px）と太さ `w-[5px]` は、バッジの直径 54px（`StationBadge` の `w-13.5`）に合わせた手書きの値。
  バッジの大きさを変えると線が中心からずれる（今も線の中心は 26.5px、バッジの中心は 27px で 0.5px ずれている）

PR 3 で、この2つを一覧の部品の中に閉じ込める。

- `components/StationTimeline.tsx` を作る。`{ stations: StationWithOrder[]; lineColor: string | null }` を受け取り、`<ol>` / `<li>` で並べる
  - `isFirst` / `isLast` はこの部品の中で決める。行を詰めて並べるのもこの部品の責任にする
  - 行の部品（今の `StationCard` の中身）はこのファイルの中に置き、export しない（単独で使えないようにする）
- 線はバッジの直径を参照せず、レイアウトで中心を通す。行の中にバッジだけを置く列（`data-timeline="column"`）を作り、
  線はその列を基準に `left: 50%` と `margin-left: −線の太さ / 2` で置く。列の幅がバッジの直径になるので、直径を変えても中心を通る
  - 行は `items-stretch` にして、列を行の高さいっぱいに伸ばす（線を行の上端・下端まで届かせる）。行の縦の余白は列と文字の側に移す
  - `StationBadge` の直径は Tailwind のクラス（`size-13.5`）のまま持つ。タイムラインのために数値を export しない
  - 中心に置くのに `translateX(-50%)` ではなく `margin-left` を使うのは、単体テスト（jsdom）で数値として確かめられるため。
    jsdom はレイアウトを計算しないので、テストは「列の 50% から太さの半分を戻す」ことと「列には線のほかにバッジだけがある」ことを確かめる。
    列に横の余白を足すとずれるが、それは単体テストでは検出できない
  - バッジの直径を TS の定数で共有して `left = 直径 / 2 − 線の太さ / 2` を計算する方法は採らない。
    2つの部品が数値でつながり、バッジの大きさを style で当てる必要が出るうえ、骨組み（`loading.tsx`）の直書きの直径とずれうるため
- `app/lines/[slug]/stations/page.tsx` は `<StationTimeline stations={stations} lineColor={line.color} />` を置くだけにする
- `StationCard.tsx` と `StationCard.test.tsx` は消す。テストは `StationTimeline.test.tsx` に移し、駅の配列を渡して、先頭・途中・末尾の線の有無を1回の描画で確かめる
- 線の描き方（行ごとに上半分・下半分を描き、先頭・末尾で端を切る）は変えない。一覧全体に1本の線を引く方法は、
  先頭と末尾のバッジの中心で線の端を止めるのに行の高さの固定が要る。英語名が折り返すと行が高くなるため採らない
- 見た目の変化は、線が 0.5px 右へ寄ってバッジのちょうど中心を通ることだけ

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
