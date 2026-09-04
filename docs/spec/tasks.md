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
Phase 2: インポート機構                           (完了)
Phase 3: 突合と publishedAt バックフィル           (完了・Phase 2 に依存)
Phase 4: ODPT 後始末                             (Phase 3 完了後)
Phase 5: 公開ガードと Admin UI                     (P0・現行バグの修正を含む)
Phase 5b: displayPriority の NOT NULL 化           (TASK-5.0 のデプロイ後・単独PR)
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

### `displayPriority` の `NOT NULL` 化は Phase 5 の後に置く（初版から変更）

初版は TASK-3.7（`publishedAt` バックフィル）→ TASK-3.8（`displayPriority` の
`NOT NULL` 化）を Phase 3 内に並べ、TASK-5.0 が TASK-3.8 に依存するとしていた。
**依存が逆であり、この順序では稼働中のサイトが壊れる。**

`apps/web` の2箇所は `isNotNull(operators.displayPriority)` で可視性を判定している。
`NOT NULL DEFAULT 0` にすると**この述語が常に真になり、ゆりかもめ等の
非公開事業者の駅が全公開される**。ルート `CLAUDE.md` の禁止事項
「その列を読むコードが稼働したままの `NOT NULL` 化」に該当する。

正しい順序は3つのデプロイに分かれる。

| デプロイ | 内容 | その時点の `apps/web` |
|---|---|---|
| 1（Phase 3） | `0005` バックフィル + 突合UI | `displayPriority` で判定。**挙動は変わらない** |
| 2（Phase 5） | TASK-5.0: 可視性を `publishedAt` の単一述語へ | `displayPriority` を読むコードが消える |
| 3（Phase 5b） | `0006`: `NOT NULL DEFAULT 0` | 読み手がいないので安全 |

バックフィルが「移行前に非表示だった事業者」を `displayPriority IS NULL` で
判別する点は初版のまま変わらない。**先に埋めてはならない**という制約は、
デプロイ1 と デプロイ3 の間隔として表現される。

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
  バックフィル（`0005` / TASK-3.0）が「移行前に非表示だった事業者」を判別するために
  NULL を必要とする。純化は TASK-5b.1 で行う
- **注意**: この時点では**制約の削除を行わない**。既存データが移行前のため
- **期待結果**: 列が追加され、既存の読み書きが壊れない

### TASK-1.3b: `published_requires_slug` の CHECK 制約を付与
- **状態**: ✅ 完了 (2026-08-30)
- **依存**: TASK-1.3
- **内容**: `check('published_requires_slug', sql\`published_at IS NULL OR slug IS NOT NULL\`)`
- **事前確認**: **既存481行の `slug` に NULL が無いことを SQL で確認する。**
  design.md は「`update-odpt.ts` が全件生成済み」を前提にしているが、
  バックフィル（`0005` / TASK-3.0）が失敗しないことを保証するため実測する
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

> **この表の行数は無料版CSV由来である**（Phase 2 で会員版を実測して判明。2026-09-03）。
> 会員版では 駅10,625 / グループ8,782 / 隣接10,040 / 乗換接続6,946 となり、
> 合計は約47,800行になる。計測に使った46,538行との差は2.7%であり、
> 「制限値の1/37」という判定は変わらない。**この表と下の計測結果表は
> 実際に測った条件の記録であるため書き換えない。**

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

## Phase 2: インポート機構（完了 2026-09-03）

**結果**: 4種のCSVを受け取り、差分を提示し、承認後に単一トランザクションで適用する
機構を実装した。実CSV（会員版・2026-08 配布分）と開発DBに対して `plan` を実行し、
件数と適用不能の検出まで確認済み。**`apply` の実DB実行は Phase 3 の突合後**である
（下記 TASK-2.3 の「適用不能」を参照）。

### 会員版CSVの実測で判明したこと

初版の行数は**無料版CSV由来**であり、会員版とは一致しなかった。

