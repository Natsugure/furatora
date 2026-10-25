# タスク: Admin のパスパラメータを UUID か確かめ、小文字にそろえる (Issue #108・#160)

どのサイクルも TDD（テストを1つ書く → 期待した理由で失敗することを確かめる → 最小の実装 → 通る → Refactor）。

ブランチ: `fix/issue108-uuid-path-params`（`main` から）

- [x] **TASK-1** ブランチを切る
- [x] **TASK-2** `docs/spec/` の3点を #108・#160 用に書き換える
- [x] **TASK-3** サイクルA: `params.ts`
  1. `parseUuidParam` が大文字の UUID を小文字で返す
  2. `parseUuidParams` がすべて正しければ小文字にした同じ形を返す
  3. 1 つでも不正なら null
  - `parseUuidParams` が無い・小文字にしないことによる 5 件の Red を確かめてから実装した
- [x] **TASK-4** サイクルB: Route Handler（テストのあるルートは 404 のケースを先に足して Red を確かめる）
  - `operators/[operatorId]`、`trains/[trainId]`、`lines/[lineId]/**`、`stations/[stationId]/**`（18 ファイル）
  - 駅対の乗換の Route Handler を `parseUuidParams` に置き換え、戻り値を使う
  - テストのある 7 ファイルに 10 件のケースを足し、全件 Red（404 以外）を確かめてから置き換えた。メソッドは 28 個
- [x] **TASK-5** サイクルC: Page（12 ファイル）
  - `layout/page.tsx`・駅対の乗換の Page も置き換え、戻り値を使う
  - `connections/new/page.tsx` の `?operatorId=`・`?lineId=` を `parseUuidParam` で通す
  - Page は RSC のためユニットテストを書かず、TASK-6 の e2e で確かめた
- [x] **TASK-6** e2e: 代表的な Page の 404、大文字の駅 ID で駅対の乗換の画面に駅名が出る（`e2e/path-params.spec.ts`、10 件）
- [x] **TASK-7** 検証: `pnpm --filter admin test`、型チェック、lint、e2e、ブラウザで 404 と駅名
  - ユニット 657 件・型チェック・lint・`next build` が通った
  - e2e は 45 件のうち 40 件が通り、3 件はスキップ、2 件が落ちた。落ちた 2 件は、変更を退避した `main` の状態でも同じく落ちる（この PR と関係ない）
    - `station-layout.spec.ts` の反転編成のドラッグ: development の表参道（半蔵門線）にホームが無く「3番線」が見つからない
    - `operators.spec.ts` の新規フォーム: c72e61f でラベルが「表示優先度」から「表示順（…）」に変わったのに e2e が古い
  - ブラウザでの確認は、e2e（実ブラウザで 404 のページと駅名を見る）で代えた
- [x] **TASK-8** 振り返り: `docs/domain/` に変更が要らないことを確かめて記録する。Issue #108 の一覧と実際の差を PR に書く
  - `docs/domain/` は変えない。パスパラメータの扱いはドメインルールではなく Admin の実装の約束で、`parseUuidParams` の JSDoc に書いた
  - ADR の追加・ステータス変更は無い
- [ ] **TASK-9** PR を作る（#108・#160 を閉じる）
