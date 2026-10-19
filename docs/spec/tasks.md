# タスク: Web アプリのデザインシステムを Soft Rose に刷新する (Issue #166)

PR ごとにブランチを分け、前の PR のブランチから順に切る（`gh-stack` で積む）。
PR 1〜3 は、すべてそろうまで develop へのマージを待つ（途中の状態では新旧の色が混ざるため）。

## PR 0: 仕様と決定（`feat/issue166-design-system-soft-rose`）

- [x] **TASK-0.1** Issue #166 を起票し、ブランチを切る
- [x] **TASK-0.2** `docs/spec/` の3点を書き換える
- [x] **TASK-0.3** ADR-0017・0018・0019 を `Proposed` で書き、`docs/adr/README.md` の一覧に足す
- [x] **TASK-0.4** デザインキャンバスの見本（PNG とソース）を `docs/adr/assets/0017/` に残し、ADR から参照する

## PR 1: 土台（PoC）（`feat/issue166-pr1-tokens`）

- [x] **TASK-1.1** `globals.css` のプリミティブを差し替え、意味のトークンの参照先を変える（design.md「インターフェース」）
- [x] **TASK-1.2** `@theme inline` に意味のある色の名前と書体、`@theme` に角丸と影を足す（`--color-*: initial` はまだ入れない）
- [x] **TASK-1.3** `layout.tsx` に Zen Maru Gothic を足し、変数クラスを `<html>` に付ける
- [x] **TASK-1.4** Web の `layout.tsx` で `@furatora/platform-diagram/styles.css` を読み込み、`globals.css` からホーム図のトークンを消す。汎用トークンの値を `styles.css` と揃える
- [x] **TASK-1.5** `theme/mantineTheme.ts` と `mantineTheme.test.ts` を作り、`providers.tsx` に渡す（依存: TASK-1.1）
- [x] **TASK-1.6** 検証: typecheck・lint・test・build。dev のトップ画面で、背景・文字色・書体・Mantine の部品が新しい値になることを確かめる（PoC の成功基準）
  - 結果: 成功。背景 `#FAF6F7`、文字 `#2A2326`、本文 Noto Sans JP・字間 0.02em、`--font-display` が Zen Maru Gothic に解決され 700 が読み込める、
    Mantine の主色 `#C63D71`・本文と見出しの書体・既定の角丸 16px。ホーム図は `styles.css` の値で従来どおり描ける

## PR 2: 共通部品（依存: PR 1）（`feat/issue166-pr2-components`）

- [x] **TASK-2.1** ヘッダー・フッター（`layout.tsx`）
- [x] **TASK-2.2** `StationBadge`・`BackButton`
- [x] **TASK-2.3** `SearchTabs`・`StationSearch`
- [x] **TASK-2.4** `StationCard`（タイムライン）・`OperatorList`（アコーディオンのまま色・角丸だけ）・`LineAccordion`
- [x] **TASK-2.5** 検証: typecheck・lint・test・build、dev で部品を含む画面を目視
  - 結果: 成功（テスト 57 件）。390px / 1280px で、トップ（2つのタブ、検索の結果・エラー）、路線の駅一覧（先頭・末尾で線の端が切れる）、
    駅の詳細（バッジ・戻る）を確かめた
  - 目視で見つけた PR 1 の不具合を PR 1 のブランチで直した: Mantine の `styles.css`（レイヤー外）の `button, input { font: inherit }` が
    Tailwind のユーティリティに勝ち、ボタン・入力欄の `font-bold` / `text-sm` が効いていなかった。
    `app/layers.css` でレイヤーの順序（`theme, base, mantine, components, utilities`）を最初に宣言し、`@mantine/core/styles.layer.css` を読む
  - 検索欄（`type="search"`）のブラウザ標準の青い消去ボタンを隠した
- [x] **TASK-2.6** 共通部品のテストを足す（React Testing Library。クラス名ではなく役割・名前・文言で確かめる）
  - `StationBadge` / `BackButton` / `SearchTabs` / `StationSearch` / `StationCard` / `OperatorList` / `LineAccordion`（36 件）
  - `StationCard` の線は装飾（`aria-hidden`）で役割を持たないため、`data-timeline="up" | "down"` で上下を見分ける
  - `OperatorList` の開閉ボタンに `aria-expanded` を足し、開閉を状態で確かめる
  - PR 1 側に `app/layers.test.ts`（レイヤーの順序と、`layout.tsx` が `layers.css` を最初に読むこと）を足した
  - `layout.tsx` のヘッダー・フッターは `next/font` を使う Server Component のため単体テストの対象外（目視で確かめた）
