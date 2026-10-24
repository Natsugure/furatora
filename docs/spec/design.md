# 設計: ホーム図を現実の見え方に合わせ、番線のカードに収める (Issue #174)

向きと出し方の決定と却下案は [ADR-0023](../adr/0023-diagram-orientation-by-viewport-in-platform-card.md) による。ここには変更点だけを書く。
PR1・PR2・PR3a は詳しく書いた。PR3b・PR4 は着手するときにその節を詳しくする。

## 全体の流れ

```
apps/web/src/app/stations/[slug]/page.tsx
 └─ <section>「ホーム」
     ├─ PlatformTabs（方面タブ。変えない）
     └─ PlatformDisplay（番線1つ）
         └─ PlatformCard ……………………………… PR1 で新設（開け閉め・lg での切り替え）
             ├─ 頭: 番線・路線・編成・方面 ……… PR1
             └─ 中身
                 ├─ PlatformDiagram（列車ごと）
                 │   ├─ 図（横） ……………………… PR3a で新しい見た目（Admin も）
                 │   ├─ 図（縦、lg 未満） ……… PR3b で新設
                 │   └─ フリースペース・優先席 … PR2 で「全編成」「一部編成」
                 └─ ホームの注記（変えない）

apps/web/src/components/TransferDifficultySection.tsx … PR4（複数ルート）
```

| PR | 主に変わるところ |
|---|---|
| PR1 | `apps/web/src/features/platform/`（`PlatformDisplay`・新しい `PlatformCard`・`formationLabel`） |
| PR2 | `packages/platform-diagram/src/components/PlatformDiagram.tsx` の一覧（とその元になる純関数） |
| PR3a | `packages/platform-diagram`（図の部品・オーバーレイ・凡例・トークン）。Admin の図の見た目も変わる |
| PR3b | `packages/platform-diagram`（縦の図）、`apps/web` の番線のカードの中身 |
| PR4 | `apps/web/src/components/TransferDifficultySection.tsx`、`features/station/domain/transferView.ts` |

## PR1: 出し方

### 部品の分け方

```
PlatformDisplay（サーバー部品のまま）
  ├─ 頭を組み立てる（番線のバッジ・番線・路線・編成・方面・「図はまだありません」）
  ├─ 中身を組み立てる（今の図・注記をそのまま）
  └─ <PlatformCard title badge details collapsible={中身があるか}>{中身}</PlatformCard>

PlatformCard（'use client'、新規）
  └─ 開け閉めの状態だけを持つ
```

`PlatformDisplay` は今のまま `async` でない同期の部品なので、`PlatformTabs`（クライアント部品）の中でも、
`page.tsx`（サーバー部品）の中でも描ける。`PlatformCard` は頭の部品と `children` を `ReactNode` で受け取るので、
中身（`PlatformDiagram`）はサーバーで描いたものがそのまま入る。

### `PlatformCard`

```ts
type Props = {
  title: string;           // 「2番線」。<h3> の中のボタンの名前になる
  badge: ReactNode;        // 番線のバッジ（aria-hidden。番号は title と重なる）
  details: ReactNode;      // 頭の2行目以降（路線・編成・方面・図が無いこと）。ボタンの名前には含めない
  collapsible: boolean;    // false なら開け閉めの操作を出さず、中身も出さない（REQ-12）
  children?: ReactNode;    // 中身
};
```

頭全体を `<button>` で包むと、中に `<h3>`・`<p>` が入り、HTML の入れ子として正しくない（ボタンの中は文の中の要素だけ）。
WAI-ARIA のアコーディオンと同じく `<h3><button>2番線</button></h3>` とし、ボタンの押せる範囲を
`after:absolute after:inset-0` で頭全体（`relative`）に広げる。

- `useState(false)` で開閉を持つ。`useId()` で中身の要素に id を振り、ボタンの `aria-controls` に渡す
- **見た目の切り替えは CSS だけで行う。** 中身の要素は `className={`${open ? 'block' : 'hidden'} lg:block`}`、
  シェブロンと下の「閉じる」は `lg:hidden`
  - サーバーで描いた結果とずれず、PC で一瞬閉じて見えることも無い（`useMediaQuery` で見た目を決めると、最初の描画が必ずスマホの形になる）
  - **`hidden` 属性は使わない。** Tailwind の preflight が `[hidden]` に `display: none !important` を当てるので、`lg:block` で上書きできない
