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
- [x] **TASK-9** PR を作る（#108・#160 を閉じる）: #198
- [x] **TASK-10** レビューの指摘への対応: リクエストボディの UUID も小文字にそろえる
  - パスだけを小文字にしたため、`POST /api/stations/{大文字}/connections` に同じ駅を大文字で送ると自己接続の判定をすり抜けた（`station_connections` に CHECK は無い）
  - 隣接の端点も、大文字・小文字が混ざると `normalizeAdjacencyEndpoints` の順序が DB の uuid の順序と食い違い、`.refine` の自己隣接の判定もすり抜けた（PR 前から）
  - `shared/schema/uuid.ts` の `uuidSchema`（検証して小文字にする）を作り、`features/*/schema.ts` と `lib/validations.ts` のボディの UUID、`parseUuidParam` で使う
  - Red を確かめたテスト: `uuidSchema` 2 件、乗換接続の route 2 件、隣接の schema 2 件、残りの schema 9 件。ユニット 672 件・型チェック・lint が通った
  - 見送った指摘（RFC に沿わない UUID の既存行は本番に 0 件、`connections/new` の searchParams は PR 前からの挙動、e2e の待ち方は不安定の根拠が弱い）と、技術的負債として起票した指摘（ガードの重複、`parseUuidParams` の置き場所、route のテスト不足）は PR のコメントに書く