- [x] **TASK-2.7** PR #170 のレビューの指摘を直す
  - `SearchTabs` を Mantine の `SegmentedControl` に置き換えた。`aria-pressed`（オン・オフの切り替え）をやめ、
    `radiogroup`（名前「検索方法」）と `radio` にする。矢印キーで選び直せる。見た目は Tailwind のクラスで当て、以前と同じ
    （高さ 44px、白地・ローズ文字・影）。`TransferDifficultySection`（PR 3）と部品をそろえる
  - テストの環境に `ResizeObserver` の代わりを足した（`SegmentedControl` の選択中の背景が位置を測るため）。
    `SearchTabs.test.tsx` は `MantineProvider` で包む
  - `StationSearch` のエラーを、検索が終わったクエリと組で持つようにした。入力のたびにエラーを消していたため、
    確定するクエリが変わらない入力（末尾の空白など）でエラーだけが消え、前の検索の結果や「見つかりませんでした」が出ていた
  - 路線色の代わりの色の決め方を `theme/railLineColor.ts` の `railLineColor()` にまとめ、`StationBadge` / `StationCard` /
    `LineAccordion` / `StationSearch` と、路線の駅一覧の見出しの縦線（`#888888` が残っていた）をこれに置き換えた。
    見出しの路線名の文字色（`line.color || '#111827'`）と `PlatformDisplay` の `#6b7280` は、画面ごと PR 3 で直す
  - `StationSearch.test.tsx` の空白だけの入力のテストを、400ms 実際に待つのをやめ、偽のタイマーで 300ms 進めて確かめる形にした。
    user-event の非同期の操作は、Vitest の偽のタイマーの下では RTL が `setTimeout` で待ったまま止まるため、このテストだけ `fireEvent` で入力する
  - 結果: 成功（テスト 17 ファイル・103 件、typecheck・lint）。追加したテストが修正前のコードで失敗すること、
    空白だけの入力のテストが `trim` を外すと失敗することを確かめた。
    dev（390px）で、切り替えの見た目が以前と同じこと、矢印キーで切り替わること、路線の駅一覧の縦線に路線色が出ることを確かめた

## PR 3: 各画面（依存: PR 2）（`feat/issue166-pr3-screens`）

- [x] **TASK-3.1** トップ（`app/page.tsx`）
  - 上部に見出しと検索、`Sheet`（新規。上端を丸めた白い本文エリア）にできることの一覧と事業者のチップ
- [x] **TASK-3.2** 路線の駅一覧（`app/lines/[slug]/stations/page.tsx`）。最初に駅一覧のタイムラインを `StationTimeline` に部品化する（design.md「駅一覧のタイムラインの部品化」）
  - `StationTimeline`（`<ol>`）に行の部品を閉じ込め、`StationCard` を消した。線はバッジの列の 50% から太さの半分を戻して置き、バッジの直径を参照しない。線の中心とバッジの中心が一致（実測 43px / 43px）
  - 路線記号の丸 `LineSymbol`（`line.lineCode`、無ければ駅番号の英字）。戻るボタンは `BackButton` に `href` を足してトップへのリンクにした
- [x] **TASK-3.3** 駅の詳細（`app/stations/[slug]/page.tsx`）、`TransferDifficultySection` の切り替え、`transferDifficulty.ts` の状態の色。テストを書き換える
  - 路線のチップ `stationLineChips()`（ホーム＋乗換先、路線名で重複を除く）
  - 移動手段を `SegmentedControl`（`radiogroup`「移動手段」）で切り替え、選んだ側だけを描く。初期はベビーカー。乗換先と移動手段の選択は互いに保たれる
  - テストは `MantineProvider` で包む。「何も表示しない」は、Mantine が `<style>` を差し込むため見出しとグループが無いことで確かめる
- [x] **TASK-3.4** `PlatformTabs`・`PlatformDisplay`、`loading.tsx`・`error.tsx`・`not-found.tsx`
  - `PlatformTabs` は方面が多いと横スクロールが要るため、`SegmentedControl` にせず色だけ置き換えた
  - `loading.tsx` は3つとも、本体と同じ「上部＋本文エリア」の骨組みにした
- [x] **TASK-3.5** `--color-*: initial` を入れ、`defaultColorClasses.test.ts` を足す（依存: TASK-3.1〜3.4）
  - テストを先に足し、3.4 の対象（PlatformTabs・PlatformDisplay・loading・error・not-found）の既定の色クラスと `#6b7280` で失敗することを確かめてから直した
  - 許可リスト: `mantineTheme.ts`（ADR-0017 決定5 の複製）、`platform-diagram` の `DEFAULT_LINE_COLOR`（PR 4 で見直す）
  - ビルドの CSS に `--color-gray-*` などが無く、新しいユーティリティ（`bg-wheelchair-50` など）が出ていることを確かめた