- 頭の `<h3>` の中を `<button aria-expanded aria-controls>` にする（押せる範囲は頭全体）
- **支援技術向けの属性だけは `useMediaQuery`（`@mantine/hooks`）で切り替える。** CSS だけだと、PC では中身が見えているのに
  頭が「折りたたまれたボタン」と読み上げられ、押しても何も変わらない
  - `useMediaQuery('(min-width: 64em)')`（`lg` = 1024px）が true の間は、`<h3>` の中をボタンにせず文字だけにする
  - 最初の描画（サーバー・ハイドレーション）は false なのでボタンで描き、マウント後に文字だけへ替わる。見た目は変わらない
  - テストの `matchMedia` の代用（`src/test/setup.ts`）は false を返すので、テストはスマホの振る舞いを確かめることになる
- 中身の下の端に「閉じる」ボタン（`lg:hidden`。開いている間だけ描く）。押すと閉じて、頭のボタンに `focus()` し、`scrollIntoView({ block: 'nearest' })` する（REQ-7）
  - jsdom には `scrollIntoView` が無いので、`scrollIntoView?.()` で呼ぶ

### カードの頭

```
[2]  2番線                          ⌄   ← シェブロンは lg 未満だけ
     丸ノ内線 · 6両編成
     池袋・新宿・荻窪方面
     （図を描けない番線で、閉じているときのみ）図はまだありません
```

- 番線のバッジは今の輪のもの（路線色の輪・白地に `text-ink`。明るい路線色では白い文字が読めない、という今のコメントを残す）。
  見本の塗りつぶしは採らない
- 路線と編成は「 · 」でつなぐ。方面は次の行（今は「 — 」で路線とつないでいる。見本の並びに合わせる）
- 方面は今と同じく inbound / outbound を「 / 」でつなぐ
- 図を描けない番線の判定は今と同じ（`physicalLength === 0` または `stopPatterns.length === 0`）。
  中身の中の「ホーム長が未登録のため図を表示できません」「列車情報がありません」は残す（開いたときにも理由が分かるように）。
  そのぶん頭の「図はまだありません」は閉じている間だけ出す（`PlatformCard` の `closedSummary`。開くと描かず、`lg` 以上では `lg:hidden`）。
  開け閉めできない番線は中身が無いので、いつも出す

### `formationLabel(stopPatterns)`

`apps/web/src/features/platform/domain/formation.ts`（新規）。

```ts
// 番線に停まる列車の両数を、重複を除いて小さい順に「8・10両編成」とする。列車が無ければ null
export function formationLabel(stopPatterns: Pick<TrainStopPatternDTO, 'carCount'>[]): string | null;
```

### 中身があるか（`collapsible`）

`PlatformDisplay` で決める。図を描ける、または `notes` がある（位置未登録のコンコースの欄は PR3b で消した。REQ-20）。

### 変えないもの

- `PlatformDiagram` とその中身（PR2・PR3）
- `PlatformTabs`（方面タブ）と `page.tsx` の案内文
- `PlatformDTO` と `stationDetailQuery.ts`（頭に要る値はすべて今の DTO にある）

### エラーハンドリング

| 状況 | 応答 |
|---|---|
| `stopPatterns` が空 | 編成を出さず、頭に「図はまだありません」 |
| `physicalLength === 0` で列車あり | 編成を出し、頭に「図はまだありません」 |
| 図を描けず、中身も無い | 開け閉めの操作を出さない |
| `carCount` が 0 や欠けた値 | DTO では `number` で必ずある（`stationDetailQuery.ts` で列車の両数から入る）。そのまま出す |

### テスト戦略

- `formationLabel`: 純関数の単体テスト
- `PlatformCard`: RTL。`getByRole('button', { name })` と `aria-expanded`、`userEvent.click`、`toHaveFocus()`。
  Tailwind の class は検証しない（apps/CLAUDE.md）。`lg` の切り替えは dev サーバーで目で確かめる
