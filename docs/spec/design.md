# 設計: ホーム図を現実の見え方に合わせ、番線のカードに収める (Issue #174)

向きと出し方の決定と却下案は [ADR-0023](../adr/0023-diagram-orientation-by-viewport-in-platform-card.md) による。ここには変更点だけを書く。
詳しく書くのは PR1 だけ。PR2〜4 は着手するときにその節を詳しくする。

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
                 │   ├─ 図（横） ……………………… PR3 で新しい見た目（Admin も）
                 │   ├─ 図（縦、lg 未満） ……… PR3 で新設
                 │   └─ フリースペース・優先席 … PR2 で「全編成」「一部編成」
                 ├─ 位置未登録の設備・乗換（変えない）
                 └─ ホームの注記（変えない）

apps/web/src/components/TransferDifficultySection.tsx … PR4（複数ルート）
```

| PR | 主に変わるところ |
|---|---|
| PR1 | `apps/web/src/features/platform/`（`PlatformDisplay`・新しい `PlatformCard`・`formationLabel`） |
| PR2 | `packages/platform-diagram/src/components/PlatformDiagram.tsx` の一覧（とその元になる純関数） |
| PR3 | `packages/platform-diagram`（図の部品・`layoutRows()`・オーバーレイ）、`apps/admin` の図の見た目 |
| PR4 | `apps/web/src/components/TransferDifficultySection.tsx`、`features/station/domain/transferView.ts` |

## PR1: 出し方

### 部品の分け方

```
PlatformDisplay（サーバー部品のまま）
  ├─ 頭を組み立てる（番線のバッジ・番線・路線・編成・方面・「図はまだありません」）
  ├─ 中身を組み立てる（今の図・位置未登録・注記をそのまま）
  └─ <PlatformCard header={頭} collapsible={中身があるか}>{中身}</PlatformCard>

PlatformCard（'use client'、新規）
  └─ 開け閉めの状態だけを持つ
```

`PlatformDisplay` は今のまま `async` でない同期の部品なので、`PlatformTabs`（クライアント部品）の中でも、
`page.tsx`（サーバー部品）の中でも描ける。`PlatformCard` は `header` と `children` を `ReactNode` で受け取るので、
中身（`PlatformDiagram`）はサーバーで描いたものがそのまま入る。

### `PlatformCard`

```ts
type Props = {
  header: ReactNode;       // 番線のバッジと見出し。開け閉めボタンの名前にもなる
  collapsible: boolean;    // false なら開け閉めの操作を出さず、中身も出さない（REQ-12）
  children?: ReactNode;    // 中身
};
```

- `useState(false)` で開閉を持つ。`useId()` で中身の要素に id を振り、ボタンの `aria-controls` に渡す
- **見た目の切り替えは CSS だけで行う。** 中身の要素は `className={`${open ? 'block' : 'hidden'} lg:block`}`、
  シェブロンと下の「閉じる」は `lg:hidden`
  - サーバーで描いた結果とずれず、PC で一瞬閉じて見えることも無い（`useMediaQuery` で見た目を決めると、最初の描画が必ずスマホの形になる）
  - **`hidden` 属性は使わない。** Tailwind の preflight が `[hidden]` に `display: none !important` を当てるので、`lg:block` で上書きできない
- 頭は `<button aria-expanded aria-controls>` にする（頭のどこを押しても開閉する）
- **支援技術向けの属性だけは `useMediaQuery`（`@mantine/hooks`）で切り替える。** CSS だけだと、PC では中身が見えているのに
  頭が「折りたたまれたボタン」と読み上げられ、押しても何も変わらない
  - `useMediaQuery('(min-width: 64em)')`（`lg` = 1024px）が true の間は、頭を `<button>` ではなく `<div>` で描く（同じ class）
  - 最初の描画（サーバー・ハイドレーション）は false なのでボタンで描き、マウント後に `<div>` へ替わる。見た目は変わらない
  - テストの `matchMedia` の代用（`src/test/setup.ts`）は false を返すので、テストはスマホの振る舞いを確かめることになる
- 中身の下の端に「閉じる」ボタン（`lg:hidden`）。押すと閉じて、頭のボタンに `focus()` し、`scrollIntoView({ block: 'nearest' })` する（REQ-7）
  - jsdom には `scrollIntoView` が無い。呼ぶ前に存在を確かめるか、テストの setup で代用を置く（`src/test/setup.ts` は `matchMedia` の代用を置いている）

### カードの頭

```
[2]  2番線                          ⌄   ← シェブロンは lg 未満だけ
     丸ノ内線 · 6両編成
     池袋・新宿・荻窪方面
     （図を描けない番線のみ）図はまだありません
```

- 番線のバッジは今の輪のもの（路線色の輪・白地に `text-ink`。明るい路線色では白い文字が読めない、という今のコメントを残す）。
  見本の塗りつぶしは採らない
- 路線と編成は「 · 」でつなぐ。方面は次の行（今は「 — 」で路線とつないでいる。見本の並びに合わせる）
- 方面は今と同じく inbound / outbound を「 / 」でつなぐ
- 図を描けない番線の判定は今と同じ（`physicalLength === 0` または `stopPatterns.length === 0`）。
  中身の中の「ホーム長が未登録のため図を表示できません」「列車情報がありません」は残す（開いたときにも理由が分かるように）

### `formationLabel(stopPatterns)`

`apps/web/src/features/platform/domain/formation.ts`（新規）。

```ts
// 番線に停まる列車の両数を、重複を除いて小さい順に「8・10両編成」とする。列車が無ければ null
export function formationLabel(stopPatterns: Pick<TrainStopPatternDTO, 'carCount'>[]): string | null;
```

### 中身があるか（`collapsible`）

`PlatformDisplay` で決める。図を描ける、または位置未登録のコンコース（`undrawable`）がある、または `notes` がある。

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

## PR2: 一覧（着手時に詳しくする）

- 今は `PlatformDiagram.tsx` の中で、列車ごとにフリースペース（:149-168）と優先席（:172-190）を並べている
- 号車のドアごとに `isStandard`（すべての編成にあるか）を持っているので、それで「全編成」「一部編成」に分ける見込み

## PR3: 新しい見た目と縦の図（着手時に詳しくする。PoC から）

- 横の図: 見本（`docs/adr/assets/0017/source/Platform.dc.html`）の見た目を当てる。Admin の編集レイヤ（ADR-0010）は横のまま
- 縦の図: 横の図を左へ90°回す。ADR-0022 により、回すだけで現実と同じ向きになる
- `PlatformCard` の中身で、横の図に `hidden lg:block`、縦の図に `lg:hidden` を当てて出し分ける見込み（PR1 と同じく CSS だけ）
- 縦のプレートの積み方と折れ線は PoC で確かめる。成功基準は着手時に決める

## PR4: 乗換カード（着手時に詳しくする）

- `transferView.ts` の並びから最短を選び、`TransferDifficultySection.tsx` で大きさを分ける見込み

## 恒久知識の振り分け

| 内容 | 置き場 |
|---|---|
| 画面の幅で横と縦を切り替える／別ページを作らない／鏡写しにしない | ADR-0023（PR1 で `Proposed`、PR3 で `Accepted`） |
| 番線のカードの出し方（`lg` 未満で折りたたみ、既定で閉じる、`lg` 以上でいつも開く、頭に出すもの） | `docs/domain/`（PR1 のフェーズ5。置き場は書くときに決める） |
| 縦の図の座標の取り方（回し方） | `docs/domain/platform-coordinate-system.md`「描画」（PR3） |
