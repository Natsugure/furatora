# 駅・路線マスタのモデル

> **適用状況**: 2026-09-08 現在、**実装済み・本番反映済み**。
> 駅・路線マスタの初回シードは 駅データ.jp（ekidata）会員版CSV であり、
> 本番（Neon `main`）へ投入済み（事業者162 / 路線602 / 駅10,625 / 乗換単位8,782 /
> 隣接10,040 / 乗換接続6,946）。`packages/database/src/schema.ts` と一致する。
> CSV の取込・突合を行った Admin の機構（`master-import` / `master-migration`）は
> **投入完了後に削除済み**（[ADR-0007](../adr/0007-station-master-data-source.md) 決定4 / Issue #56）。
> 以後の維持は Admin での手動編集が主経路。**駅・路線の新規作成、乗換接続・隣接の
> 作成と削除は Admin から行える**（[Issue #88](https://github.com/Natsugure/furatora/issues/88)。
> `POST /api/lines` / `POST /api/stations` / `POST /api/stations/[stationId]/connections` /
> `POST /api/lines/[lineId]/adjacencies` ほか）。乗換単位グループ（`stationGroups`）の
> 新規作成手段だけは未実装（`ekidataStationGroupCd` が NOT NULL + UNIQUE のため。別 Issue）。
> 経緯と却下案は [ADR-0007](../adr/0007-station-master-data-source.md)。

## データ源

- **駅・路線・事業者のマスタは ekidata 会員版CSV（`company` / `line` / `station` / `join`）を初回シードとして投入した。**
- **ekidata は初回シードである。継続同期はしない**（[ADR-0007](../adr/0007-station-master-data-source.md) 決定1・決定4）。
  投入後の維持は Admin での手動編集が主経路になる（新規作成手段の欠落は
  [Issue #88](https://github.com/Natsugure/furatora/issues/88)）。取込・突合の機構は
  投入完了後に削除済み（Issue #56）。定期再取込の機構
  （旧 `update-odpt.ts` に相当するもの）も設けない。理由は、運行系統粒度で
  付けた案内名（例: `常磐線快速`）や手入力した `slug` / `nameEn` を
  ekidata の表記（例: `JR常磐線(上野～取手)`）で毎回上書きしてしまうため。
- ODPT ID（`stations.odptStationId` / `lines.odptRailwayId` / `operators.odptOperatorId`）は
  **動的データ（列車位置等）への参照キーとして列を残す**（決定3）。同期はしない。
  ekidata 由来の新規行では NULL であり、突合の手がかりにも使わない。
  一意制約は付けない（値の重複を防ぐ主体がもう存在しないため、欠落ではなく意図的な不在）。

## コード体系（ekidata）

| 列 | 意味 | 粒度 |
|---|---|---|
| `company_cd` → `operators.ekidataCompanyCd` | 事業者 | 事業者 |
| `line_cd` → `lines.ekidataLineCd` | 路線 | 線路名称・案内名・運行系統・列車名・直通運転を**混在**させた単位（下記「路線概念の3分類」） |
| `station_cd` → `stations.ekidataStationCd` | 駅 | **路線×駅**。同じ物理駅が路線ごとに別の `station_cd` を持つ |
| `station_g_cd` → `stationGroups.ekidataStationGroupCd` | 乗換駅グループ | 物理駅（乗り換えでまとまる単位） |

### 例外・ダングリング

- **`station_cd` の上位桁は `line_cd` と一致しない**（137件の例外）。所属路線は
  `station_cd` の桁から導出せず、CSV の `line_cd` 列を使う。
- **`station_g_cd` に59件のダングリング参照**がある（9件はどの `station_cd` にも
  存在せず、50件は廃止駅を指す）。グループは破棄せず、所属する現役駅から代表値を決める。
- `join`（隣接）の一部は FK を張れない（`line_cd` が現役路線でない・端点が現役駅でない）。
  張れる行だけを取り込む。

### `e_status` は3値

`0 = 現役 / 1 = 未開業 / 2 = 廃止`。**取り込むのは 0 のみ。**
`1`（未開業）は取り込まず、廃止扱いにもしない。

### 日付・色の表記

- 未設定の日付は `0000-00-00`。date 列に入れられないため NULL にする。
- `line_color_c` は `#` の無い6桁16進。取り込み時に `#` を付けて大文字化する。

## 粒度は暫定である

現行の `stations` は**路線×駅粒度**（ekidata の `station_cd` と 1:1）。
これは**ドメインとして正しい粒度ではなく**、既存481行を UPDATE で移行して
`platforms` / `lineDirections` からの参照を切らないための選択である。

- 同一事業者・同一駅が複数行に割れる（東京駅=18行、新宿=13行）。
- ekidata 粒度は約19%重複し、事業者×物理駅はホーム共用駅（目黒等）で割れる。
- **確定は実データ投入後の後続Issue**（[Issue #82](https://github.com/Natsugure/furatora/issues/82)。
  「ホーム設備の入力が共用ホーム駅に到達したとき」が目安）。

### `stationLines` に `unique(stationId)` を付けない

実測で複数路線を持つ駅は0件だが、これは ekidata が路線ごとに駅を割った結果であって
**furatora の不変条件ではない**。制約を前提としたコード（「1駅は1路線」を仮定した
クエリ・表示ロジック）が書かれると、粒度の変更が制約の削除では済まなくなる。
`stationLines.stationOrder` も書かない（ekidata に路線内順序を示す列が無く、
`e_sort` は `station_cd` と同値。ODPT 由来の既存値は壊さない）。

**結果として `stationOrder` は路線単位でほぼ全か無かになる**（実測 2026-09-10:
10,294/10,625行がNULL。内訳は 全NULL 587路線 / 全設定 14路線 / 部分設定 1路線）。
路線内の駅順を必要とする読み取り側は、`stationOrder` を主キーにしつつ
`stations.ekidataStationCd`（路線内で連番になっている。例: 山手線は
`1130201 大崎 → 1130202 五反田 → …`）を次点キーにして補う。
Admin の駅一覧（Issue #94、`external/query/stationListPageQuery.ts`）がこの方式を採用している。

### `ekidataCompanyCd` / `ekidataLineCd` / `ekidataStationCd` は恒久的に nullable

初回シードで突合できた既存行と、シードで新規作成した行には値が入っているが、
**`NOT NULL` 化はしない。** 以後 Admin で手動追加される駅・路線・事業者は
ekidata のコードを持たず、`NOT NULL` は達成できないだけでなく**達成してはならない**
（継続同期をしない以上、コードを持たない行が正しい状態。ADR-0007 決定3）。
一意制約は付けたまま（重複した ekidata コードは誤り）。

同じ理由で、**列単位の上書きロック（`lockedFields`）も作らない。** これは定期取込から
手動編集を守るための機構であり、守るべき再取込がもう存在しない（ADR-0007 決定4）。

## 路線概念の3分類

ekidata `line_cd` は次を混在させている。設計は「案内路線（表示単位）」と
「運行系統（列車の走り方）」を**別概念**として扱う。

1. **案内路線** — 旅客に見せる表示単位
2. **運行系統** — 列車が実際にどう走るか（直通・区間運転）
3. **支線の吸収** — ekidata は分岐線を本線に畳む（例: 丸ノ内線支線 → `28002` 丸ノ内線）

`serviceRoutes` / `serviceRouteSegments` は**作っていない**。概念が未分化のまま
スキーマに固定すると、`docs/domain/` に検証されていないモデルが恒久化するため。
運行系統のデータ投入と管理UIは [Issue #83](https://github.com/Natsugure/furatora/issues/83)。
手動維持が主経路になったことで優先度が上がっている。

## 隣接（`stationAdjacencies`）

- **無向辺を1行で持つ。** 端点 UUID を `(stationAId, stationBId)` の昇順に正規化して
  格納し、逆向きの重複（`(a,b)` と `(b,a)`）を作らない。
- **読み取り側は両方向を見る必要がある**（片方向しか行が無いため）。
- 初回シードで投入した行はこの昇順正規化を満たしている。ただし
  **`unique_station_adjacency`（`lineId, stationAId, stationBId`）は逆向きペアを別行として
  通す**ため、DB 制約は逆向き重複を防げない。昇順正規化は**書き込み側が守る規約**である。
  現在の実装は `apps/admin/src/features/station-adjacency/domain/normalize.ts` の
  純粋関数 `normalizeAdjacencyEndpoints()` が担い、
  `external/repository/stationAdjacencyRepository.ts` が INSERT 前に必ずこれを通す。
  作成・削除は `/lines/[lineId]/adjacencies` 画面と
  `POST/DELETE /api/lines/[lineId]/adjacencies` から行う
  （[Issue #88](https://github.com/Natsugure/furatora/issues/88)）。
  Repository は端点が対象路線の `stationLines` に属することも検証する。

## 乗換接続（`stationConnections`）— 接続一覧

`stationConnections` は「どの駅からどの駅へ乗り換えられるか」を持つ**接続一覧**であり、
Web の駅詳細・Admin の駅編集・設備編集・レイアウト画面が読んでいる。
乗換難易度の新モデル（次節）が入っても、この表は接続一覧として残る。
乗換難易度を持つ `strollerDifficulty` / `wheelchairDifficulty` / `notesAbout*` の4列は、
新モデルへの移行（#123〜#125）が済んだ**あとの別デプロイ**で落とす。

| `source` | 意味 |
|---|---|
| `ekidata_group` | 初回シードで同一 `station_g_cd` の現役駅の全順序対から機械生成された行 |
| `manual` | 管理者が手で追加した行 |
| `NULL` | ODPT 時代の行。初回シードの突合時に、難易度・メモがすべて NULL の行だけ削除した |

`station_g_cd` は同一構内の乗り換えしか捉えない。地下通路や連絡改札で繋がる
別グループ間の乗り換えは、`source = 'manual'` で個別に足す。
Admin の駅編集画面の「接続を追加」から
`POST /api/stations/[stationId]/connections` で作成でき、削除は
`DELETE /api/stations/[stationId]/connections/[connectedStationId]` で行う
（[Issue #88](https://github.com/Natsugure/furatora/issues/88)）。
**乗換接続は有向2行で持つ設計**（読み取り側が `stationId` 一致で片方向しか見ない）ため、
作成・削除はいずれも `(A→B)` と `(B→A)` を対で扱う。作成は
`unique_station_connection`（`stationId, connectedStationId`）を衝突対象にした
`onConflictDoNothing` で冪等（`external/repository/stationConnectionRepository.ts`）。
再取込の機構は無いため、この3区分は現在は**由来の記録**として働く。
現行の難易度4列は有向2行の両方に同じ値が入り、向きで異なる場合は既存の
`PUT /api/station-connections/[connectionId]` で個別に直す。この運用は4列とともに廃止される。

## 乗換難易度（`transferConnections` ほか4表）

> **適用状況**: 2026-09-25 現在、**スキーマのみ実装済み**（[Issue #122](https://github.com/Natsugure/furatora/issues/122)。
> development に適用・制約の動作確認済み。全テーブル0件）。**読み書きするコードはまだ無い**。
> 現行の Admin・Web は前節の `stationConnections` の難易度4列を読み書きしている。
> データ移行は [#123](https://github.com/Natsugure/furatora/issues/123)、Admin 入力は
> [#124](https://github.com/Natsugure/furatora/issues/124)、Web 表示は
> [#125](https://github.com/Natsugure/furatora/issues/125)。3件が完了したら、この注記を外す。

### 4層構造

```
transfer_connections        接続（無向1行。端点は 駅×方面、方面は必須）
  └─ connection_routes      接続とルートの紐付け（多対多。label・isBaseline をここに持つ）
       └─ transfer_routes   ルート（1本の物理経路。接続に従属せず、共有されうる）
            └─ transfer_route_facilities  設備（直列に通る順。seq）→ facility_types.code
```

- **ペルソナ（ベビーカー・車いす）は層ではない。** ペルソナ別の可否・必要な行為・所要時分は
  保存せず、設備から表示層で導出する。「通れる」と「バリアフリーで通れる」は別の述語である
  （階段を持ち上げれば通れるが、バリアフリールートは無い、という状態がありうる）。
- **ルートは接続に従属しない。** 方面によって条件が変わらない駅は、方面の組み合わせ分
  （最大4行）の接続を持つ。それらが同じ物理経路を使うときは、ルート行を複製せず
  1本を複数の接続から共有する。「全方面共通」を `NULL` では表さない。
- **`label` と `isBaseline` は `transfer_routes` ではなく `connection_routes` に属する。**
  「その接続でこのルートがどう機能するか」は接続とルートの組の事実であり、ルートが共有される以上、
  ルート側には置けない。
- 接続が無い駅対は「未評価」であり、「バリアフリールートが無い」とは別の状態である。

### 接続の端点

- 端点は `(stationId, direction_type)`。`direction_type` は `'inbound' | 'outbound'` の2値で、
  両端点とも必須。`line_directions.id` は参照しない。
- **解決は完全一致の1行を引くだけ。** 優先順位規則もタイブレークも無い。
  `NULLS NOT DISTINCT` も要らない（方面が `NOT NULL` のため）。
- **無向1行で持ち、端点を `(stationId, direction_type)` の昇順に正規化して格納する。**
  読み取り側は端点の両順序（A,B）と（B,A）を見ること。
  正規化は `apps/admin/src/features/transfer-connection/domain/normalize.ts` の
  `normalizeTransferEndpoints()`。`stationAdjacencies` と違い、順序は DB の CHECK も守る。
  比較は `stationId` を小文字にしてから行う（PostgreSQL の uuid 比較は小文字16進のバイト順）。
- **比較キーに `direction_type` を含めること。** `stations` が物理駅粒度に統合されると
  （[Issue #82](https://github.com/Natsugure/furatora/issues/82)）`stationId` だけでは端点が
  定まらず、同一駅・方面違いの接続が正当になる。そのため `station_a_id <> station_b_id` の
  CHECK は無い。
- **`direction_type` は乗換単位（ホーム）を一意に決めない。** 分岐駅・同一駅を2回通る路線・
  直通運転を伴う分岐では、同じ `(stationId, direction_type)` に複数のホームが対応しうる。
  中野坂上型は [Issue #128](https://github.com/Natsugure/furatora/issues/128)
  （丸ノ内線支線の復元）を前提とした既知の制約。実害は現状中野坂上1駅に閉じている。
  なお、上の「乗換単位（ホーム）」は物理ホームを指し、`stationGroups` の乗換単位
  （物理駅。ekidata `station_g_cd`）とは別の概念である。

### 不変条件

| 不変条件 | 守り方 | 外そうとする人へ |
|---|---|---|
| 同じ端点対の行が2つない | `unique_transfer_connection (stationA, directionA, stationB, directionB)` | — |
| 端点が正規化順で、両端点が同一でない | `transfer_connection_endpoints_ordered`（CHECK。行値比較） | 逆向きの重複行が一意制約をすり抜ける |
| 基準ルートは接続あたり高々1本 | `unique_connection_baseline`（`connection_routes` への部分ユニーク `(connectionId) where is_baseline`） | 外すと迂回度（基準ルートとの所要時分の差）の分母が一意に定まらない。0本は許容 |
| 同一接続内でルート名が重複しない | `unique_connection_route_label (connectionId, label)` | 属性（フラグ等）を一意キーに含めない。事実の訂正が制約に阻まれる |
| 同じルートを同じ接続に2回結ばない | `unique_connection_route (connectionId, routeId)` | — |
| 設備の並びが壊れない | `unique_transfer_route_facility_seq (routeId, seq)` | — |
| 設備の並びと4フラグが既存ルートと完全に一致するルートを作らない | **アプリ層**（#124）。**接続をまたいで**検出し、一致すれば新規作成せず紐付けを提案する | 集合の一意性は DB 制約で書けない |
| 基準ルートの付け替えが中途半端に終わらない | Repository + `withTransaction`（[ADR-0005](../adr/0005-write-atomicity-driver.md)） | 降格と昇格の2文になる |
| 接続を消したあとに孤立ルートが残らない | **アプリ層**（#124）。`connection_routes` は接続の削除で cascade するが、ルートは共有されうるため DB では消さない | — |

**行数の上限は制約で表現しない**（PostgreSQL の制約は行数を数えられない）。

### ルートと設備

- ルートは `minutes`（nullable。不明な所要時分を許す）と、独立した4つの真偽値
  （`isOutdoor` / `requiresExitGate` / `requiresStaff` / `isOfficiallyGuided`。既定 false）、
  `notes` を持つ。
- 設備は `facility_types` の7値: `sameFloor` / `elevator` / `ramp` / `wheelchairEscalator` /
  `escalator` / `stairLift` / `stairs`。**コードはキャメルケース**で、`wheelchairEscalator` は
  車いす対応・係員操作のエスカレーター。
- **`seq` は直列の並びだけを表す。** 同じ段差に対する代替手段（階段と階段昇降機が並んでいる箇所）は
  同一ルートに並べず、別のルート行にする。ペルソナごとの「必要な行為」の判定
  （階段昇降機のルートはベビーカーが通れない等）がこの規則に依存する。

### 備考の役割

`transferConnections.notes` / `transferRoutes.notes` は、モデルが構造的に表現しない次元
（設備の質・時間帯制約・工事中の仮設ルート・方向依存の設備）の受け皿である。
**出発地・目的地に依存する経路上の選好（「〇〇駅のほうが便利」）は書かない。**
接続は出発地に依存しない事実だけを持つ。

### `source`

`transferConnections.source`（`ekidata_group` / `manual` / `NULL`）は
`stationConnections.source` と同じ意味で、1つのホーム対に対する行の由来を表す。

## 駅名の正規化ルール

初回シードの突合（ODPT 由来の既存行と ekidata の駅の対応づけ）で使った正規化キー。
**正規化した値は保存しない。**
**この規則を実装したコードは現在リポジトリに存在しない。** 初回シードの実装
（`features/master-import/domain/normalize.ts`）は投入完了後に削除済み（Issue #56）。
重複検出など、駅名の同一性を機械的に判定する処理を次に実装するときは、
以下の規則に従うこと。

- 括弧とその中身を落とす（`押上〈スカイツリー前〉` = `押上（スカイツリー前）`）。半角丸括弧も対象。
- `ヶ` を `ケ` に寄せる（`市ケ谷` / `市ヶ谷`）。
- 除去した結果が空になる場合は原文を返す（キーが空文字だと無関係な駅が一致するため）。

## `slug` の導出規則

- **`slug` はインポートでは書かない。** 公開操作（Admin）で管理者が確定する。
- 候補は **`lines.slug` + カナ由来の修正ヘボン式**（`hepburn(nameKana)`）で組み立てる。
  変換元は `station_name_k`。`station_name_r`（公式英語表記）を修理する実装にはしない。
- **`(line_cd, ヘボン駅名)` は全国で一意**であることを実データで確認済み。
- ローマ字変換（`apps/admin/src/features/station-publishing/domain/romaji.ts`）:
  - **長音の縮約はお段のみ**（`トウキョウ → tokyo`）。い段・え段は縮約しない
    （`ニイガタ → niigata` / `シンイワクニ → shiniwakuni`）。
  - **撥音を `m` 化しない**（`シンバシ → shinbashi`）。アポストロフィも入れない。
  - `ヂ`/`ヅ` は `ji`/`zu`、`ー` は削除、`ジェイアール` は `jr`。
  - **形態素境界の母音連続は判別不能**（`武雄温泉` 等）。既知の不一致として許容する。
- CHECK 制約 `published_requires_slug`（`published_at IS NULL OR slug IS NOT NULL`）:
  公開駅は必ず `slug` を持つ。詳細は [station-visibility.md](./station-visibility.md)。

## `nameEn`

**事業者の公式表記のみを入れる。機械生成しない。** ekidata は `nameEn` の供給元に
ならない（`station_name_r` は単一の規則に従っておらず、素朴な機械転写の駅が大半）。
公開の必須条件にもしない（必須にすると機械ローマ字を貼る圧力が生じるため、警告に留める）。

## 駅ナンバリング（`stations.code`）

**ekidata は駅ナンバリングを供給しない。** 現在値を持つのは ODPT 由来の手入力分
（東京メトロ・都営ほか）だけで、初回シードの突合でそのまま保持された。
全国展開分は `NULL` のまま運用する。表示側は全箇所 `{station.code && ...}` で
ガードしており、欠損しても壊れない（`nameEn` と同じ扱い）。

## 乗換接続の粒度（`facilityConnections`）

現在 `facilityConnections` は0件。実データが出てから粒度を設計する
（[Issue #84](https://github.com/Natsugure/furatora/issues/84)）。

## 利用規約に由来する制約

[ekidata 利用規約](https://ekidata.jp/agreement.php) 第6条により、
**非加工のデータを第三者へ提供する場合は無償でなくてはならない**。
公開API `/api/v1/*` は駅マスタを素に近い形で返しており、この条項の射程に入りうる。
現在 furatora は無償のため問題は生じないが、**有償プランを設ける場合、
公開APIが返す駅データが「加工」に当たるかの評価が必要**になる。
出典表示は義務ではない（第4条）。

## 関連

- [ADR-0007](../adr/0007-station-master-data-source.md) — データ源の選定、却下案、影響
- [station-visibility.md](./station-visibility.md) — 公開状態のモデル
- [ADR-0001](../adr/0001-layer-structure.md) — feature 間の一方向依存