- `PlatformDisplay`: RTL。テストの中の `platform(overrides)` 関数でフィクスチャを作る（`getStationDetail.test.ts` と同じやり方）。
  図を描ける番線では `PlatformDiagram` が描かれる（jsdom で描けることを最初のテストで確かめる）

## PR2: 一覧

今は `PlatformDiagram.tsx` の中で、列車ごとにフリースペースと優先席を1つのリストで並べ、行の末尾に「(全編成)」「(一部編成)」を付けている
（優先席は区別を出していない）。これを見出しで分け、見た目は見本（`docs/adr/assets/0017/source/Platform.dc.html` の一覧）のタイルに合わせる。
`PlatformDiagram` は Admin も使うので、Admin の一覧も同じに変わる。

```
▲ フリースペース 全編成          ← <h6>（列車名が <h5>）。ランドマーク（section）にはしない
[1号車 3番ドア付近][2号車 …][3号車 …]   ← <ul aria-labelledby> のタイル（1枚6rem以上で、入るだけ並べる）
▲ フリースペース 一部編成
■ 優先席 全編成
■ 優先席 一部編成                 ← 空のグループは出さない
```

### `doorListGroups(cars)`

`packages/platform-diagram/src/domain/doorList.ts`（新規。`domain/index.ts` から出す）。

```ts
export type DoorPosition = { carNumber: number; doorNumber: number };
// 号車のドアを「全編成」「一部編成」に分ける。どちらも号車→ドアの昇順
export function doorListGroups(
  cars: { carNumber: number; doors: { nearDoor: number; isStandard: boolean }[] }[],
): { standard: DoorPosition[]; partial: DoorPosition[] };
```

- 同じ号車・ドアに全編成と一部編成の両方があれば、全編成だけに出す（図の `freeSpaceMarks()` と同じ規則。図と一覧が食い違わないため）
- 同じ号車・ドアの重複は1つにする
- フリースペースと優先席のどちらにも使う（呼び出し側が `freeSpaceDoors` / `prioritySeatDoors` を `doors` に渡す）

### `DoorTileList`

`packages/platform-diagram/src/components/DoorTileList.tsx`（新規）。見出し・見出しの頭の印・タイルの色を受け取り、空なら何も描かない。

- 見出しの頭の印: フリースペースの全編成は `--color-free-standard`、一部編成は `--color-free-nonstandard` の三角（今の図と凡例に合わせる。図の見た目は PR3 で見直す）。
  優先席は `--card-prio-heading` の四角（ADR-0018 決定2。赤い路線色と形で分ける）
- タイルの列の数は決めない（`repeat(auto-fill, minmax(6rem, 1fr))`）。見本は3列だが、番線のカードと列車のカードの内側に入るので、
  幅375pxで3列にすると1枚が約75pxになり「3番ドア付近」が折り返す（TASK-16 で確かめた）。実測で 375px は2列、1280px は1行に6枚になる
- タイルの地と文字は今のトークン（フリースペース `--card-transfer-bg` / `--card-transfer-heading`、優先席 `--card-prio-bg` / `--card-prio-heading`。値は見本と同じ）。
  Admin は Web の Tailwind のトークンを持たないので、今と同じく `styles.css` の CSS 変数を inline style で使う。新しいトークンは足さない
- 一覧を残す理由（読み上げ・テキスト検索、優先席は図に出さない）のコメントは残す。凡例は変えない（PR3）

### テスト戦略

- `doorListGroups`: 純関数の単体テスト（platform-diagram、node 環境）
- 一覧の描画: `PlatformDisplay.test.tsx` に足す（jsdom で `PlatformDiagram` まで描ける。platform-diagram は部品のテストの環境を持たない）。
  `getByRole('region', { name: 'フリースペース 全編成' })` の中に号車・ドアがあることを `within` で確かめる

## PR3a: 横の図の新しい見た目