- [x] **TASK-3.6** 検証: typecheck・lint・test・build、全画面の目視（390px / 1280px）、Lighthouse のアクセシビリティ監査
  - 結果: 成功（テスト 18 ファイル・123 件、typecheck・lint・build）。Lighthouse のアクセシビリティは、トップ・路線の駅一覧（銀座線）・駅の詳細（春日）で 100（指摘 0 件）
  - 目視: トップ、路線の駅一覧、駅の詳細（ベビーカー → 車いすの切り替え）、404、読み込み中。乗換の評価がある駅は春日などに限られる
  - 目視で見つけて直した: `<main>` を flex にしたことで `Container`（`mx-auto`）が内容の幅に縮んでいた → `w-full` を足した
  - 残る点: 乗換先の多い駅（渋谷）では路線のチップが13個並ぶ。ホームの無い駅（春日）では自駅の路線がチップに出ない。どちらも、駅から乗り換えられる路線を導くドメインの関数として #172 で扱う。
    （路線記号の丸の白い文字のコントラストは TASK-3.7 で直した）
- [x] **TASK-3.7** PR #173 のレビューの指摘を直す
  - 路線色で塗った丸に白い文字を載せるのをやめた。`LineSymbol`（路線記号）と `PlatformDisplay`（番線の丸）は、`StationBadge` と同じく
    路線色を輪だけに使い、白地に `text-ink` で書く。銀座線（白と約 2.3:1）や路線色の無い路線（代わりの色 neutral-300 と白で約 1.8:1）でも読める（REQ-10）
  - `BackButton` は常に `href` へのリンクにし、`navigation.canGoBack`（同じオリジンの履歴）があるときだけ前の画面に戻る。
    駅の詳細を直接開いたときは何も起きなかった。`href` を必須にし、駅の詳細・路線の駅一覧とも `/` を渡す
  - `defaultColorClasses.test.ts`: 16進の色を引用符の直後に限らず拾い（コメントを取り除いてから走査）、`.css` の `@apply` も見る。
    Tailwind v4.2 の mauve・olive・mist・taupe を既定の色の一覧に足した。パターンそのもののテストを足した
  - 駅番号の解析を `features/station/domain/stationCode.ts` の `parseStationCode()` にまとめ、`StationBadge` と `LineSymbol` で共有する。
    `Mb03`（方南町支線）を、バッジでも英字と番号に分けて出す
  - 結果: 成功（テスト 21 ファイル・143 件、typecheck・lint・build）。dev（390px）で、銀座線の路線記号と渋谷の番線の丸が輪になったこと、
    路線の駅一覧 → 駅の詳細 → 戻るで駅一覧に戻ること、駅の詳細を新しいコンテキストで直接開いて戻るとトップへ行くことを確かめた

## PR 4: ホーム図パッケージ（依存: PR 1）（`feat/issue166-pr4-diagram`）

- [x] **TASK-4.1** `packages/platform-diagram/src/styles.css` の値を変える（design.md の表）。出口のコメントを ADR-0018 参照に書き換える
  - `ConcoursePlateRow` の「出口プレート（黄地に黒）」のコメントも ADR-0018 参照に書き換えた。凡例はトークン経由なので値の変更だけで足りた
  - TASK-3.5 で残した `DEFAULT_LINE_COLOR`（`#9ca3af`、Tailwind の gray-400）を、Web の `--color-rail-line-fallback`（neutral-300）と同じ `#c9bec2` にした。
    Admin は Web のトークンを読まないため値で持ち、`defaultColorClasses.test.ts` の許可リストに残す
- [x] **TASK-4.2** 検証: Web と Admin のホーム図を目視。出口のプレートが白地から浮くかを確かめ、足りなければ `--sign-exit-edge` を濃くする
  - 結果: 成功（typecheck・lint・test・build）。Web（淡路町、390px）と Admin（淡路町のホーム編集、1280px）で、号車・フリースペースの印・出口と乗換のプレート・凡例・
    フリースペース詳細・優先席のカードが新しい色になった
  - 出口のプレートは、輪郭を地と同じ色にしたままでも白地から浮いて見え、乗換のプレート（黒い輪郭）とも見分けられる。`--sign-exit-edge` は変えない
  - ホーム図のフリースペースの `<title>` のハイドレーションの不一致がコンソールに出るが、既知の #143 で今回の変更とは関係ない
