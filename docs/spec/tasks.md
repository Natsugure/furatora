# 実装タスク: 乗換難易度 既存行のデータ移行 (Issue #123)

- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **ブランチ**: `feat/issue123-transfer-difficulty-migration`（`develop` から作成）
- **前提**: Issue #122（PR #131）のマージ済み。新4表は全て0件

## フェーズ1〜2: 分析・設計

- [x] **TASK-1** 実データの確認（Neon MCP read-only）。旧17行・15駅対・接続60行、丸ノ内線の方面の向き、
      対象20駅の `slug`、main と development の旧行が一致することを確認した
- [x] **TASK-2** `docs/spec/` 3点セットを本Issue用に全面書き換え（REQ-1〜21）
- [x] **TASK-3** 開発者確認（2026-09-25）: 事実は「下書き→開発者が補完」/ 本郷三丁目の備考は残す /
      御茶ノ水 丸ノ内↔JR中央・総武線（備考のみの17行目）も移行する /
      設備は「並び」ではなく「種類の集合」で持つ（決定4。本Issueのブランチで先にスキーマ変更をする）

## フェーズ3: 実装 — 設備の集合化（スキーマ変更。REQ-19〜21）

- [x] **TASK-4a** `packages/database/src/schema.ts` の `transferRouteFacilities` から `seq` を削除し、
      `unique_transfer_route_facility_type (routeId, typeCode)` を追加。コメントを集合の意味に書き換えた。
      `seq` を参照するコードが他に無いこと・`tsc --noEmit`（database）がエラー0であることを確認した
- [x] **TASK-4b** `drizzle-kit generate` で `0011_transfer_route_facilities_as_set.sql` を生成
      （ダミーの `MIGRATION_DATABASE_URL`）。生成SQLは `DROP CONSTRAINT` / `DROP COLUMN seq` /
      `ADD CONSTRAINT` の3文のみで、他の表に変更が無いことを確認。冒頭に理由のコメントを追加した
- [x] **TASK-4c** 適用前の確認（REQ-20）を Neon MCP（read-only）で実施（2026-09-25）:
      main は新4表が存在せず適用済みマイグレーション9件（0009 未適用）。development は新4表が全て0行
      （適用済み11件。`transfer_route_facilities` の列は `id,route_id,seq,type_code`）。
      preview/develop は新4表が全て0行（適用済み11件）。`seq` を落としても失われるデータは無い
- [x] **TASK-4d** 開発者が development に `pnpm run db:migrate` を実行した（2026-09-25）。
      Claude が Neon MCP（read-only）で確認: `transfer_route_facilities` の列は `id,route_id,type_code`（`seq` 無し）、
      制約は PK・FK 2本・`unique_transfer_route_facility_type (route_id, type_code)`、適用済みマイグレーション12件、
      行数0。main は新4表が存在せず適用済み9件のまま（影響なし）

## フェーズ3: 実装 — データ移行

- [x] **TASK-5** **【ゲート】** 開発者が design.md「移行データ表」の Q0〜Q11 を確定した（2026-09-26。
      既定案を含めて提案どおりで承認）。確定した内容で design.md を更新した（ルート21本・接続60・紐付け84・設備18）
- [x] **TASK-6** `drizzle-kit generate --custom --name migrate_transfer_difficulty` で
      `0012_migrate_transfer_difficulty.sql` を作り、確定した表を DO ブロックとして書いた（REQ-3〜16）。
      冒頭のコメントに、なぜ手書きのデータ移行か・`slug` で引く理由・ガードの意図・自己検証・設備0件の意味・
      経路上の選好を移さなかったこと・本郷三丁目の備考を残した判断を書いた（0005 / 0010 の書式に倣う）。
      **ローカル検証**: PGlite（WASM 版 Postgres。scratchpad に導入。プロジェクトの依存関係は変えていない）に
      0000〜0011 を適用し、20駅の仮データで 0012 を実行した。24項目すべて OK: 件数（60・21・84・18）、
      基準ルートを持たない接続 0・孤立ルート 0、淡路町↔小川町が方面ごとに別ルートを2接続で共有、
      御茶ノ水の8接続が1本を共有、池袋・春日は共有しない、二重実行・駅なし・設備マスタなしはスキップ、
      設備の欠落は自己検証の例外でロールバックされ何も残らない

## フェーズ4: 検証

- [x] **TASK-7** 事前検証（PoC）。開発者が development で
      `BEGIN; <DO ブロック>; <検証 SELECT>; ROLLBACK;` を実行した（2026-09-26。`neon psql development` で
      1ファイルを実行）。検証 SELECT の12行すべて `ok = t`（接続60・ルート21・紐付け84・設備18、
      基準ルートを持たない接続0・孤立ルート0、駅対15組・各4接続、「大手町」0、本郷三丁目の notes 4、
      設備0件のルート6、御茶ノ水は1本を共有、淡路町↔小川町はルート2本）
