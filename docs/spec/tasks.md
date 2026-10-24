# タスク: ホーム図を現実の見え方に合わせ、番線のカードに収める (Issue #174)

どのサイクルも TDD（テストを1つ書く → 期待した理由で失敗することを確かめる → 最小の実装 → 通る → Refactor）。
PR2〜4（PR3 は 3a・3b）は着手するときに、この文書のその節を詳しくする（全面的には書き換えない。#174 が終わるまで同じ文書を使う）。

## PR1: 出し方

ブランチ: `feat/issue174-platform-card`（`main` から）

- [x] **TASK-1** ブランチを切る
- [x] **TASK-2** `docs/spec/` の3点を #174 用に書き換える。ADR-0023 を `Proposed` で書き、`docs/adr/README.md` の一覧に足す
- [x] **TASK-3** 開発者のレビュー（spec と ADR-0023）
- [x] **TASK-4** サイクルA: `formationLabel`（`apps/web/src/features/platform/domain/formation.ts`）
  1. 列車が1つ → 「10両編成」
  2. 両数の違う列車 → 「8・10両編成」（入力の順によらず小さい順）
  3. 両数の同じ列車が複数 → 重ねない
  4. 列車が無い → null
  - Red（`./formation` が無い）を確かめてから実装した
- [x] **TASK-5** サイクルB: `PlatformCard`（`apps/web/src/features/platform/components/PlatformCard.tsx`、`'use client'`）
  1. 既定で頭のボタンが `aria-expanded=false`
  2. 頭を押すと `aria-expanded=true`、中身の要素が `aria-controls` の id を持つ
  3. 開いているとき下の端に「閉じる」があり、押すと閉じて頭のボタンにフォーカスが移る
  4. `collapsible=false` なら頭がボタンでなく、中身も「閉じる」も無い
  5. 頭の2行目以降は、開け閉めボタンの名前に含めない
  - 空の部品を置き、1〜3・5 が「ボタンが無い」、4 が「中身が出ている」で落ちることを確かめてから実装した。
    「閉じている間は『閉じる』を出さない」は空の部品でも通る（『閉じる』をいつも描く実装を防ぐためのもの）
  - 頭全体を `<button>` で包むと `<h3>`・`<p>` がボタンの中に入り、HTML として正しくないので、`title`・`badge`・`details` に分けた（design.md）
  - `lg` 以上で頭がボタンでなくなること（`useMediaQuery`）は、そのテストだけ `window.matchMedia` を matches: true に差し替えて確かめる。見た目（`lg:`）は TASK-8 で確かめる
- [x] **TASK-6** サイクルC: `PlatformDisplay` を `PlatformCard` で包む（`PlatformDisplay.test.tsx` を新しく作る）
  1. 頭（開け閉めボタンの名前）に番線・路線・編成・方面がある
  2. ホーム長0の番線は頭に「図はまだありません」があり、注記があれば開け閉めできる
  3. 列車が無く、位置未登録の設備も注記も無い番線は、開け閉めボタンが無い
  4. 図を描ける番線は、開くと列車の図（列車名）が出る
  5. 図を描けない番線を開くと、頭の「図はまだありません」は消え、中身で理由を示す（レビューの指摘で追加。中身と同じことを2回言わないため）
  - 7件のうち5件が、今の `PlatformDisplay` で期待した理由（ボタンが無い・「図はまだありません」が無い・路線が「 — 」で方面とつながっている）で落ちることを確かめた。
    残る2件（中身が無ければボタンが無い／図を描ける番線では図が無いことを示さない）は今の形でも通る
  - 番線のバッジは `aria-hidden` にした（番号が「2番線」と重なる）
- [x] **TASK-7** 検証（自動）: typecheck・lint・test（web）・build（web）
  - すべて成功。test は web 172（155 → 172。formation 4・PlatformCard 6・PlatformDisplay 7）