- [x] **TASK-4.3** PR #176 のレビュー対応: 見えにくい色を直す（design.md「ホーム図のトークンの値の変更」）
  - TASK-4.2 の判断を覆し、`--sign-exit-edge` を butter-700 にする。出口の補足の文字の `opacity-75` を外す
  - 乗車位置の印を neutral-700（55%）、一部編成のフリースペースを brand-300 / 800、号車の枠を neutral-500 にする
  - 路線色が無いときの色を Web・ホーム図とも neutral-500 にし、`globals.test.ts` に一致の検査を足す
  - Admin の選択中のハンドルが `--sign-exit-*` を流用している件は、Admin のリニューアル（#179）で直す
  - `docs/domain/platform-coordinate-system.md` の「出口は黄地に黒」を、バター色と輪郭の記述に直す
  - 結果: 成功（typecheck・lint・test）。Web（淡路町、390px）と Admin（淡路町のホーム編集、1280px）で、乗車位置の印・号車の枠・出口のプレートの輪郭と補足の文字・凡例が新しい色になった。
    一部編成のフリースペースと路線色の無い路線は淡路町に無く、図では確かめていない（値はトークンの検査と比較ページで確認）

## PR 5: アイコン（依存: なし）（`feat/issue166-pr5-icon`。gh-stack では PR 4 の上に積む）

- [x] **TASK-5.1** キャンバスの案（`Icons3.dc.html`「採用：案X-1」）をそのまま使う。清書はしない（開発者の判断。ADR-0019「却下した選択肢」）
  - 視認性を確かめ、書き出しで手当てした: 16px 用は脚と線を太くし前照灯を省く。ヘッダー（36px）は文字なし版。iOS・Android 向けは正方形・透過なし。manifest は `purpose: "any"` だけ
- [x] **TASK-5.2** `icon.svg`・`apple-icon.png`・`favicon.ico`・`android-chrome-*.png` を差し替える（60px 未満は文字なしの版）
  - 文字は Zen Maru Gothic Bold（ビルド済みの `next/font` の woff2）の字形を fontTools でパスにした。元データは `icon-source/app-icon.svg`
  - ヘッダー用に `assets/app-icon-mark.svg` を足し、`layout.tsx` の import を変えた
- [x] **TASK-5.3** `manifest.json` のパスを `/icons/…` に直し、`name` / `short_name` を入れる
  - `name` / `short_name` は「ふらとら」、`theme_color` / `background_color` は `#FAF6F7`（ヘッダーの地）
  - `manifest.test.ts`（4 件）を足した。修正前の manifest で 3 件が失敗することを確かめた
- [x] **TASK-5.4** 検証: ブラウザのタブ、iOS のホーム画面に追加したときの表示
  - 済み: typecheck・lint・test（22 ファイル・148 件）・build。書き出した PNG を拡大して目視（512・180 で文字が読める、60 でかろうじて読める、32・16 で電車と線が見分けられる）。
    dev で、ヘッダーに新しいアイコンが出ること、`icon.svg`・`favicon.ico`・`apple-touch-icon` の `<link>` が出ること、manifest と各アイコンが 200 で返ること
  - 開発者が、PR #180 の Vercel のプレビューを iOS のホーム画面に追加し、新しいアイコンが出ることを実機で確かめた
- [x] **TASK-5.5** PR #180 のレビュー対応
  - `app/icon.svg` を `icon-source/app-icon-16.svg` に移し、タブのアイコンを `favicon.ico`（16・32・48）だけにする
  - `manifest.json` に `id`・`start_url`・`scope`（いずれも `/`）を足し、`manifest.test.ts` で検査する
  - 結果: 成功（typecheck・lint・test 149 件・build）。build の HTML で、`<link rel="icon">` が `favicon.ico` の 1 本だけになり、`icon.svg` が出ないことを確かめた。
    `favicon.ico` の 3 枚を拡大して目視した

## フェーズ5: ドキュメント（最後の PR に含める）

- [x] **TASK-6.1** `docs/domain/design-system.md` を新規作成する（現在のトークンの一覧、意味色の対応表、Tailwind・Mantine での使い方）。決定時点の見本として `docs/adr/assets/0017/` を参照する。`docs/domain/README.md` の一覧に足す
  - アイコンのファイルと版の対応も、ここに書いた（`icon-source/` に README は置かない）
- [x] **TASK-6.2** ADR-0017・0018 を、開発者の承認を得て `Accepted` にする。ADR-0019 はアイコン差し替えの後に `Accepted` にする
  - ADR-0017・0018 は、開発者の承認を得て `Accepted` にした
  - ADR-0019 は、iOS の実機での確認（TASK-5.4）の後に `Accepted` にした
- [x] **TASK-6.3** 範囲外の作業を Issue に起票する（requirements.md「範囲外」）
  - ホーム図の縦向き（#174）と優先席の位置（#175）は PR 4 の後に起票した
  - 路線の駅一覧の乗換路線（#177）、アプリ名の変更（#178）、Admin のデザイン（#179）を起票した。ダークモードは開発者の判断で起票しない
