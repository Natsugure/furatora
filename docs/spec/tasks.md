# タスク: ホーム図を現実の見え方に合わせ、番線のカードに収める (Issue #174)

どのサイクルも TDD（テストを1つ書く → 期待した理由で失敗することを確かめる → 最小の実装 → 通る → Refactor）。
PR2〜4 は着手するときに、この文書のその節を詳しくする（全面的には書き換えない。#174 が終わるまで同じ文書を使う）。

## PR1: 出し方

ブランチ: `feat/issue174-platform-card`（`main` から）

- [x] **TASK-1** ブランチを切る
- [x] **TASK-2** `docs/spec/` の3点を #174 用に書き換える。ADR-0023 を `Proposed` で書き、`docs/adr/README.md` の一覧に足す
- [x] **TASK-3** 開発者のレビュー（spec と ADR-0023）
- [ ] **TASK-4** サイクルA: `formationLabel`（`apps/web/src/features/platform/domain/formation.ts`）
  1. 列車が1つ → 「10両編成」
  2. 両数の違う列車 → 「8・10両編成」（入力の順によらず小さい順）
  3. 両数の同じ列車が複数 → 重ねない
  4. 列車が無い → null
- [ ] **TASK-5** サイクルB: `PlatformCard`（`apps/web/src/features/platform/components/PlatformCard.tsx`、`'use client'`）
  1. 既定で頭のボタンが `aria-expanded=false`
  2. 頭を押すと `aria-expanded=true`、中身の要素が `aria-controls` の id を持つ
  3. 開いているとき下の端に「閉じる」があり、押すと閉じて頭のボタンにフォーカスが移る
  4. `collapsible=false` なら頭がボタンでなく、中身も「閉じる」も無い
  - `lg` 以上で頭が `<div>` になること（`useMediaQuery`）は、テストの `matchMedia` の代用が false を返すので単体テストでは扱わない。TASK-8 で確かめる
- [ ] **TASK-6** サイクルC: `PlatformDisplay` を `PlatformCard` で包む（`PlatformDisplay.test.tsx` を新しく作る）
  1. 頭（開け閉めボタンの名前）に番線・路線・編成・方面がある
  2. ホーム長0の番線は頭に「図はまだありません」があり、注記があれば開け閉めできる
  3. 列車が無く、位置未登録の設備も注記も無い番線は、開け閉めボタンが無い
  4. 図を描ける番線は、開くと列車の図（列車名）が出る
- [ ] **TASK-7** 検証（自動）: typecheck・lint・test（web）・build（web）
- [ ] **TASK-8** 検証（開発者と一緒に、dev サーバー）
  - 幅 375px: 既定で閉じている／開ける／下の「閉じる」で閉じると頭に戻る／方面タブを切り替えても崩れない
  - 幅 1024px 以上: いつも開いていて、シェブロンと「閉じる」が無く、頭を Tab でたどれない（ボタンでない）
  - ホーム長0の番線: 閉じた状態で「図はまだありません」が出る
  - 両数の違う列車が来る番線の編成の出方
- [ ] **TASK-9** 振り返り
  - `docs/domain/` に番線のカードの出し方を書く（置き場は書くときに決める。変えなかったらその理由をここに残す）
  - ADR-0023 は `Proposed` のまま（PR3 で縦の図を確かめてから `Accepted`）
- [ ] **TASK-10** 引き渡し: PR（`main` 向け）。本文に「#174 の PR1/4」と書く

## PR2: 一覧（着手時に詳しくする）

- [ ] フリースペース・優先席を「全編成」「一部編成」の見出しで分ける（REQ-14）

## PR3: 新しい見た目と縦の図（着手時に詳しくする。PoC から）

- [ ] 横の図に新しい見た目を当てる（Web・Admin。REQ-15）
- [ ] 縦の図（REQ-3）。対面乗換の札（REQ-16）、縦のプレートの積み方と折れ線（REQ-17）、出口のプレート（REQ-18）
- [ ] `docs/domain/platform-coordinate-system.md` の「描画」に縦の図を書く
- [ ] ADR-0023 を `Accepted` にする

## PR4: 乗換カード（着手時に詳しくする）

- [ ] 複数ルートは最短を大きく、ほかは区切りの下に小さく（REQ-19）
- [ ] #174 の振り返り・引き渡し（恒久知識の取り残しを確かめる）