- [x] **TASK-8** 検証（dev サーバー、Chrome DevTools。データは本番 DB）
  - [x] 幅 375px（池袋）: 既定で閉じている／頭の2行目を押しても開く／下の「閉じる」で閉じると頭のボタンにフォーカスが戻り、頭が固定のヘッダーの下に出る
  - [x] 幅 375px（中野坂上）: 方面タブを3つ切り替えても崩れない。列車の無い2・3番線は「図はまだありません」で、開け閉めボタンが無い
  - [x] 幅 375px（銀座線渋谷）: ホーム長0の2つの番線が「図はまだありません」で、開け閉めボタンが無い
  - [x] 幅 1280px（池袋）: 両方の番線が開いていて、頭がボタンでなく、シェブロンと「閉じる」が無い
  - 両数の違う列車が来る番線は、本番 DB に無い（どの番線も列車は1つ）。`formationLabel` の単体テストで確かめた
  - 頭へ戻したときに固定のヘッダー（80px）の下に隠れうるので、頭のボタンに `scroll-mt-24` を付けた
- [x] **TASK-9** 振り返り
  - `docs/domain/platform-coordinate-system.md`「描画」に「駅ページでの出し方（番線のカード）」を書いた（縦の図が未実装であることを適用状況に書いた）。
    `design-system.md` はトークン・色・形の文書なので置かなかった。`docs/domain/README.md` の一覧の説明を直した
  - ADR-0023 は `Proposed` のまま（PR3 で縦の図を確かめてから `Accepted`）
- [x] **TASK-10** 引き渡し: PR #192（`main` 向け）

## PR2: 一覧

ブランチ: `feat/issue174-door-lists`（`main` から）。フリースペース・優先席を「全編成」「一部編成」の見出しで分け、見本のタイルにする（REQ-14）

- [x] **TASK-11** ブランチを切り、design.md・tasks.md の PR2 節を詳しくする
- [x] **TASK-12** 開発者のレビュー（PR2 節）
- [x] **TASK-13** サイクルD: `doorListGroups`（`packages/platform-diagram/src/domain/doorList.ts`）
  1. 全編成と一部編成に分ける
  2. 号車→ドアの昇順に並べる（入力の順によらない）
  3. 同じドアに両方あれば全編成だけに出す
  4. 同じドアの重複は1つにする
  5. ドアが無ければ両方空
  - Red（`./doorList` が無い）を確かめてから実装した。Refactor で、図の `freeSpaceMarks()` と同じ「同じドアは全編成に寄せる」処理を
    `standardByDoor()`（`consist.ts`）にまとめ、両方から使う
- [x] **TASK-14** サイクルE: 一覧の描画（`DoorTileList` を新設し、`PlatformDiagram` の2枚のカードを置き換える。テストは `PlatformDisplay.test.tsx`）
  1. フリースペースの全編成・一部編成が、それぞれの見出しの region の中に出る
  2. 優先席も同じく分かれる
  3. 一部編成が無ければ「一部編成」の見出しを出さない
  - 3件とも、今の実装で期待した理由（region・見出しが無い）で落ちることを確かめてから実装した
- [x] **TASK-15** 検証（自動）: platform-diagram の typecheck・lint・test、web の typecheck・lint・test・build、admin の typecheck・build
  - すべて成功。test は platform-diagram 179（174 → 179）、web 179（172 → 179）、admin 642
- [x] **TASK-16** 検証（dev サーバー、Chrome DevTools。データは本番 DB）
  - [x] 幅 375px（池袋2番線）: 見本どおり3列にすると1枚が約75pxになり「3番ドア付近」が折り返した。
    列の数を決めず1枚6rem以上で並べるようにし（design.md）、2列で折り返さないことを確かめた。横のはみ出しも無い
  - [x] 幅 1280px（池袋）: 1行に6枚並び、崩れない
  - 見出しの印を丸にしていたが、今の図と凡例のフリースペースは三角なので、凡例と同じ三角にした
  - 本番 DB の一部編成は、フリースペースが52件（7列車）あるが、その列車はどの番線にも停車位置が無く画面に出ない。
    優先席の一部編成は0件。一部編成の見出しは描画テスト（TASK-14）で確かめた
  - [x] Admin の駅レイアウト編集画面でも一覧が出る（GitHub のログインが要るため、開発者が確かめた）
