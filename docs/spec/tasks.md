# 実装タスク: 駅・路線マスタの ekidata 移行 (Issue #56 / ADR-0007)

- **対象**: `packages/database`, `apps/admin`, `apps/scripts`, `apps/web`
- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md) /
  [ADR-0007](../adr/0007-station-master-data-source.md)
- **作成日**: 2026-08-28
- **ブランチ**: `docs/station-database-transition`
- **信頼度**: 88%（高）

## フェーズ構成

```
Phase 0: docs/spec・ADR更新                      (完了)
Phase 1: スキーマ変更 + トランザクション規模の計測  (完了・未知は解消)
Phase 2: インポート機構                           (P0)
Phase 3: 移行スクリプト（突合）                    (P0・Phase 2 に依存)
Phase 4: ODPT 後始末                             (Phase 3 完了後)
Phase 5: 公開ガードと Admin UI                     (P0・現行バグの修正を含む)
Phase 6: 検証・振り返り                            (必須)
```

### 実行順序の根拠

Phase 1 に**唯一の未知**（約46,500行の一括投入が `withTransaction` で成立するか）がある。
ここで分割コミットが必要と判明すると Phase 2 の `applyImport` の構造が変わるため、
Phase 2 に入る前に片付ける。ただし Phase 1 の**内部では計測を末尾に置く**。
投入コストを決めるのはインデックスと制約の数であり、
移行後スキーマの適用（TASK-1.5）を待たなければ数値が使えないためである。

Phase 4（ODPT 後始末）は Phase 3 の後にしか置けない。突合が
`odptStationId` / `odptRailwayId` に依存しており、先に消すと移行できなくなる。

Phase 5 に**現行バージョンのバグ修正**（TASK-5.0）が入る。可視性の判定が
一覧の取得箇所2つにしか無く、詳細ページと公開APIの6経路が無防備である
（requirements.md US-7）。可視性が `publishedAt` へ移る本Issueと
不可分であるため、別Issueに切り出さずここで塞ぐ。

TASK-3.7（`publishedAt` バックフィル）→ TASK-3.8（`displayPriority` の
`NOT NULL` 化）の順序は**入れ替えられない**。バックフィルが
「移行前に非表示だった事業者」を `displayPriority IS NULL` で判別するため、
先に埋めると情報が失われ、非表示だった駅まで公開されてバグが恒久化する。

---

## Phase 0: docs/spec・ADR更新（完了）

### TASK-0.1: ADR-0007 を実測に合わせて更新
- **状態**: ✅ 完了 (2026-08-28)
- **内容**: 会員版採用を決定1に追記 / 却下案「無料版CSVで運用する」を追加 /
  路線色・カナ・新幹線の欠落を実測値で記述 / 出典表示義務と再配布条項の確認結果を反映
- **備考**: ステータスは `Proposed` のまま。`Accepted` 化は Phase 6

### TASK-0.2: requirements.md / design.md / tasks.md を作成
- **状態**: ✅ 完了 (2026-08-28)

---

## Phase 1: スキーマ変更 + 規模計測（完了 2026-08-31）

**結果**: スキーマは `development` ブランチに適用済み。
本Issue唯一の未知だった「約46,500行の一括投入が `withTransaction` で成立するか」は
**成立する**（全体7.3〜8.0秒 / 制限の1/37）。Phase 2 の `applyImport` は
単一トランザクション・`BATCH_SIZE = 1000` で確定した。