| | 初版（無料版） | 会員版 実測 |
|---|---|---|
| 事業者（現役） | 175 | **162**（175は廃止13件を含む全行数） |
| 路線（現役） | 602 | 602 |
| 駅（現役） | 10,465 | **10,625** |
| 乗換単位の駅 | 8,766 | **8,782** |
| 隣接（投入可能） | 10,189 | **10,040**（149行はFKを張れず除外） |
| 乗換接続（順序対） | 5,876 | **6,946** |
| ダングリング `station_g_cd` | 13 | **59** |

差は新幹線160駅の有無である。あわせて以下が確定した。

- **会員版に新幹線の駅は含まれる。** requirements.md の C-1 と TASK-3.4 は解消
- **`e_status` は3値**（0=現役 / 1=未開業 / 2=廃止）。初版は 0 と 2 しか想定していなかった
- **CSVに引用符は1件も無い。** 全行の列数がヘッダと一致し、住所列（`address`）にも
  カンマが無い。パーサは引用符を扱わないが、**列数不一致を例外にする**ことで
  将来の形式変更が黙って通らないようにした

### TASK-2.1: CSV パーサと型定義
- **状態**: ✅ 完了 (2026-09-03)
- **成果物**: `apps/admin/src/external/ekidata/csv.ts`（汎用の分解と列検証）、
  同 `ekidataCsvParser.ts`（`EkidataCsvSource` の実装）、
  `features/master-import/domain/importedRecords.ts`（型）、
  同 `domain/values.ts`（小数6桁・色・`0000-00-00` の正規化）
- **実装した判断**:
  - `station_cd` の上位桁から `line_cd` を導出しない（137件の例外）
  - `0000-00-00` は date 列に入らないため null にする
  - `line_color_c` に `#` を付けて大文字化する
  - 警告は1件ずつ返さず、**コードごとに件数と最大5件の手がかりへ畳み込む**
    （隣接の欠落だけで149件あり、全件を並べても読めない）
  - 4ファイルすべてを検査してから返す（1つ目で打ち切ると管理者が4回やり直すことになる）

### TASK-2.2: 駅名正規化
- **状態**: ✅ 完了 (2026-09-03)
- **成果物**: `features/master-import/domain/normalize.ts`
- **実データでの確認**: 括弧が現れるのは `〈〉` 5件と `（）` 32件のみ。
  正規化で変化する駅名は127件で、**同一路線内での衝突は0件**
- **追加した規則**: 除去した結果が空になる場合は原文を返す。
  キーが空文字になると無関係な駅どうしが一致してしまうため

### TASK-2.3: 差分計画の算出
- **状態**: ✅ 完了 (2026-09-03)
- **成果物**: `features/master-import/domain/plan.ts`
- **設計から変わった点**:
  - 差分を「新規／更新」に分けて UPDATE 文を投げる形を**採らなかった**。
    Phase 3 の突合直後のように既存481行がまとめて変わる場面で481往復になり、
    8秒で済む適用が1分を超える。**変更のある行を upsert し直す**形にした
  - `lat` / `lon` は取り込み側・DB側の**双方を小数6桁へ揃えてから**比較する。
    CSV は `139.74044`、DB から読み戻すと `139.740440` になり、
    揃えないと値が同じでも毎回「更新あり」になって冪等性が成立しない
  - 路線色は `#` の有無と大文字小文字を吸収して比較する
  - 廃止済みの行が現役として再登場したら `abolishedAt` を NULL に戻す
- **新設した概念「適用不能（blockers）」**:
  現行DBの17事業者の `name` は ekidata の `company_name` と**全件完全一致する**。
  Phase 3 の突合前にインポートを流すと17件が別行として INSERT され、
  `operators_name_unique` の 23505 でトランザクション全体が落ちる。
  これを実行時の500にせず、**`plan` の時点で提示して `apply` を拒否する**。
  → **実運用の順序は「Phase 3 の突合 → インポート」で確定**