- [x] **TASK-17** 振り返り: `docs/domain/platform-coordinate-system.md`「駅ページでの出し方」に一覧の分け方を書いた
  - ADR は無し（見た目は見本どおりで、却下案を伴う決定ではない）。ADR-0023 は `Proposed` のまま（PR3）
- [x] **TASK-18** 引き渡し: PR（`main` 向け）

## PR3a: 横の図の新しい見た目

ブランチ: `feat/issue174-diagram-look`（`main` から）。着手時に PR3 を 3a（横の図の見た目）と 3b（縦の図）に分けた（requirements.md）

- [x] **TASK-19** ブランチを切り、requirements.md・design.md・tasks.md の PR3 の節を 3a・3b に分けて詳しくする
- [x] **TASK-20** 開発者のレビュー（PR3a 節）
- [x] **TASK-21** サイクルF: 対面乗換の札とフリースペースの情報（`PlatformDisplay.test.tsx`）
  1. 対面乗換の札が、図（`svg`）より後に出る
  2. 一部編成のフリースペースの `<title>` の文言が残る
  - 1 が今の実装（札が図より前）で落ち、2 が今も通る（記号を消しても情報が落ちないことを守るためのもの）ことを確かめてから実装した。
    部品の名前を `FacingTransferTagRow` にし、プレートの後に置いた
- [x] **TASK-22** 図の見た目を描き替える（`DiagramSvg`: 号車・号車番号・ドアの棒・フリースペースの丸と輪・設備の札・ホームの帯）
  - `layoutRows()`: ホームの帯をドアの棒の下へ下げて細くし、両端の文字を設備の札に重ならない位置にした（`trainY`・`facilityY`・`viewHeight` は変えていない）。
    テスト2件（帯がドアの棒に重ならない、文字が設備の札に重ならない）と既存の値のテストが、今の値で落ちることを確かめてから変えた
  - 号車の形は `domain/carShape.ts`（`carCornerRadii()`・`roundedBarPath()`）に切り出した。Red（`./carShape` が無い）を確かめてから実装した
  - 号車番号の札は、帯の中央より奥へ 1.5m ずらした（ドアが奇数枚の号車では真ん中のドアの丸と重なるため）
- [x] **TASK-23** プレートの角・乗換の枠、凡例、一覧の見出しの印、トークン（`styles.css`）
- [x] **TASK-24** 検証（自動）: platform-diagram の typecheck・lint・test、web の typecheck・lint・test・build、admin の typecheck・lint・test・build
  - すべて成功。test は platform-diagram 186（179 → 186。geometry 2・carShape 5）、web 182（PlatformDisplay 2）、admin 642（変わらず）
- [x] **TASK-25** 検証（dev サーバー、Chrome DevTools。データは本番 DB）
  - [x] 幅 1280px（池袋、乗換先の多い駅）: 号車・ドアの印・設備の札・プレートが重ならない
  - [x] 幅 1280px（赤坂見附。本番 DB で対面乗換の範囲があるのはここだけ）: 札がプレートの段の外側に、ティントと同じ範囲で出る
  - [x] 幅 375px（赤坂見附）: 横スクロールは図の中だけで、ページははみ出さない
  - [x] Admin の駅レイアウト編集で、ハンドルが号車・設備に重なる（GitHub のログインが要るため、開発者が確かめた）
- [x] **TASK-26** 振り返り: `docs/domain/platform-coordinate-system.md`「レイヤ構成」「コンコースの表現」を、図の下の札と新しい見た目に書き換える
  - ADR-0023 は `Proposed` のまま（PR3b）