**実行順序**: TASK-1.2 → 1.3 → 1.3b → 1.4 → 1.5 → **1.1（計測）**。
計測を Phase 1 の末尾に置くのは、投入コストを決めるのが行数ではなく
**インデックスと制約の数**であるためである。移行後スキーマが適用された状態で
測らなければ、得た数値が Phase 2 の判断材料にならない。
Phase 2 より前であることは変わらないため、「唯一の未知を先に潰す」という
[実行順序の根拠](#実行順序の根拠)は保たれる。

### TASK-1.2: 新設テーブルのスキーマ定義
- **状態**: ✅ 完了 (2026-08-30)
- **依存**: なし
- **内容**: `stationGroups` / `stationAdjacencies` を
  `packages/database/src/schema.ts` に追加
- **注意**: `serviceRoutes` / `serviceRouteSegments` は**作らない**。
  路線概念が3種類に割れており、今回データも投入しないため
  （[design.md](./design.md)「`serviceRoutes` を今回は作らない」）
- **期待結果**: 2テーブルが定義され、型が通る

### TASK-1.3: 既存テーブルの列追加
- **状態**: ✅ 完了 (2026-08-30)
- **依存**: TASK-1.2
- **内容**: `operators.ekidataCompanyCd` / `lines.ekidataLineCd` / `lines.abolishedAt` /
  `stations.ekidataStationCd` / `stations.stationGroupId` / `stations.prefCode` /
  `stations.abolishedAt` / `stations.publishedAt` / `stationConnections.source` を追加
- **注意**: `operators.displayPriority` の `NOT NULL DEFAULT 0` 化は**ここで行わない**。
  TASK-3.7 のバックフィルが「移行前に非表示だった事業者」を判別するために
  NULL を必要とする。TASK-3.8 で行う
- **注意**: この時点では**制約の削除を行わない**。既存データが移行前のため
- **期待結果**: 列が追加され、既存の読み書きが壊れない

### TASK-1.3b: `published_requires_slug` の CHECK 制約を付与
- **状態**: ✅ 完了 (2026-08-30)
- **依存**: TASK-1.3
- **内容**: `check('published_requires_slug', sql\`published_at IS NULL OR slug IS NOT NULL\`)`
- **事前確認**: **既存481行の `slug` に NULL が無いことを SQL で確認する。**
  design.md は「`update-odpt.ts` が全件生成済み」を前提にしているが、
  TASK-3.7 のバックフィルが失敗しないことを保証するため実測する
- **事前確認の結果（2026-08-30 実測）**: `stations.slug` の NULL は **0件 / 481行**、
  `lines.slug` の NULL も **0件 / 62行**。制約違反なしで付与できることを確認済み
- **期待結果**: 制約が付与される。この時点で `publishedAt` は全行 NULL のため違反は出ない

### TASK-1.3c: `stationConnections` に `unique(stationId, connectedStationId)` を付与
- **状態**: ✅ 完了 (2026-08-30)
- **依存**: TASK-1.3
- **内容**: `unique('unique_station_connection').on(t.stationId, t.connectedStationId)`
- **なぜ Phase 4 ではなく Phase 1 か**: TASK-2.8 の `onConflictDoNothing` が
  この制約を衝突対象にする。無い場合は衝突が起きず、再実行のたびに重複行が積み上がる。
  **Phase 2 より前に必要である**（design.md は Phase 4 側に書いていたが誤り）
- **事前確認の結果（2026-08-30 実測）**: 既存546行のうち
  `(station_id, connected_station_id)` の重複ペア **0件**、
  `connectedStationId` の NULL **0件**。付与可能
- **期待結果**: インポートが冪等になる

### TASK-1.4: 制約が無い理由をスキーマのコメントに残す
- **状態**: ✅ 完了 (2026-08-30)
- **依存**: TASK-1.3
- **内容**: 2箇所に記述する
  1. `odptStationId` / `odptRailwayId` / `odptOperatorId` の定義に、
     **なぜ一意制約が無いか**（ADR-0007 の「影響」）
  2. `stationLines` に、**なぜ `unique(stationId)` が無いか**。
     実測0件は ekidata が路線ごとに駅を割った結果であり、ドメインの不変条件ではないこと。
     粒度が暫定であること（design.md「粒度は暫定である」）
- **期待結果**: 次にスキーマへ触れる者が制約の欠落をバグと誤認して付与しない

### TASK-1.5: マイグレーション生成と適用
- **状態**: ✅ 完了 (2026-08-30)
- **依存**: TASK-1.3, TASK-1.3b, TASK-1.3c, TASK-1.4
- **内容**: `pnpm run db:generate` → 開発DBで `db:push`
- **成果物**: `packages/database/drizzle/0004_red_the_santerians.sql`
  （`CREATE TABLE` 2件 / `ADD COLUMN` 9件 / `ADD CONSTRAINT` 9件。**制約の削除は含まない**）
- **適用先**: Neon `furatora-db` の `development` ブランチ。
  デフォルトブランチ（main）に新テーブル・新列・CHECK のいずれも入っていないことを
  適用後に確認済み
- **ウィザードの応答**: 4件すべて「truncate しない」を選択。
  内訳と根拠は以下。いずれも制約違反は発生しない

| 制約 | 対象 | 状況 |
|---|---|---|
| `stations_ekidata_station_cd_unique` | stations 481行 | 追加直後で全行 NULL。UNIQUE は NULL を重複と見なさない |
| `lines_ekidata_line_cd_unique` | lines 62行 | 同上 |
| `operators_ekidata_company_cd_unique` | operators 17行 | 同上 |
| `unique_station_connection` | station_connections 546行 | **実データに対する唯一の制約**。重複ペア0件・NULL 0件を事前に SQL で確認済み |

- **備考**: `identifier ... will be truncated` の NOTICE 4件は、既存の FK 名が
  PostgreSQL の識別子上限63文字を超えていることによる従来からの警告であり、本変更とは無関係

### TASK-1.1: トランザクション規模の計測
- **状態**: ✅ 完了 (2026-08-31)。**判定 = 一括で確定**
- **依存**: TASK-1.5（**「依存なし」ではない**。上記「実行順序」を参照）
- **計測先**: **Neon のブランチを切る。** 開発DBには流さない。
  失敗時の後始末が不要になり、同条件で何度でもやり直せる。
  親は `furatora-db`（`patient-meadow-13439419`）。
  compute は既定の **0.25 CU 固定**であり本番と同条件のため、数値をそのまま採用できる
- **注意**: Neon MCP は read-only 設定のためブランチ作成に使えない。
  Neon CLI（`neonctl branches create`）またはコンソールで作成し、
  接続文字列を `MEASURE_DATABASE_URL` に渡す
- **安全装置**: 計測スクリプトは `DATABASE_URL` を**読まない**。
  専用の `MEASURE_DATABASE_URL` のみを見る。`.env` を書き換えて計測する運用は、
  戻し忘れで開発DBに合成データを流し込む事故と紙一重である

#### 対象行数（tasks.md 初版の 35,000 は過小である）

| テーブル | 行数 |
|---|---|
| `stations` | 10,465 |
| `stationLines` | 10,465 |
| `stationAdjacencies` | 10,189 |
| `stationGroups` | 8,766 |
| `stationConnections` | 5,876 |
| `lines` | 602 |
| `operators` | 175 |
| **計** | **約 46,500** |

`stationLines` と `lines` が初版の見積もりから漏れていた。ekidata は路線ごとに
駅を割るため `stationLines` は `stations` と同数になる（TASK-1.4 の「実測0件」の理由そのもの）。

#### 「収まるか」は4つの別々の制限であり、3つは実測で解消済み

Neon `furatora-db`（project `patient-meadow-13439419` / PG17 / 0.25 CU 固定）で
`pg_settings` を読んだ結果（2026-08-30）:

| # | 制限 | 実測値 | 判定 |
|---|---|---|---|
| 1 | `statement_timeout` | **0（無制限）** | **効かない** |
| 2 | `idle_in_transaction_session_timeout` | **300,000ms（5分）** | 文と文の**間**にのみ効く。全体時間には効かない |
| 2' | `idle_session_timeout` | 0（無制限） | 効かない |
| 3 | WebSocket の寿命 / Neon proxy の切断 | 未知 | **これだけが実測対象** |
| 4 | bind パラメータ上限 65535/文 | 既知定数 | `stations` は20列 → 全列を書くなら上限 3,276行/文 |

**2 はトランザクション全体の制限ではない。** 「文を実行していない状態」が5分続くと
切られる制限であり、バッチを連続で投げる限りアイドルはネットワーク往復1回分でしかない。
したがって**CSVのパースをトランザクションの外に出すことが必須**である。
中でパースすると、この5分に対して初めてリスクが生じる。

**残る実測対象は 3 だけである。**

#### BATCH_SIZE は 100 では小さすぎる可能性が高い

DBリージョンは `ap-southeast-1`（シンガポール）であり、往復遅延が無視できない。
`update-odpt.ts` 踏襲の `BATCH_SIZE = 100` では約46,500行を **465往復**に分割することになり、
RTT を仮に80msとすると**ネットワーク待ちだけで約37秒**が積算する。
制限 4 から上限は約3,400行/文なので、1,000 まで上げれば47往復で済む。
**計測で 100 / 500 / 1000 を比較し、往復回数が支配的かを確認する。**

#### 投入データ

**合成データでよい。** Phase 2 のパーサが未実装であり、かつ INSERT のコストは
行数・行サイズ・インデックス数で決まり値の意味に依存しないため。ただし3点を本番に寄せる。

- **本番と同じ upsert 文**（`onConflictDoUpdate`）を使う。plain insert では過小評価になる
- **2周流す。** 1周目=全件新規、2周目=全件衝突更新。定常状態は2周目であり、こちらが重い
- FK の依存順（`operators` → `lines` → `stationGroups` → `stations` →
  `stationLines` / `stationAdjacencies` / `stationConnections`）
- varchar は実データの平均長に寄せる（行サイズが投入時間に効くため）

#### 記録する値

- テーブルごとの経過ms / 行数 / rows/sec
- `BEGIN` 〜 `COMMIT` の全体壁時計時間、および `COMMIT` 単体の時間
- 成否。失敗時は**エラーコードまで**（タイムアウトなのか接続断なのかを区別する）
- `SHOW statement_timeout` / `SHOW idle_in_transaction_session_timeout` の実値
- BATCH_SIZE を 100 / 500 / 1000 で比較する。一括が不成立でも
  「どこを詰めれば通るか」が同じ実行で分かる

#### 判定基準（計測前に確定させたもの）

| 結果 | 決定 |
|---|---|
| 成功 かつ 全体時間 < 制限値の 1/3 | **一括で確定。** `applyImport` は単一 `withTransaction` |
| 成功 かつ 制限値の 1/3 〜 1/2 | 一括のまま。ただし「パースをトランザクション外に出す」を design.md の必須条件として明記 |
| 失敗 または 制限値の 1/2 超 | **テーブル単位の分割コミットへ倒す。** design.md の該当箇所を更新 |

#### 計測結果（2026-08-31 / `BATCH_SIZE = 1000` / 46,538行 / 50文）

| テーブル | 行数 | 1周目 | 2周目 |
|---|---|---|---|
| `operators` | 175 | 207 ms (1文) | 175 ms |
| `lines` | 602 | 382 ms (1文) | 344 ms |
| `stationGroups` | 8,766 | 1,267 ms (9文) | 1,416 ms |
| `stations` | 10,465 | 2,036 ms (11文) | 1,892 ms |
| `stationLines` | 10,465 | 1,320 ms (11文) | 1,177 ms |
| `stationAdjacencies` | 10,189 | 1,444 ms (11文) | 1,132 ms |
| `stationConnections` | 5,876 | 907 ms (6文) | 735 ms |
| **`withTransaction` 全体** | **46,538** | **7,960 ms** | **7,293 ms** |

内訳: コールバック内 7,564 / 6,871 ms、接続+BEGIN+COMMIT 396 / 422 ms、
1文あたり平均 151.3 / 137.4 ms。
サーバ設定は事前調査と一致（`statement_timeout = 0`、
`idle_in_transaction_session_timeout = 300,000 ms`、`idle_session_timeout = 0`）。

#### 判定と、そこから確定したこと

**成功。全体時間は制限値の 1/37（2.4〜2.7%）であり、判定表の第1行に該当する。**

1. **`applyImport` は単一 `withTransaction`。** テーブル単位の分割コミットは採らない
2. **`BATCH_SIZE = 1000` を採用値とする**
3. **パースは必ずトランザクションの外で行う（必須条件）。**
   300,000ms は文と文の「間」にのみ効く制限であり、この8秒は制限に当たっていない。
   トランザクション内でCSVを解析すると、そこで初めてこの5分がリスクになる
4. **BATCH_SIZE の追加計測（100 / 500）は行わない。**
   1文あたり137〜151msに対し `operators` は175行1文で207ms、`lines` は602行1文で382ms。
   行数を1/6にしても時間は半分にしかならず、固定費（往復遅延）が支配的である。
   BATCH_SIZE を上げれば全体は縮むが、8秒を4秒にする最適化に判断が乗っていない

- **完了条件**: ✅ 数値が記録され、Phase 2 の `applyImport` の構造が確定した
- **後始末**: 計測用スクリプトと Neon 計測ブランチを削除する（TASK-6.5）

#### 成果物

- ✅ 制限値の実測（上表）
- ✅ 事前確認（`slug` の NULL、重複ペア）
- ✅ 計測スクリプト `apps/scripts/src/measure-tx-scale.ts`
  - 接続先は `MEASURE_DATABASE_URL` でしか与えられない。未設定・`DATABASE_URL` と同一の
    いずれでも起動しない。`.env` は書き換えないため戻し忘れの経路が存在しない
  - 本番の書き込み経路そのものを測るため `withTransaction` を複製せず直接呼ぶ
  - 実行: `MEASURE_DATABASE_URL='...' BATCH_SIZE=1000 RUN_INDEX=0 pnpm --filter scripts exec tsx src/measure-tx-scale.ts`
  - `BATCH_SIZE` を変えて比較する際は `RUN_INDEX` も 0/1/2 と変える
    （実行ごとに独立したコード範囲と UUID を使い、各回を「新規投入 → 全件更新」に揃えるため）
- ✅ 計測の実行（Neon の使い捨てブランチ上）

---

## Phase 2: インポート機構

### TASK-2.1: CSV パーサと型定義
- **依存**: Phase 1
- **成果物**: `apps/admin/src/external/ekidata/ekidataCsvParser.ts` と
  `features/master-import/domain/importedRecords.ts`、`ports.ts` の `EkidataCsvSource`
- **内容**: company / line / station / join の4種の行型とパース関数。
  `e_status` による現役判定。必須列の検証
- **注意**: `station_cd` の上位桁から `line_cd` を導出しない（137件の例外がある）
- **テスト**: 必須列欠落 / `e_status` 分岐 / 上位桁不一致の行

### TASK-2.2: 駅名正規化
- **依存**: なし
- **成果物**: `apps/admin/src/features/master-import/domain/normalize.ts`
- **内容**: 括弧を**中身ごと**除去（`〈〉` と `（）` の両方）、`ヶ` → `ケ`
- **テスト**: `押上〈スカイツリー前〉` / `押上（スカイツリー前）` → `押上`、
  `市ケ谷` / `市ヶ谷` の一致、正規化後に別駅が衝突しないこと

### TASK-2.3: 差分計画の算出
- **依存**: TASK-2.1, TASK-2.2
- **成果物**: `apps/admin/src/features/master-import/domain/plan.ts`
- **内容**: 新規 / 更新 / 廃止 / 突合失敗 の判定。空値では上書きしない規則。
  `station_g_cd` のダングリング13件は所属駅の最小 `station_cd` から代表値を決定
- **テスト**: 冪等性（同一入力で差分0）、空値保護、ダングリング処理

### TASK-2.4: ports とリポジトリ
- **依存**: TASK-2.3
- **成果物**: `features/master-import/ports.ts`,
  `external/repository/masterImportRepository.ts`, `di.ts` への配線
- **内容**: 全テーブルを**単一の** `withTransaction` で適用する（TASK-1.1 で確定。
  分割コミットは採らない）。`BATCH_SIZE = 1000`。conflict target は `ekidata*Cd`
- **注意**: `measure-tx-scale.ts` の `MAX_SAFE_BATCH = 4000` を**安全上限として流用しない**。
  あれは計測スクリプトが stations に12列しか渡さないことを前提とした値である。
  全列を書く本経路の上限は 3,276行/文であり、`BATCH_SIZE = 1000` はその内側にある
- **必須条件**: **CSVのパースをトランザクションの外で終えていること。**
  `idle_in_transaction_session_timeout = 300,000ms` は文と文の間にのみ効くため、
  トランザクション内で解析すると、そこで初めてこの制限がリスクになる
- **あわせて**: TASK-2.1 の `EkidataCsvSource` も `di.ts` で配線する。
  `usecases/ → external/` の直接 import は依存の向きに反するため
  （[ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md)）

### TASK-2.5: usecases
- **依存**: TASK-2.4
- **成果物**: `usecases/planImport.ts`, `usecases/applyImport.ts`
- **テスト**: ports をスタブして調停ロジックを検証

### TASK-2.6: Route Handler
- **依存**: TASK-2.5
- **成果物**: `apps/admin/src/app/api/master-import/route.ts`
- **内容**: multipart で4ファイルを受け、`mode: 'plan' | 'apply'` を切り替える
- **完了条件**: **1.4MB の `station` CSV が通ること**（Server Action を使わない理由そのもの）

### TASK-2.7: アップロードUI
- **依存**: TASK-2.6
- **成果物**: `features/master-import/components/MasterImportForm.tsx`,
  `app/master-import/page.tsx`
- **内容**: 4ファイル選択 → 計画のプレビュー表示 → 承認して適用

### TASK-2.8: 乗換接続の生成
- **依存**: TASK-2.4
- **内容**: 同一 `station_g_cd` の現役駅の全順序対（5,876行）を
  `source = 'ekidata_group'` で生成。`source = 'manual'` には触れない。
  難易度入力済みの行は `onConflictDoNothing`

---

## Phase 3: 移行スクリプト（突合）

### TASK-3.1: 事業者の突合
- **依存**: Phase 2
- **成果物**: `apps/scripts/src/migrate-to-ekidata.ts`
- **内容**: `odptOperatorId` → `company_cd` の対応表17件（design.md に記載済み）
- **期待結果**: 17件すべてに `ekidataCompanyCd` が入る

### TASK-3.2: 路線の突合
- **依存**: TASK-3.1
- **内容**: 事業者を確定した上で、路線名の正規化一致 → 全駅包含判定の順に試みる。
  要手動4件（`常磐線快速` / `東海道線` / `豊島線` / `東武スカイツリーライン(支線)`）は
  対応表に直接書く
- **期待結果**: 62路線のうち自動42 + 手動4 が解決。残りは NULL のまま一覧化

### TASK-3.3: 駅の突合
- **依存**: TASK-3.2
- **内容**: 路線確定後、正規化した駅名の完全一致で `station_cd` を引く。
  **`stations.id` は変更しない**（`platforms` 14件・`lineDirections` 52件の参照維持）
- **期待結果**: 未解決由来146件のうち131件が自動解決。
  残り15件（新幹線11 + 手動4）は NULL のまま一覧に出る
- **完了条件**: ドライランで突合結果を確認してから適用する
- **注意（2026-08-31 実測）**: **`development` は `main` の正確なコピーではない。**
  ドライランの結果をそのまま本番の期待値として扱わないこと

  | | main | development |
  |---|---|---|
  | `stations` / `lines` / `operators` / `stationConnections` | 481 / 62 / 17 / 546 | 同じ |
  | `platforms` | 14 | 18 |
  | `lineDirections` | 52 | 34 |
  | `trains` | 10 | 13 |
  | `stationFacilities` | 0 | 14 |

  本タスクの「`platforms` 14件・`lineDirections` 52件の参照維持」は **main の数字**である。
  参照を切らないという要件自体は両ブランチで同じだが、件数での検証は
  各ブランチの実数に対して行うこと

### TASK-3.4: 会員版CSVでの新幹線11駅の確認
- **依存**: TASK-3.3
- **内容**: 会員版 `station` CSV に新幹線の駅が含まれるか確認し、
  含まれれば11駅を解決する
- **期待結果**: 含まれない場合、NULL のまま残し requirements.md の C-1 を確定させる

### TASK-3.5: `stationConnections` の全置換
- **依存**: TASK-3.3
- **内容**: 既存546行を削除し、TASK-2.8 の生成結果に置き換える
- **前提の再確認**: 適用直前に「難易度入力済みの行が0件であること」を
  スクリプト内で検証する。0件でなければ停止する

> **TASK-3.6（`stationLines` の 1:1 制約を付与）は削除した。** 実測0件は
> ekidata が路線ごとに駅を割った結果であり、ドメインの不変条件ではないため。
> 制約を前提としたコードが書かれると粒度の変更コストが跳ね上がる。
> 番号は欠番のまま残す（[design.md](./design.md)「`stationLines` に
> `unique(stationId)` を付けない理由」）。

### TASK-3.7: 既存481行の `publishedAt` バックフィル
- **依存**: TASK-1.3b, TASK-3.3
- **内容**: 突合の成否に関わらず既存481行のうち `publishedAt` が
  未設定のものへ移行実行時刻を設定する。既に値がある行は上書きしない
- **理由**: 新規行の既定は NULL（非公開）であるため、
  **これを行わないと移行実行時に本番サイトが空になる**
- **注意**: 現行で `displayPriority` が NULL（非表示）の事業者に属する駅は
  **公開してはならない**。移行前の可視性をそのまま引き継ぐこと。
  ゆりかもめ等が該当する（requirements.md US-7 の実バグ対象）
- **期待結果**: 移行前に表示されていた駅がすべて公開、
  非表示だった事業者の駅は `publishedAt` が NULL のまま

### TASK-3.8: `operators.displayPriority` を表示順専用に純化
- **依存**: TASK-3.7（**順序を逆にしない**）
- **内容**: `NOT NULL DEFAULT 0` へ変更。既存の NULL 行を 0 で埋める
- **理由**: 可視性の意味を外す。TASK-3.7 が NULL を読み終えた後でなければ、
  移行前に非表示だった事業者を判別できなくなる
- **期待結果**: 可視性を担う述語が `stations.publishedAt` の1つだけになる

---

## Phase 4: ODPT 後始末

### TASK-4.1: 一意制約の張り替え
- **依存**: Phase 3 完了
- **内容**: `uniqueStationPerOperator` / `uniqueRailwayPerOperator` を削除。
  `ekidataStationCd` / `ekidataLineCd` / `ekidataCompanyCd` の unique は Phase 1 で付与済み
- **注意**: `ekidata*Cd` は **nullable のまま**とする（未突合行が残るため。
  requirements.md C-3）

### TASK-4.2: `stationConnections` の ODPT 列を削除
- **依存**: TASK-4.1
- **内容**: `odptStationId` / `odptRailwayId` / `connectedRailwayId` を削除し、
  `connectedStationId` を notNull 化

### TASK-4.3: `odptMetadata` テーブルを削除
- **依存**: TASK-4.2

### TASK-4.4: ODPT 同期機構の削除
- **依存**: TASK-4.3
- **内容**: `apps/scripts/src/update-odpt.ts`（396行）、
  ルート `package.json` の `update-odpt` スクリプト、
  `.github/workflows/update-odpt.yml` を削除
- **注意**: `odptStationId` / `odptRailwayId` / `odptOperatorId` の**列は残す**
  （ADR-0007 決定3）。消すのは同期機構だけである

---

## Phase 5: 公開ガードと Admin UI

### TASK-5.0: 可視性述語の一元化（**現行バグの修正**）
- **依存**: TASK-3.8
- **対象**: `apps/web`
- **成果物**: `apps/web/src/features/station/domain/visibility.ts`
- **内容**: design.md「現行の可視性ガードは一覧にしか無い」の表に従い、
  8つの読み取り経路すべてを単一の述語 `isNotNull(stations.publishedAt)` に通す
  - 置き換え（2件）: `app/page.tsx:16` / `app/api/v1/stations/route.ts:39` の
    `isNotNull(operators.displayPriority)`
  - 新規に追加（6件）: `app/stations/[slug]/page.tsx`（`stationDetailQuery.getBySlug`）/
    `app/lines/[slug]/stations/page.tsx` / `app/lines/[slug]/page.tsx` /
    `app/api/v1/lines/[slug]/stations/route.ts` / `app/api/v1/stations/[id]/route.ts` /
    `app/api/v1/operators/route.ts`
  - `stationDetailQuery` の `getStationConnectionRows` にも適用する
    （未公開駅への乗換リンクからの到達を塞ぐ）
  - 路線・事業者は `EXISTS`（公開駅を1件も持たなければ 404 / 応答から除外）
- **注意**: **`/api/v1/operators` を落とさない。** `.select().from(operators)` が
  無条件であり、URL推測すら不要で非表示事業者の一覧が取れる。
  実証済みの2URLより到達が容易な、最も重い漏れである
- **テスト**: 未公開駅の詳細・路線ページ・各APIが 404 / 空応答になること。
  実証済みの `yurikamome-yurikamome-shiodome` および
  `yurikamome-yurikamome`（路線）を回帰ケースに含める
- **あわせて塞ぐ**: `apps/web/src/components/LineAccordion.tsx:11` は
  `/lines/${line.slug}/stations` へフォールバック無しでリンクしており、
  `lines.slug` が NULL だと `/lines/null/stations` を生成する。
  ekidata 由来の602路線は slug が NULL で入るため、駅より先にここを踏む。
  **路線の可視性述語に `isNotNull(lines.slug)` を含めて塞ぐ**
  （design.md 参照。不変条件を立てて守るのではなく、不要にする）。
  `LineAccordion` 側にガードは足さない
- **実装形**: 可視性を `where` 句に置く。**JSでの絞り込みにしない。**
  現行 `app/page.tsx:20` が全路線を引いてJSで組んでいる形が
  詳細ページで判定が抜けた原因であるため、同じ形を残さない
- **パフォーマンス**: この規模（路線602 / 駅10,465）では
  専用インデックスを先に置かない。design.md「規模とパフォーマンス」を参照
- **テスト**: 未公開駅の詳細・路線ページ・各APIが 404 / 空応答になること。
  実証済みの `yurikamome-yurikamome-shiodome` と
  `yurikamome-yurikamome`（路線）を回帰ケースに含める。
  slug が NULL の路線が一覧に出ないこと
- **期待結果**: REQ-7.1〜7.5 を満たす。`/lines/null/stations` が生成されない

### TASK-5.1: `slug ?? id` フォールバックの整理
- **依存**: TASK-5.0
- **対象**: `apps/web/src/components/StationCard.tsx:15`、
  `apps/web/src/components/StationSearch.tsx:112`
- **内容**: CHECK 制約により公開駅は必ず slug を持つため、
  `station.slug ?? station.id` はデッドコードになる。型と併せて整理する
- **理由**: REQ-6.2 の削除に伴う後始末

### TASK-5.1b: カナ→修正ヘボン式の変換器
- **依存**: なし（Phase 1〜4 と並行可）
- **成果物**: `apps/admin/src/features/station-publishing/domain/romaji.ts`
- **内容**: design.md「ローマ字変換規則」の表に従う。
  決定的規則（`ヂ`/`ヅ`、促音、拗音・外来音、`ー` 削除、`ジェイアール`→`jr`）と、
  方針（長音は縮約する / 撥音は `m` 化**しない** / アポストロフィを入れない）
- **注意**: **変換元は `station_name_k`。`station_name_r` を修理する実装にしない**
- **テスト**: 上記各規則の単体ケースに加え、
  **CSV の手入力ヘボン式186件を回帰用の固定データとして持つ**。
  design.md が「原理的に決まらない」と記した形態素境界の4件
  （武雄温泉 / 嬉野温泉 / えちご押上ひすい海岸 / てだこ浦西）は
  **既知の不一致として明示的に許容する**（期待値に誤変換side を書く）

### TASK-5.2: Admin の公開操作UI（slug の確定を含む）
- **依存**: TASK-5.1b, TASK-5.0
- **対象**: `apps/admin/src/features/station-publishing/`
- **内容**: 駅の公開・非公開を切り替えるUI。TASK-5.1b の `romaji.ts` は
  この feature の `domain/` に属する（master-import からは呼ばれない）。公開時に以下を行う
  - `lines.slug` + `hepburn(normalize(nameKana))` から slug の**候補を提示**し、
    管理者が確認・編集して確定する（**インポートでは slug を書かない**）
  - `lines.slug` が未設定の場合は、先に路線の slug を求める
  - 確認材料の表示: 設備の入力件数、`nameEn` 未設定の警告、
    カナ欠陥9駅（design.md 参照）に該当する場合の注意
  - **データ健全性の警告**: 「公開駅を持つのに `slug` が無い路線」を一覧表示する。
    正しさは TASK-5.0 の述語が担保するため、これは
    `lines.slug` の付け忘れを検知するための表示である
- **注意**: `nameEn` は**公開の必須条件にしない**（警告に留める）。
  必須にすると機械ローマ字を貼る圧力が生じ、公式表記のみを入れる方針が崩れる
- **期待結果**: 誤変換の約3%が公開時に人の目を通る

### TASK-5.3: `unresolved-connections` を ekidata 未突合解決UIへ転生
- **依存**: Phase 4
- **対象**: `apps/admin/src/app/unresolved-connections/`（556行）と
  `app/api/unresolved-connections/*`
- **内容**: 検索キーを ODPT ID から ekidata コードへ差し替える。
  `ekidata*Cd` が NULL の行を一覧し、手動で `station_cd` を割り当てられるようにする
- **期待結果**: Phase 3 で残った15件が画面から解決できる
- **注意**: [ADR-0001](../adr/0001-layer-structure.md) の4層に沿って
  `features/` へ移す（現在は `app/` に556行が直書きされている）

---

## Phase 6: 検証・振り返り

### TASK-6.1: 受け入れ基準の検証
- **内容**: requirements.md の REQ-1.1〜REQ-8.3 を1件ずつ確認する
- **成果物**: 検証マトリックス

### TASK-6.2: `docs/domain/` への反映（**省略しない**）
- **内容**: design.md「恒久知識の振り分け」の表に従って以下を作成・更新する
  - `docs/domain/station-master-model.md`（新規）:
    ekidata のコード体系と粒度、`station_cd` 上位桁の例外、ダングリング13件、
    **現在の粒度が暫定であること**と `unique(stationId)` を付けない理由、
    乗換接続の由来区分、駅名正規化ルール、
    ekidata 規約に由来する制約、**`slug` の導出規則**、
    **`nameEn` は公式表記のみで機械生成しないこと**、
    **可視性は `stations.publishedAt` が単独で担い、判定は単一の述語を通すこと**
  - `docs/domain/README.md` の一覧に2件を追加
- **確認**: 既存の `platform-coordinate-system.md` / `train-stop-patterns.md` に
  変更が要るかを確認し、**不要ならその旨を記録する**

### TASK-6.3: ADR-0007 を `Accepted` に更新
- **依存**: TASK-6.1
- **注意**: ステータス変更は**開発者の承認を得てから**行う（[ADR運用ルール](../../.claude/rules/adr.md)）

### TASK-6.4: 後続Issue の起票
- **必ず含めるもの**: **駅・路線の粒度の確定**。
  本Issueでは暫定とし不変条件を課さなかったため、実データ投入後に判断する。
  調査資料は Obsidian `Projects/furatora/駅・路線の粒度 — 設計のための調査メモ`。
  期限の目安は「ホーム設備の入力が共用ホーム駅（目黒等）に到達したとき」
- **内容**: 以下を GitHub Issue として起票する
  - 運行系統のデータ投入と Admin 管理UI（ODPT路線46件が種として使える）
  - 列単位の上書きロック（`lockedFields`）
  - `ekidataStationCd` の notNull 化（未突合ゼロ達成後）
  - `facilityConnections` の粒度見直し
  - `operators.displayPriority` の全国運用ルール

### TASK-6.5: ワークスペースの最終化
- **内容**: 一時ファイル・作業用スクリプトを削除する