横の図に見本（`docs/adr/assets/0017/source/Platform.dc.html`）の見た目を当てる。図の部品は `packages/platform-diagram` にあるので、Admin の図も同じに変わる。
見本は縦の図なので、横の図では見本を右へ90°回したものとして読む（号車の札・ドアの縦棒・丸の大きさは見本の px を 5px/m で割る）。

### 見本と違えるところ（着手時に開発者と決めた）

| 項目 | 見本 | PR3a | 理由 |
|---|---|---|---|
| ホームの帯 | 無い（0m・140m の文字だけ） | 細い線で残す | 座標はホームの外にも置ける（`platform-coordinate-system.md`「座標の範囲」）。端を示すものが他に無い |
| 乗車位置の色 | `#C9BEC2` | 今の `--sign-boarding-mark` を 55% で重ねる | 見本の色は白地で 1.6:1 しかなく、#166 で決めた値を保つ |
| 乗換のプレートの枠 | `#EBE4E7` 1.5px | `#7A6E72`（neutral-500）。今の黒（`#111`）から替える | 黒は画面になじまず、見本の色は薄すぎる。号車の枠と同じ色（白地 4.88:1） |
| 出口のプレートの地 | 100（`#FBF3D2`）・枠なし | 今のまま 300・輪郭 700（ADR-0018 決定3） | 見本の地は ADR と違う（REQ-18）。角の丸めだけを取る |
| 優先席の印 | 列車の外側に四角 | 描かない | 優先席は #175 の範囲。図の下の一覧に出す（PR2） |
| 図の向きの添え書き | 「上が 1号車」 | 出さない | ADR-0023 |

### 描き替えるもの（`components/diagram/DiagramSvg.tsx`）

- **号車**: 先頭・末尾のノーズの多角形をやめ、すべて角丸の矩形にする。編成の外側の端だけ大きく丸める（見本の 26px・10px → 5.2m・2m。
  ただし列車の帯は 10m なので、端の丸めは帯の半分を超えない値にする）。SVG の `rect` は4つの角を別々に丸められないので、端の号車は `path` で描く
- **号車番号**: 白い角丸の札（今の `--color-car-number-bg`）を見本の大きさ（28px → 5.6m 四方、角 1.8m）に寄せ、文字を大きくする
- **乗車位置**: ホームの帯の下に打つ三角をやめ、号車の中のホーム側の縁にドアの縦棒（横の図では横長の棒。見本の 4×12px → 2.4m×0.8m）を置く
- **フリースペース**: ドアの位置で、号車のホーム側の縁に乗せる。全編成はローズの丸（`--color-free-standard`、白い縁）、一部編成はローズの輪（地は白）。
  丸のあるドアには縦棒を描かない（見本と同じ）。人の記号（`FreeSpaceGlyph`）は消し、`<title>` の文言は変えない
- **設備**: アイコンの後ろに白い角丸の札（枠 `--color-border-default`）を敷く。札の大きさとピッチは今の定数（`FACILITY_ICON_SIZE`・`FACILITY_ICON_PITCH`）のまま、アイコンを札の中で少し小さく描く
- **ホームの帯**: 細くする（`PLATFORM_BAR_HEIGHT` を下げる）

**図の高さの約束（`layoutRows()` の `trainY`・`facilityY`・`viewHeight`）は変えない。** Admin の編集レイヤ（`DiagramEditLayer`）が号車・設備のハンドルをこの値で置くため。
変えたくなったら、先に `DiagramEditLayer.test.tsx` を直してから変える。

### 対面乗換の札（REQ-16）

今は図の上のバナーで、段を逆順に積んでいる。これを**図の下の、出口・乗換のプレートの段のさらに外側**に移す。

```
 列車 [1][2][3][4][5][6]
 ─ホーム─────（対面乗換の範囲は帯の色のまま）
 設備 ▣        ▣
 束ね線 └──┬──┘
 プレート  [出口][乗換]       ← ConcoursePlateRow（lane 0 が図の側）
 札   [▌◯◯線（△△方面）は向かい側に到着]   ← 札の段（lane 0 が図の側）
```