- [x] **TASK-26a** レビューの指摘: 一部編成の輪と乗換の枠は ADR-0018 決定1・「影響」を覆すので、ADR-0024 を書く。domain の却下案の記述を ADR へ移し、`design-system.md` の古い「300 の地に 800 の記号」を直す
- [x] **TASK-26b** レビューの指摘: ドアの印の対応をドア番号で取る `doorMarks()` を切り出し、ドア数を超えるドア番号のフリースペースも描く。
  号車の幅が 0 以下なら `roundedBarPath()` は何も描かない。テスト 6 件が落ちることを確かめてから実装した（platform-diagram 186 → 192）
  - 白い縁の円がホーム帯・対面乗換のティントにかかる件は、赤坂見附 2番線で縁を号車の側だけにした案と見比べ、今のままにした
- [x] **TASK-27** 引き渡し: PR（`main` 向け）

## PR3b: 縦の図

ブランチ: `feat/issue174-vertical-diagram`（`main` から）。信頼度 70%（中）なので PoC から（design.md）

- [x] **TASK-28** ブランチを切り、requirements.md・design.md・tasks.md の PR3b 節を詳しくする
- [x] **TASK-29** 開発者のレビュー（PR3b 節）
- [x] **TASK-30** PoC: 縦の図を回して描き、プレートを入れ子の grid で積み、折れ線で結ぶ。札を案A・案B の両方で描く
  - 幅 375px で成功基準を満たした: 池袋1番線の一番下のプレートが本来の位置から約160px 押し下げられ、折れ線で結ばれた。どの番線もプレートは重ならない。実測は無い
  - 札は赤坂見附2番線のスクリーンショットで見比べ、開発者が案A（プレートと同じ列）に決めた。案B は図が約770px と長く、札がティントから離れる
  - 列が約120px と狭く細かく折り返したので、縦の図のときだけ列車のカードの余白を `p-3` にした（列 146px）
- [x] **TASK-31** サイクルG: `layoutVerticalColumn()`（`domain/verticalPlateLayout.ts`）。4件。Red（`./verticalPlateLayout` が無い）を確かめてから実装した
- [x] **TASK-32** サイクルH: `verticalMatrix()`・`toVertical()`・`verticalY()`（`geometry.ts`）。5件。Red（関数が無い）を確かめてから実装し、`verticalY()` を geometry へ移した
- [x] **TASK-33** サイクルI: 描画（`PlatformDisplay.test.tsx`）。3件を足し、図が2つになって重複で落ちた既存の2件は横の図の中に絞った。
  5件が「`data-orientation` の図が無い」で落ちることを確かめてから、キャンバスに `data-orientation` を付けた
- [x] **TASK-34** 検証（自動）: すべて成功。test は platform-diagram 201（192 → 201）、web 185（182 → 185）、admin 642（変わらず）
- [x] **TASK-35** 検証（dev サーバー、Chrome DevTools。データは本番 DB）
  - [x] 幅 375px（池袋・赤坂見附）: 縦の図。プレートが重ならず、押し下げたプレートが折れ線で結ばれる。ページの横はみ出しは無い
  - [x] 幅 375px（中野坂上）: 方面タブを3つ切り替えても崩れない
  - [x] 幅 1023px で縦だけ、1024px・1280px で横だけ（横の図の見た目は変わらない）
  - [x] Admin の駅レイアウト編集が横のまま変わらない（GitHub のログインが要るため、開発者が確かめた）
  - 設備の札が、近いアクセス点どうしで重なる（赤坂見附の 0m 付近）。横の図でも同じで、この PR の変更によるものではない
- [x] **TASK-36** 振り返り: `docs/domain/platform-coordinate-system.md` に「縦の図」を書き、「駅ページでの出し方」の適用状況の注記を外した。
  ADR-0023 を `Accepted` にした（`docs/adr/README.md` も）。札の置き方は ADR にしない（ADR-0023 の決定の中の見せ方で、覆しても他の決定に響かない）。理由と却下案は domain に書いた
- [x] **TASK-37** 引き渡し: PR（`main` 向け）

## PR4: 乗換カード（着手時に詳しくする）

- [ ] 複数ルートは最短を大きく、ほかは区切りの下に小さく（REQ-19）
- [ ] #174 の振り返り・引き渡し（恒久知識の取り残しを確かめる）
