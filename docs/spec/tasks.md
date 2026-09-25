# 実装タスク: 乗換難易度 新モデルのスキーマ実装 (Issue #122)

- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **ブランチ**: `feat/issue122-transfer-difficulty-schema`
- **前提**: Issue #30 のドメイン定義（commit 3c2fa0c）。#30 のブランチは未マージのため、
  本ブランチのPRは #30 のコミットを含む（#30 を先にマージするか、ベースを
  `docs/issue30-transfer-difficulty-model` にする）

## フェーズ1〜2: 分析・設計

- [x] **TASK-1** 現行スキーマ・読み手（Web / Admin）・`facility_types` の実データを確認
      （Neon main: 既存6値、`station_facilities` に `sameFloor` 3件）
- [x] **TASK-2** `docs/spec/` 3点セットを本Issue用に全面書き換え
- [x] **TASK-3** 開発者確認: 新テーブル追加 / `wheelchairEscalator` / 端点CHECKを付ける

## フェーズ3: 実装

- [x] **TASK-4** `packages/database/src/schema.ts` に4テーブルを追加
      （制約・コメントは design.md「データモデル」。REQ-1〜12）
- [x] **TASK-5** `drizzle-kit generate` で `0009_add_transfer_route_model.sql` を生成し、
      部分ユニークインデックスの `WHERE`・CHECK・既存表への差分が無いことを確認。
      `generate` は DB に接続しないため、`drizzle.config.ts` の要求を満たすダミーの
      `MIGRATION_DATABASE_URL` を環境変数で渡した
- [x] **TASK-6** `drizzle-kit generate --custom` で `wheelchairEscalator` の
      INSERT マイグレーション `0010_*.sql` を作成（REQ-11）。`seed-master-data.ts` にも追加
- [x] **TASK-7** `apps/admin/src/features/transfer-connection/domain/normalize.ts` と
      `normalize.test.ts`（REQ-3・4）

## フェーズ4: 検証

- [x] **TASK-8** database / admin / scripts の `tsc --noEmit` はエラー0。
      admin の vitest は 35 ファイル・473 テスト成功（正規化テスト8件を含む）。
      `pnpm run build` は 2/2 成功（DB に触れない）
- [x] **TASK-9** 生成SQLの目視確認: 4表・FK の onDelete（紐付け・設備は cascade、
      stations / facility_types は no action）・unique 4種・
      `CREATE UNIQUE INDEX ... WHERE "connection_routes"."is_baseline"`・
      CHECK は行値比較。既存テーブルへの変更なし（REQ-14）
- [x] **TASK-10** 開発者が development に `db:migrate` を実行（2026-09-25）。
      `drizzle.__drizzle_migrations` に 0009・0010 の2件が追加されたことを確認
- [x] **TASK-11** Neon MCP（read-only）で development を確認: 新4表が存在し行数0、
      `unique_connection_baseline` は `... USING btree (connection_id) WHERE is_baseline`、
      CHECK は `ROW(station_a_id, direction_a) < ROW(station_b_id, direction_b)`（方面は text
      にキャストされて比較される。`'inbound' < 'outbound'` は照合順序に依らず成立）、
      unique 4本が定義どおり、`facility_types` は7値。main は新表0・設備6値のまま（影響なし）
- [x] **TASK-12** 制約の動作確認SQL（`BEGIN … ROLLBACK`）を開発者が Neon コンソールで実行。
      NOTICE 17件がすべて OK（NG 0件）。内訳: 接続6（正規化済み通過・重複拒否・逆順拒否・
      完全同一拒否・同一駅方面違い通過・方面NULL拒否）／紐付け6（基準1本目通過・2本目拒否・
      同一label拒否・同一ルート2回拒否・非基準は複数可・別接続との共有）／設備4（seq=1通過・
      同一seq拒否・`wheelchairEscalator` 通過・未定義コード拒否）／cascade1（接続を消すと紐付けは
      消え、ルートは残る）。実行後に development の4表が0行であることを確認（ROLLBACK 済み）。
      **メモ**: `neonctl` に `psql` サブコマンドは無い。コンソールの SQL Editor は NOTICE を
      トーストで出すため、コピーできず件数の取りこぼしも分かりにくい。次回は結果を
      `SELECT` で返す形にするとよい

## フェーズ5: 振り返り

- [x] **TASK-13** `docs/domain/station-master-model.md` を更新した（上書き）。
      旧「乗換接続」節を「接続一覧」に改題し、新節「乗換難易度」を追加（適用状況の注記、
      4層構造、端点、不変条件の表、ルートと設備、備考の役割、`source`）。
      `docs/domain/README.md` の一覧も更新。design.md「フェーズ5で `docs/domain/` へ移す内容」
      の全項目が反映されたことを確認した。
      **設計からの調整**: 「難易度・備考は両方向に同じ値が入る」の記述は、design.md では
      削除する予定だった。実際は旧4列がまだ現行の読み書き対象（#125 まで）のため、
      「4列とともに廃止される」という現在の事実として書き換えて残した
- [x] **TASK-14** `docs/adr/` の確認: 新規ADRなし（決定1〜5はこの作業限りの判断）。
      ADR-0005（基準ルート付け替えは Repository + `withTransaction`。#124 の責務として
      記載）・ADR-0008（環境とDBブランチの対応。development で検証し main は変更なし）に
      反しない。ステータスを更新すべき `Proposed` の ADR は本Issueに無い
- [x] **TASK-15** スキーマ内コメントの確認: 部分ユニーク・CHECK・`connectionId` を持たない理由・
      `seq` の帰属規則に理由を添え、冒頭コメントから `docs/domain/station-master-model.md`
      を参照している

## フェーズ6: 引き渡し

- [x] **TASK-16** 恒久知識の取り残し確認: design.md の移送リスト全項目が
      `docs/domain/station-master-model.md` に反映済み。予定された将来作業は
      #123〜#125・#82・#128 として起票済みで、現在の制約は同文書に記載した
- [ ] **TASK-17** PR 作成（開発者判断）。PR 本文に `docs/domain/` の変更点
      （`station-master-model.md` の節の改題と新節の追加、`README.md` の一覧）を書く。
      #30 のコミットを含むため、#30 を先にマージするか、ベースを
      `docs/issue30-transfer-difficulty-model` にする