### TASK-2.4: ports とリポジトリ
- **状態**: ✅ 完了 (2026-09-03)
- **成果物**: `features/master-import/ports.ts`、
  `external/repository/masterImportRepository.ts`、`di.ts` への配線
- **実装**: 単一 `withTransaction` / `BATCH_SIZE = 1000`。
  FK 依存順に `operators` → `lines` → `stationGroups` → `stations` →
  `stationLines` / `stationAdjacencies` → `stationConnections`
- **空値保護は SET 句が担う**: `COALESCE(NULLIF(EXCLUDED.name_kana, ''), lines.name_kana)`。
  生成SQLを `.toSQL()` で確認済み
- **UUID の解決**: 既存行の id はスナップショットから、新規行の id は
  upsert の `returning` から集める。往復を増やさない
- **スナップショットはトランザクションの内側で取り直す**。
  パースは外（実測40ms / 1.7MB）

### TASK-2.5: usecases
- **状態**: ✅ 完了 (2026-09-03)
- **成果物**: `usecases/planImport.ts`, `usecases/applyImport.ts`
- **planToken はステートレス**: 4ファイルの SHA-256。サーバは計画を保持しない
  （理由は design.md「計画はサーバに保持しない」）

### TASK-2.6: Route Handler
- **状態**: ✅ 完了 (2026-09-03)
- **成果物**: `apps/admin/src/app/api/master-import/route.ts`
- **完了条件**: ✅ 1.7MB の `station` CSV が欠けずに通ることをテストで確認
  （`route.test.ts`。4ファイル合計 約2.05MB は Vercel の 4.5MB/request 以内）
- **応答**: 400（列欠落・ファイル欠落・mode不正）/ 409（planToken 不一致）/
  422（適用不能）/ 500。未認証は `middleware.ts` が 401 にする
- **`maxDuration = 60`**: 適用は実測7.3〜8.0秒かかり、既定の上限では足りない
- **ADR-0001 のルール発火を確認済み**: `route.ts` に
  `@furatora/database/client` の import を一時的に置き、ESLint がエラーにすることを確認した

### TASK-2.7: アップロードUI
- **状態**: ✅ 完了 (2026-09-03)
- **成果物**: `features/master-import/components/MasterImportForm.tsx`,
  `app/master-import/page.tsx`、`components/Sidebar.tsx` への導線
- **CSVを選び直したら提示済みの差分を破棄する**（別の入力に対する差分になるため）

### TASK-2.8: 乗換接続の生成
- **状態**: ✅ 完了 (2026-09-03)
- **実装**: JS で6,946行を組み立てず、`stations` の自己結合による
  **`INSERT ... SELECT` 1文**で生成する。`ON CONFLICT DO NOTHING` が
  `source = 'manual'` の行と難易度入力済みの行を守る
- **注意**: 実際の挿入数は適用してからでないと確定しない。
  差分計画に出す 6,946 は CSV から見た**上限**である

### 設計から変えた点（まとめ）

| 論点 | 変更 |
|---|---|
| `stationAdjacencies` の向き | **無向辺 = 1行**。schema.ts の「両方向の2行で持つ」というコメントを実装に合わせて訂正した。plan.ts と masterImportRepository.ts が端点 UUID を昇順へ正規化し、供給元が辺を逆向きに配布し直しても `unique_station_adjacency` で弾く（2026-08 実測では逆向きの重複0件だが、それに依存しない） |
| `stationLines.stationOrder` | **書かない（NULL のまま）。** ekidata に路線内順序を示す列が無く（`e_sort` は `station_cd` と同値）、ODPT 由来の既存値も壊さない。順序が要れば `stationAdjacencies` から導出する（後続Issue） |
| 更新の表現 | 行ごとの UPDATE ではなく upsert（TASK-2.3 参照） |
| CSVパーサ | 外部ライブラリを入れず自前。引用符が不要であることを実測で確認済み |
| 未開業（`e_status = 1`） | 取り込まず、廃止扱いにもしない |
| 廃止と見なす範囲 | **CSV に `e_status = 2` として載っていた行**と、**CSV のどのファイルにも現れなかった行**の2つだけ。CSV には載っているが取り込まなかった行（未開業・現役でない事業者/路線に紐づく）は廃止しない。パーサが `seen`（CSV に現れた `line_cd` / `station_cd` の全体）を返し、`markAbolished` が「消えた」と「取り込まなかった」を区別する。古い `company.csv` などで公開中の路線・駅が廃止されるのを防ぐ |