- [x] **TASK-8** 開発者が development に `pnpm run db:migrate` を実行した（2026-09-26）。
      Claude が Neon MCP（read-only）で確認: 接続60・ルート21・紐付け84・設備18、適用済みマイグレーション13件、
      基準ルートを持たない接続0・孤立ルート0・設備0件のルート6・`manual` の接続8、ルートごとの
      （label・フラグ・設備の種類・参照する接続数）が移行データ表と一致（淡路町↔小川町の2本は各2接続、
      御茶ノ水の1本は8接続）。main は新4表が存在せず適用済み9件のまま、旧17行も変わらない
      （Production への適用は `main` へのリリース時に Vercel が行う）
- [x] **TASK-9** `pnpm run typecheck`（5パッケージ）はエラー0。`pnpm run test` は admin 35ファイル・473テスト、
      platform-diagram 8ファイル・203テスト、frontend 3ファイル・13テストがすべて成功。
      `pnpm run build` は 2/2 成功（DB に触れない。REQ-18）

## フェーズ5: 振り返り

- [x] **TASK-10** `docs/domain/station-master-model.md`「乗換難易度」節を上書きした（2026-09-26）:
      (1) 適用状況の注記（スキーマ＋評価済み15駅対・60接続を移行済み。読み書きするコードはまだ無い）、
      (2) 設備の集合化（4層構造の図・不変条件の表・「ルートと設備」の項。design.md「フェーズ5で
      `docs/domain/` へ移す内容」）、(3) 設備0件のルートは「設備未入力」（決定5・REQ-22）。
      ほかのドメインルール（4層構造・接続の不変条件）に変更が無いことを確認した。
      加えて、決定2（本郷三丁目の備考）を「備考の役割」の**既知の例外**として1段落添えた（ルールは変えない）。
      `docs/domain/README.md` の一覧の記述は変更不要。`seq`・設備の並びの記述が `docs/`・`schema.ts` に残っていないことを grep で確認した
- [x] **TASK-11** `docs/adr/` の確認: 決定4を ADR-0011（Accepted）、決定5を ADR-0012（Proposed。#125 で Accepted にする）
      として新規作成し、`schema.ts`・0011/0012 の SQL コメント・`docs/domain/` の参照先を ADR に差し替えた
      （レビュー指摘: `docs/spec` は次のIssueで消えるため）。決定1〜3はこの作業限りの判断。既存ADRのステータス更新なし（
      ADR-0005 は基準ルート付け替えの責務が #124 にあり、本Issueの一括 INSERT は1文で原子的。
      ADR-0008 は development で検証し main は変更しない）
- [x] **TASK-12** マイグレーション SQL のコメントの確認（0011・0012 とも冒頭に理由と参照先を記載）: ガードを外そうとする人・値を書き換えようとする人が
      読む場所に、理由と参照先（本書・#30）が置かれていること

## フェーズ6: 引き渡し

- [x] **TASK-13** 恒久知識の取り残し確認（design.md「フェーズ5で `docs/domain/` へ移す内容」の全項目が反映済み）: 本書の「フェーズ5で `docs/domain/` へ移す内容」が反映済みで、
      #124・#125 が Issue として起票済みであること
- [x] **TASK-14** **マージ直前に、main の旧17行（難易度4列）が変わっていないことを再確認する。**
      SQL は値を埋め込んでいるため、Admin で旧行を編集されると移行結果とずれる。
      **2026-09-26 00:58 UTC 時点で確認済み（Neon MCP read-only・main）**: 難易度か備考が入っている行は
      移行データの作成時と同じ17行（同じ `id`）。難易度は全行が一致し、備考は md5 を取得して、作成時に読んだ
      備考文から計算した md5 と9種類すべて一致（本郷三丁目・淡路町↔小川町は、ベビーカー側と車いす側で
      文言が異なることも含めて一致）。`station_connections` 全体（6,950行）の `updated_at` の最大は
      2026-09-15 23:56 UTC で、2026-09-24 以降に更新された行は0。
      **限界**: `updated_at` は Drizzle の `$onUpdate`（アプリ経由の更新）でしか進まず、SQL の直接更新は
      検知できない（そのため備考は md5 でも確認した）。**PR のマージまでに日数が空く、または Admin で
      乗換接続を編集した場合は、同じ確認を再実施すること**（17行の `id`・難易度・備考の md5 を再取得して比較する）
- [ ] **TASK-15** PR 作成（開発者判断・`develop` 向け）。PR 本文に `docs/domain/` の変更点
      （適用状況の注記の上書き・設備の集合化）と、決定2（本郷三丁目の備考が「備考の役割」の例外になる点）、
      決定4（#30・#122 の「直列の並び」を覆したこと）を書く