- 札には引き出し線が無いので、`routeLeaders` の迂回に加えない。段の割り当て（`layoutFacingBanners()`）も今のまま、プレートとは別の段の組にする
- 範囲は札の左端と最小幅で示す（今の `xFraction()` の割合の仕組みのまま）。ホームの帯の色（ティント）は残す
- `FacingTransferBannerRow` は、段を正順に積み、余白を上の辺に付ける。部品の名前は `FacingTransferTagRow` にする（バナーではなくなるため）。
  domain の型（`FacingTransferBanner`）の名前は変えない（Admin の参照と差分を増やさない）

### プレート（`components/overlay/ConcoursePlateRow.tsx`）

- 出口・乗換とも角を丸める（見本の 14px・12px → `rounded-xl` 相当）
- 乗換の枠は `--sign-transfer-edge` を `#7a6e72` にし、太さは 1.5px にする

### 凡例と一覧の見出しの印（`PlatformDiagram.tsx`）

凡例を見本に合わせる: フリースペース（丸）・一部編成（輪）・乗車位置（棒）・出口・乗換・束ね線。
一覧の見出しの印（PR2 で三角にした）も、凡例と同じ丸・輪にする（`Triangle` を置き換える）。

### トークン（`styles.css`）

- `--sign-transfer-edge`: `#111111` → `#7a6e72`
- `--color-free-standard-text`・`--color-free-nonstandard-text`・`--color-free-nonstandard` を消す（記号と淡い塗りをやめるため）。`apps/web/src/app/globals.css` には同じ名前が無い
- `docs/domain/design-system.md` には、これらのトークンの記述は無い

### テスト戦略

- 見た目（色・形・class）は単体テストで確かめない（apps/CLAUDE.md）。dev サーバーで目で確かめる
- `PlatformDisplay.test.tsx` に足す（jsdom で `PlatformDiagram` まで描ける）
  1. 対面乗換の札が、図（`svg`）より後に出る（`compareDocumentPosition`）
  2. 一部編成のフリースペースの `<title>` が「◯号車 ◯番ドア付近のフリースペース（一部編成）」のまま残る
- 端の号車の形など、純関数に切り出したものだけ `packages/platform-diagram/src/domain/*.test.ts` で単体テストする
- Admin の `DiagramEditLayer.test.tsx` が通り続けること

## PR3b: 縦の図（PoC から）

信頼度 70%（中）なので、PoC で成功基準を確かめてから本実装に広げる。

### 回し方（`DiagramSvg` の `orientation`）

- `DiagramSvg` に `orientation: 'horizontal' | 'vertical'` を渡す。縦は viewBox の幅と高さを入れ替え（`0 0 viewHeight 描画範囲`）、
  中身全体を `<g transform>` で左へ90°回す（(x, y) → (y, maxX − x)）。**0m が下、ホーム長の端が上、列車が左**になる
  （上を 0m にすると、列車を左に置いたとき鏡写しになる。REQ-1）。回すだけなので、鏡写しは構造的に起きない
- 号車番号・設備のアイコン・0m/ホーム長の文字は、それぞれの中心で +90° 戻して正立させる
- 当初は「(ホームに沿う位置, 横切る位置) を x,y に写す関数を全要素に通す」としていたが、全要素の座標に手を入れるより、
  `<g>` で回して文字・アイコンだけ戻すほうが差分が小さく、横の図の描き方をそのまま使える

### 縦の大きさ

横の図の `min-width` はコンテナの余白を埋めるためのもので、縦の図には伸ばす理由が無い。
縦は SVG の幅と高さを px で両方決める（高さ = 描画範囲 × `PX_PER_METER`、幅 = `viewHeight` × `PX_PER_METER`）。
アスペクト比が viewBox と一致するので、レターボックスは出ない。プレートの y も同じ px で計算する（サーバーで決まる値。実測ではない）。

### プレートの積み方（REQ-17。実測しない）

プレートを図の上から順（x の大きい順）に1列に並べ、プレート i の上端を
`top_i = max(anchorY_i, bottom_{i-1} + gap)` にする（本来の位置か、上のプレートに押し下げられた位置）。
これを、入れ子の単一セル grid で CSS だけで作る。