### 残作業

- **`apply` の実DB実行**は Phase 3 の突合後に行う。
  それより前は事業者名の重複17件が適用不能として提示され、正しく拒否される
- 疎通だけを先に見る場合は、Neon の使い捨てブランチに対して実行すること
  （`neonctl branches create` → `DATABASE_URL` を差し替えて `pnpm --filter @furatora/admin dev`）

---

## Phase 3: 突合と `publishedAt` バックフィル（完了 2026-09-04）

> **実行順序は「突合 → インポート」である。** Phase 2 の実装で判明した通り、
> 現行DBの17事業者の `name` は ekidata の `company_name` と全件一致する。
> 突合前にインポートを流すと `operators_name_unique` に衝突し、
> 差分計画が適用不能として拒否する（Phase 2「TASK-2.3」参照）。

### 初版から変えた2点

| # | 初版 | 変更 | 理由 |
|---|---|---|---|
| 1 | `apps/scripts/src/migrate-to-ekidata.ts` | **Admin の画面操作**（`/master-migration`） | `apps/scripts` の依存は `@furatora/database` だけであり、`@/` エイリアスを使う `ekidataCsvParser.ts` を持ち込めない。また ADR-0008 は「各環境のアプリが自分の Neon ブランチに書く」形であり、本番の接続文字列をローカルに置く経路を新設せずに済む |
| 2 | TASK-3.7 をスクリプト内で実行 | **手書きSQLマイグレーション `0005`** | Vercel のビルドが development / preview / production のすべてに自動適用する。とくに Phase 5 の Preview で「公開駅0件の空サイト」を検証してしまう事故を防ぐ |

