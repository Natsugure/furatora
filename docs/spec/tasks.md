# タスク: ホーム座標の原点を「線路に向かって立ったときの左の端」に揃え、platformSide を廃止する (Issue #188)

ブランチ: `feat/issue188-platform-origin`（`main` から）

どのサイクルも TDD（テストを1つ書く → 期待した理由で失敗することを確かめる → 最小の実装 → 通る → Refactor）。

## 一段目（この PR）

- [x] **TASK-1** ブランチを切る。#174 の検討から #188・#189 を起票し、#174 に決定の要約をコメントする
- [x] **TASK-2** ADR-0022 を `Proposed` で書き、`docs/adr/README.md` の一覧に足す。`docs/spec/` の3点を書き換える
- [x] **TASK-3** 開発者のレビュー（spec と ADR-0022）
- [x] **TASK-4** サイクルA: `layoutRows()` から side を除く（`packages/platform-diagram`）
  1. `layoutRows()` が引数なしで今の `bottom` と同じ値を返す（束ね線なし・あり）
  2. `stripOrder` を除き、`PlatformDiagram` は固定の順で描く
  3. `ConcoursePlateRow` / `FacingTransferBannerRow` の `reverseLanes` を除く
  4. `PlatformDTO.platformSide` を除く
  - 1 は Red（並びの `stripOrder` が余分、オプションが side として読まれて束ね線なし）を確かめてから実装した
  - 2〜4 は振る舞いを変えないリファクタ（今の `bottom` の並びに固定）。オーバーレイは、対面乗換のバナーを段の逆順、プレートを正順のまま残した
- [x] **TASK-5** サイクルB: Web から除く（`stationDetailQuery.ts`・`PlatformDisplay.tsx`・テストのフィクスチャ）
  - TASK-4 の型の変更で `tsc` が4か所落ちる（Red）ことを確かめてから除いた
- [x] **TASK-6** サイクルC: Admin から除く
  1. `PlatformInspector`: 「ホーム位置」が無く、ホーム長の欄に原点の案内がある（Red → 実装）
  2. `schema.ts`・`ports.ts`・`platformRepository.ts`・`stationLayoutPageQuery.ts`・`StationLayoutEditor.tsx`
  - 1 は2件（選択欄が無く案内がある／送信内容に `platformSide` が無い）の Red を確かめてから実装した
  - `schema.test.ts` の「不正な値で失敗する」は「送られてきても捨てる」に置き換え、Red を確かめてから `schema.ts` を直した
- [x] **TASK-7** テーブル定義（`packages/database/src/schema/platform.ts`）と型 `PlatformSide`（`enums/stationMaster.ts`）から除く
- [x] **TASK-8** 手書きのマイグレーション（`drizzle-kit generate --custom`）を書く。design.md の SQL
  - `drizzle/0019_platform_origin_left_end.sql`。`0019_snapshot.json` は 0018 と id 以外同じ（列が残っている）ので、二段目の `db:generate` で DROP が出る
  - 流す前の値（main、2026-10-21）と期待値:

    | ホーム | 対象 | 前 | 後（期待） |
    |---|---|---|---|
    | 池袋2番線（L=140） | 1〜6号車 | 0–18 / 18–36 / 36–54 / 54–72 / 72–90 / 90–108 | 122–140 / 104–122 / 86–104 / 68–86 / 50–68 / 32–50 |
    | 池袋2番線 | アクセス点 | 0（サンシャイン通り）/ 30・65.5（中央通路） | 140 / 110・74.5 |
    | 茗荷谷1番線（L=120） | 1〜6号車 | 2–20 / 20–38 / 38–56 / 56–74 / 74–92 / 92–110 | 100–118 / 82–100 / 64–82 / 46–64 / 28–46 / 10–28 |
    | 茗荷谷1番線 | アクセス点（出口1〜3） | 80 / 100 / 120 | 40 / 20 / 0 |

- [x] **TASK-9** 検証
  - [x] typecheck・lint・test（platform-diagram 174 / web 155 / admin 643 / transfer-difficulty 66）・build（web・admin）が成功
  - [x] `platformSide` の参照は、マイグレーション・文書・「捨てる」ことを確かめるテストだけに残る
  - [x] （開発者）development に移行を流した。Neon MCP で、池袋2番線・茗荷谷1番線の号車とアクセス点が TASK-8 の期待値と一致し、
    `platform_side` が全件 null、マイグレーションが20件になったことを確かめた。main は変わっていない（`top` 8件、19件）
  - [x] （開発者）dev サーバーを起動し直し、Admin と Web の両方で2ホームが期待どおりの見え方になったことを確かめた
- [x] **TASK-10** 振り返り: `docs/domain/platform-coordinate-system.md` を上書きする（「どちらの端を x = 0 にするか」「縦方向」「レイヤ構成」の side の記述、Admin の案内）
  - 3節を上書きした。`.github/instructions/drizzle.instruction.md`・`packages/database/CLAUDE.md` の語彙の一覧から `PlatformSide` を除いた
- [x] **TASK-11** 引き渡し: PR（`main` 向け）。本文に「マージ後、すぐ次の作業で二段目を行う」と書く

## 二段目（次の PR。一段目のデプロイのすぐ次）

- [ ] **TASK-12** `main` から切り直したブランチで `pnpm run db:generate` し、`DROP COLUMN platform_side` だけが生成されたことを確かめる
- [ ] **TASK-13** ADR-0022 を `Accepted` にする（開発者の承認を得てから）。PR を出し、#188 を閉じる