```
N_1 = grid[ 高さ anchorY_1 の空き ]                         → プレート1
N_2 = grid[ 高さ anchorY_2 の空き | N_1・プレート1・gap ]    → プレート2
...
```

単一セルの grid は、重ねた中身のうち高いほうの高さになる（`ConcoursePlateRow` のレーンと同じ性質）。
N_i の直後にプレート i を置けば、上端が max になる。入れ子の深さはプレートの数（多くて数件）。

### 折れ線

N_i を `relative` にし、`top: anchorY_i; bottom: 0` の絶対配置の線を置くと、本来の位置からプレートの上端までの線を測らずに引ける。
線は SVG の右端（束ね線の引き出し）→ 余白の列 → 下へ → プレート、の折れ線にする。
押し下げられた線どうしが余白の列で重なる場合の逃がし方（列の中で x をずらす）は PoC で確かめる。

### 出し分け

`PlatformDiagram` に `responsive?: boolean` を足す。web だけ `true` にし、横のキャンバスに `hidden lg:block`、縦に `lg:hidden` を当てる
（PR1 と同じく CSS だけ。最初の描画から正しい向きで出る）。Admin は渡さないので横のまま。凡例と一覧は向きによらず1つ。

### 対面乗換の札（PoC で決める）

縦の図では「プレートの段の外側」が右の3列目になり、375px では幅が足りない（図のカードの中は約245px、SVG が約120px）。
ティントは SVG の中なので、範囲はどちらの案でも図で示せる。PoC で2案を描き、開発者が見比べて決める。

- 案A: プレートと同じ列に、範囲の上端の位置で積む（押し下げられうる）。左の縁に路線色のバー。引き出し線は付けない
- 案B: 縦の図の下に、横幅いっぱいで並べる

### PoC の成功基準

幅 375px で、プレートが重ならず、押し下げたプレートがどれも折れ線で設備と結ばれ、クライアントで実測していない。
札は案A/B のスクリーンショットで開発者が決める。**満たせなければ止めて相談する**（ADR-0006 の見直しを含む）。
対象駅（本番 DB）: 池袋（乗換先が多い）、赤坂見附（対面乗換）、中野坂上（方面タブ）。

### テスト戦略

- 縦のプレートの並び（純関数）: 上から（x の大きい順）並ぶ、anchorY = (maxX − anchorX) × `PX_PER_METER`、（案A なら）札も同じ並びに入る、グループが無ければ空
- 回す写像（純関数）: 縦の viewBox、0m が下・ホーム長の端が上、列車が左
- 描画（`PlatformDisplay.test.tsx`）: web では縦と横の両方が出る、縦の図にも出口・乗換の文がある。`responsive` 無し（Admin）は横だけ
- jsdom は CSS を効かせないので、図が2つあると既存の `getByText`（`<title>` の文、札の文）が重複する。横の図の中に `within` で絞る。
  縦の図に `aria-hidden` は付けない（ブラウザでは `display:none` で読み上げから外れる）。重複しないことはブラウザで確かめる
- 見た目（折れ線・重なり・正立）は単体テストで確かめず、dev サーバーで目で確かめる

## PR4: 乗換カード（着手時に詳しくする）

- `transferView.ts` の並びから最短を選び、`TransferDifficultySection.tsx` で大きさを分ける見込み

## 恒久知識の振り分け

| 内容 | 置き場 |
|---|---|
| 画面の幅で横と縦を切り替える／別ページを作らない／鏡写しにしない | ADR-0023（PR1 で `Proposed`、PR3b で `Accepted`） |
| 番線のカードの出し方（`lg` 未満で折りたたみ、既定で閉じる、`lg` 以上でいつも開く、頭に出すもの） | `docs/domain/`（PR1 のフェーズ5。置き場は書くときに決める） |
| 縦の図の座標の取り方（回し方） | `docs/domain/platform-coordinate-system.md`「描画」（PR3b） |
| 対面乗換を図の下の札にすること、図の見た目（号車・ドア・フリースペースの印） | `docs/domain/platform-coordinate-system.md`「レイヤ構成」「コンコースの表現」（PR3a） |