TASK-3.8 の移動については[実行順序の根拠](#displaypriority-の-not-null-化は-phase-5-の-後に置く初版から変更)を参照。

### TASK-3.0: `publishedAt` バックフィル（旧 TASK-3.7）
- **状態**: ✅ 完了 (2026-09-04)
- **成果物**: `packages/database/drizzle/0005_backfill_published_at.sql`
  （`drizzle-kit generate --custom` で作成）
- **内容**: `display_priority IS NOT NULL` の事業者に属し、`published_at` が
  未設定の駅へ `now()` を入れる。既に値がある行は上書きしない
- **理由**: 新規行の既定は NULL（非公開）であるため、
  **これを行わないと移行後に本番サイトが空になる**
- **`display_priority IS NOT NULL` の条件を落とさないこと**。移行前に非表示だった
  事業者の駅まで公開すると、requirements.md US-7 の実バグを仕様として恒久化する
- **件数は環境ごとに違ってよい**（2026-09-04 実測）。この文は各環境の
  「移行前の可視性」を写すためであり、一致しないことが正しい

  | | main | development |
  |---|---|---|
  | `display_priority` が NULL の事業者 | 15 / 17 | 14 / 17（JR東日本に 3 が入っている） |
  | 公開になる駅 | **335** | **438** |
  | NULL のまま残る駅 | 146 | 43 |

- **前提の確認**: `stations.slug` の NULL は 0件 / 481行のため、
  `published_requires_slug` の CHECK に触れない（TASK-1.3b で実測済み）

### TASK-3.1〜3.5: 突合（Admin の `/master-migration`）
- **状態**: ✅ 完了 (2026-09-04)
- **依存**: Phase 2
- **成果物**:
  - `apps/admin/src/features/master-migration/`
    （`domain/{migrationPlan,manualMappings,match}.ts` / `ports.ts` /
    `usecases/{planMigration,applyMigration}.ts` / `components/MasterMigrationForm.tsx`）
  - `apps/admin/src/external/repository/masterMigrationRepository.ts`
  - `apps/admin/src/app/{master-migration/page.tsx,api/master-migration/route.ts}`
  - `di.ts` への配線、`Sidebar.tsx` への導線
- **再利用したもの（新規に書いていない）**: `ekidataCsvSource`（`parse` / `digest`）、
  `normalizeStationName`、`ImportedLine` / `ImportedStation`、`withTransaction`。
  **feature 間の依存 `master-migration → master-import` が新しく生じる。**
  一方向で循環しない（ADR-0001）
- **突合の順序**: 事業者 → 路線 → 駅。手動対応表を**自動突合より先に**引く
  （人が CSV を読んで確認した結果の方が、名前一致より確かな根拠であるため）
  - **事業者（TASK-3.1）**: `odptOperatorId` → `company_cd` の対応表17件。
    実DBの値は `odpt.Operator:TokyoMetro` 形式（2026-09-04 実測）。
    照合は `:` の後ろで行い、接頭辞の有無どちらでも引ける
  - **路線（TASK-3.2）**: 手動表 → 正規化名の完全一致 → 全駅包含判定
  - **駅（TASK-3.3 / 3.4）**: 手動表 → 確定した路線の中で正規化名の完全一致
- **`stations.id` / `lines.id` は変更しない**（`platforms` / `lineDirections`
  からの参照維持。REQ-3.4）。UPDATE でコード列だけを埋める
- **未突合行は削除しない**（REQ-3.2）。コードを NULL のまま残し、画面に一覧表示する。
  **未突合一覧には「名前が近い ekidata の候補」を添える。**
  手動対応表の値は docs に記録が無く CSV から人が特定するしかないため、
  その作業を CSV の grep 無しで終わらせるための補助である
- **適用不能（blockers）— `apply` を拒否する条件**:

  | code | 内容 |
  |---|---|
  | `duplicate_ekidata_code` | 複数の既存行が同じコードに突合した。`ekidata*Cd` は unique であり 23505 で落ちる。ODPT の路線は運行系統粒度であり、実際に起こりうる |
  | `code_taken_by_other_row` | 割り当て先のコードを既に別の行が持っている（再実行時） |
  | `connection_has_input` | 難易度・メモが入力済みの乗換接続がある。TASK-3.5 の前提が崩れている |

- **TASK-3.5（`stationConnections` の全置換）**: 削除は**由来で絞る**。
  `source IS NULL` かつ難易度・メモがすべて NULL の行だけを消す。
  `'manual'` と `'ekidata_group'` には触れない。
  実測0件に依存せず、**守るべき行に構造的に触れない**形にした。
  埋め直すのはインポート側の `INSERT ... SELECT`（TASK-2.8）である。
  **削除から取り込みまでの間、公開サイトの乗換接続は空になる。** 続けて実行すること
- **テスト**: `domain/match.test.ts`（19件）/ `usecases/*.test.ts`（7件）/
  `route.test.ts`（9件）。突合・冪等性・適用不能の検出を DB 無しで固定した

### TASK-3.6: 欠番

> **TASK-3.6（`stationLines` の 1:1 制約を付与）は削除した。** 実測0件は
> ekidata が路線ごとに駅を割った結果であり、ドメインの不変条件ではないため。
> 制約を前提としたコードが書かれると粒度の変更コストが跳ね上がる。
> 番号は欠番のまま残す（[design.md](./design.md)「`stationLines` に
> `unique(stationId)` を付けない理由」）。

### 手動対応表の確定（完了 2026-09-04）

会員版CSV（`line20260618` / `station20260731`）と本番相当のDBに対して突合を実行し、
未突合・適用不能として出た行を CSV で確認して `manualMappings.ts` を埋めた。

**突合の実測（適用不能 0 件）**

| | 全行 | 突合 | 未突合 | 内訳（手動/名前/全駅包含） |
|---|---|---|---|---|
| 事業者 | 17 | 17 | 0 | 17 / 0 / 0 |
| 路線 | 62 | **59** | 3 | 9 / 25 / 25 |
| 駅 | 481 | **477** | 4 | 7 / 470 / 0 |

design.md の「46件中42件が自動決定」は未解決由来46路線に対する実測であり、
**62件全体では自動50・手動9**である。初版 tasks.md の「自動42 + 手動4」は
この数字に置き換わる。

#### 自動突合が決められなかった理由は2種類だった

1. **包含判定が複数に一致する（7件）**。ODPT の路線は運行系統粒度で区間が短く、
   駅数が少ないほど「その駅を全部持つ ekidata 路線」が増える。
   `高崎線` の {上野, 東京} は**新幹線5路線すべて**に含まれる。
   `東海道線` / `横須賀線` の {東京, 新橋} は山手線・京浜東北線にも含まれる
2. **包含判定が成立しない（2件）**。`常磐線快速` は上野東京ライン経由の
   東京・新橋を含むが ekidata の常磐線にその2駅は無い。
   `有楽町線` は現行DBの `麴町`（U+9EB4）と ekidata の `麹町`（U+9EB9）が
   異体字で一致せず1駅欠ける

いずれも**候補を提示して人に渡す**という設計どおりに振る舞った。
機械的に1件へ倒していたら、根拠の無い対応が黙って入っていた。

#### 対応表に `null`（対応行が無い）を表現できるようにした

3つの路線は **ekidata に対応する行が存在しない**。値を書けないだけでなく、
自動突合を**止めなければならない**（放置すると親路線に吸われて
`duplicate_ekidata_code` になる）。そのため対応表の値を `number | null` にし、
`null` を「人が確認した結果、対応行が無い」の記録とした。

| 現行DBの路線 | 理由 |
|---|---|
| `丸ノ内線支線` | ekidata の東京メトロは9路線で、方南町の分岐線は `28002` に畳まれている |
| `東武スカイツリーライン(支線)` | ekidata の東武は `21002` 東武伊勢崎線1本で、押上支線はそこに畳まれている |
| `常磐線各駅停車` | `11320` は快速線と緩行線の両方の駅を1本に持つ。快速が4駅一致するのに対し各駅停車は綾瀬1駅のみのため、`11320` は快速が取る |

所属駅は親路線の駅として ekidata に存在するため、駅側の対応表で個別に埋めた
（`中野新橋` `中野富士見町` `方南町` `押上` `綾瀬`）。

#### 対応づけられない4駅（粒度の不一致）

| 現行DBの駅 | 理由 |
|---|---|
| `丸ノ内線支線` の `中野坂上` | 現行DBは路線×駅粒度で同じ駅を2行持つが、ekidata は `2800220` 1行しか持たない。`丸ノ内線` 側が取る |
| `常磐線快速` の `東京` / `新橋`、`高崎線` の `東京` | これらに当たるのは `11343`「上野東京ライン」の1行だけであり、`東京` を必要とする行が2つある。`ekidataStationCd` は一意で、片方に割り当てる根拠が無い |

**これは突合の失敗ではなく、粒度が一致しないことの現れである。**
現行の路線×駅粒度は暫定であり（design.md「粒度は暫定である」）、
確定は実データ投入後の後続Issue（TASK-6.4）で行う。
それまで4駅は `ekidataStationCd` が NULL のまま Admin の
未突合解決UI（TASK-5.3）に出続ける。行は削除しない（REQ-3.2）。

### リハーサル手順（本番適用の前に必ず行う）

`development` は `main` の正確なコピーではない（下表）。
**試算の結果をそのまま本番の期待値として扱わないこと。**

| | main | development |
|---|---|---|
| `stations` / `lines` / `operators` / `stationConnections` | 481 / 62 / 17 / 546 | 同じ |
| `platforms` | 14 | 18 |
| `lineDirections` | 52 | 34 |
| `trains` | 10 | 13 |
| `stationFacilities` | 0 | 14 |
| `display_priority` が NULL の事業者 | 15 | 14 |

`main` から使い捨ての Neon ブランチを切って通しで演習する。

```bash
neonctl branches create --project-id patient-meadow-13439419 --parent main --name rehearsal
MIGRATION_DATABASE_URL='<rehearsal>' pnpm -w run db:migrate
DATABASE_URL='<rehearsal>' pnpm --filter @furatora/admin dev
```

1. `0005` 適用後、公開駅が **335**・NULL が **146** であること
2. `/master-migration` で CSV 4件 → 試算。未突合一覧から手動対応表の値を特定する
3. 適用 → コードの埋まり方と `stationConnections` の削除件数を確認
4. `/master-import` に同じCSV → **blockers が0件**になっていること → 適用
5. `platforms` / `lineDirections` / `trains` / `stationFacilities` の件数が
   演習開始時と**変わっていない**こと（REQ-2.3 / REQ-3.4）
6. `/master-migration` をもう一度適用して**差分0**になること（冪等性）
7. ブランチを削除する

本番は `develop` → `main` のマージで `0005` が適用された後、
**本番の Admin にログインして** `/master-migration` → `/master-import` の順に実行する。

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
- **依存**: TASK-3.0（`0005` バックフィル）。
  **TASK-3.8 には依存しない**（初版は逆に書いていた。
  [実行順序の根拠](#displaypriority-の-not-null-化は-phase-5-の-後に置く初版から変更)）。
  バックフィル済みのDBでなければ、置き換えた瞬間に公開駅が0件になる
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
- **パフォーマンス**: この規模（路線602 / 駅10,625）では
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

## Phase 5b: `displayPriority` の `NOT NULL` 化（旧 TASK-3.8）

### TASK-5b.1: `operators.displayPriority` を表示順専用に純化
- **依存**: **TASK-5.0 が本番にデプロイされていること。** 同じPRに入れない
- **内容**: `NOT NULL DEFAULT 0` へ変更し、既存の NULL 行を 0 で埋める
- **理由**: 可視性の意味を外す。可視性を担う述語が
  `stations.publishedAt` の1つだけになる
- **同じPRに入れてはならない理由**: マイグレーションはビルド時に走るため、
  **新しいコードが公開される前にDBが変わる**（ADR-0008）。TASK-5.0 と同居させると、
  ビルドが終わるまでの間だけ「`displayPriority` で判定する古いコード」が
  「全行が 0 になったDB」を見ることになり、非表示事業者の駅が露出する
- **前提の確認**: 適用前に `apps/web` から `operators.displayPriority` を
  読む箇所が消えていることを grep で確かめる
- **期待結果**: 可視性を担う述語が `stations.publishedAt` の1つだけになる

---

## Phase 6: 検証・振り返り

### TASK-6.1: 受け入れ基準の検証
- **内容**: requirements.md の REQ-1.1〜REQ-8.3 を1件ずつ確認する
- **成果物**: 検証マトリックス

### TASK-6.2: `docs/domain/` への反映（**省略しない**）
- **内容**: design.md「恒久知識の振り分け」の表に従って以下を作成・更新する
  - `docs/domain/station-master-model.md`（新規）:
    ekidata のコード体系と粒度、`station_cd` 上位桁の例外、ダングリング59件、
    `e_status` が3値であること、`stationAdjacencies` を片方向1行で持つこと、
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
