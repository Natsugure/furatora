# タスク: Web アプリのデザインシステムを Soft Rose に刷新する (Issue #166)

PR ごとにブランチを分け、前の PR のブランチから順に切る（`gh-stack` で積む）。
PR 1〜3 は、すべてそろうまで develop へのマージを待つ（途中の状態では新旧の色が混ざるため）。

## PR 0: 仕様と決定（`feat/issue166-design-system-soft-rose`）

- [x] **TASK-0.1** Issue #166 を起票し、ブランチを切る
- [x] **TASK-0.2** `docs/spec/` の3点を書き換える
- [x] **TASK-0.3** ADR-0017・0018・0019 を `Proposed` で書き、`docs/adr/README.md` の一覧に足す
- [x] **TASK-0.4** デザインキャンバスの見本（PNG とソース）を `docs/adr/assets/0017/` に残し、ADR から参照する

## PR 1: 土台（PoC）

- [ ] **TASK-1.1** `globals.css` のプリミティブを差し替え、意味のトークンの参照先を変える（design.md「インターフェース」）
- [ ] **TASK-1.2** `@theme inline` に意味のある色の名前と書体、`@theme` に角丸と影を足す（`--color-*: initial` はまだ入れない）
- [ ] **TASK-1.3** `layout.tsx` に Zen Maru Gothic を足し、変数クラスを `<html>` に付ける
- [ ] **TASK-1.4** Web の `layout.tsx` で `@furatora/platform-diagram/styles.css` を読み込み、`globals.css` からホーム図のトークンを消す。汎用トークンの値を `styles.css` と揃える
- [ ] **TASK-1.5** `theme/mantineTheme.ts` と `mantineTheme.test.ts` を作り、`providers.tsx` に渡す（依存: TASK-1.1）
- [ ] **TASK-1.6** 検証: typecheck・lint・test・build。dev のトップ画面で、背景・文字色・書体・Mantine の部品が新しい値になることを確かめる（PoC の成功基準）

## PR 2: 共通部品（依存: PR 1）

- [ ] **TASK-2.1** ヘッダー・フッター（`layout.tsx`）
- [ ] **TASK-2.2** `StationBadge`・`BackButton`
- [ ] **TASK-2.3** `SearchTabs`・`StationSearch`
- [ ] **TASK-2.4** `StationCard`（タイムライン）・`OperatorList`
- [ ] **TASK-2.5** 検証: typecheck・lint・test・build、dev で部品を含む画面を目視

## PR 3: 各画面（依存: PR 2）

- [ ] **TASK-3.1** トップ（`app/page.tsx`）
- [ ] **TASK-3.2** 路線の駅一覧（`app/lines/[slug]/stations/page.tsx`）
- [ ] **TASK-3.3** 駅の詳細（`app/stations/[slug]/page.tsx`）、`TransferDifficultySection` の切り替え、`transferDifficulty.ts` の状態の色。テストを書き換える
- [ ] **TASK-3.4** `PlatformTabs`・`PlatformDisplay`、`loading.tsx`・`error.tsx`・`not-found.tsx`
- [ ] **TASK-3.5** `--color-*: initial` を入れ、`defaultColorClasses.test.ts` を足す（依存: TASK-3.1〜3.4）
- [ ] **TASK-3.6** 検証: typecheck・lint・test・build、全画面の目視（390px / 1280px）、Lighthouse のアクセシビリティ監査

## PR 4: ホーム図パッケージ（依存: PR 1）

- [ ] **TASK-4.1** `packages/platform-diagram/src/styles.css` の値を変える（design.md の表）。出口のコメントを ADR-0018 参照に書き換える
- [ ] **TASK-4.2** 検証: Web と Admin のホーム図を目視。出口のプレートが白地から浮くかを確かめ、足りなければ `--sign-exit-edge` を濃くする

## PR 5: アイコン（依存: なし。清書したデータが要る）

- [ ] **TASK-5.1** 清書したアイコンのデータを受け取る（別 Issue）
- [ ] **TASK-5.2** `icon.svg`・`apple-icon.png`・`favicon.ico`・`android-chrome-*.png` を差し替える（32px 以下は文字なしの版）
- [ ] **TASK-5.3** `manifest.json` のパスを `/icons/…` に直し、`name` / `short_name` を入れる
- [ ] **TASK-5.4** 検証: ブラウザのタブ、iOS のホーム画面に追加したときの表示

## フェーズ5: ドキュメント（最後の PR に含める）

- [ ] **TASK-6.1** `docs/domain/design-system.md` を新規作成する（現在のトークンの一覧、意味色の対応表、Tailwind・Mantine での使い方）。決定時点の見本として `docs/adr/assets/0017/` を参照する。`docs/domain/README.md` の一覧に足す
- [ ] **TASK-6.2** ADR-0017・0018 を、開発者の承認を得て `Accepted` にする。ADR-0019 はアイコン差し替えの後に `Accepted` にする
- [ ] **TASK-6.3** 範囲外の作業を Issue に起票する（requirements.md「範囲外」）
