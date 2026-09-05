# 設計: 駅・路線マスタの ekidata 移行 (Issue #56 / ADR-0007)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md) /
  [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md) /
  [ADR-0003](../adr/0003-read-write-separation.md) / [ADR-0005](../adr/0005-write-atomicity-driver.md) /
  [ADR-0007](../adr/0007-station-master-data-source.md)
- **作成日**: 2026-08-28

## 適応的実行戦略

信頼度 88%（高）。移行対象の実測と突合の解決率確認が完了しているため、
PoC フェーズを設けず段階的実装に進む。

**ただし1点だけ先行検証した（TASK-1.1・2026-08-31 完了）。** 約46,500行の一括投入が
`withTransaction`（neon-serverless / WebSocket・[ADR-0005](../adr/0005-write-atomicity-driver.md)）で
成立するかは未確認だった。**成立する。** 分割コミットは採らない。
詳細は下記「トランザクション規模（実測）」。

---

## アーキテクチャ

### 全体像

```
[管理者] --4ファイル--> POST /api/master-import  (Route Handler)
                              |
                              v
                    features/master-import/
                      domain/    正規化・差分計画            (純粋関数)
                      usecases/  計画の算出と適用の調停
                      ports.ts   EkidataCsvSource / MasterImportRepository
                              |  implements（依存が逆転する）
                              v
                    external/ekidata/ekidataCsvParser.ts     (CSV形式の知識)
                    external/repository/masterImportRepository.ts
                              |
                              v
                    @furatora/database  (withTransaction)
```

### なぜ Route Handler か（Server Action ではなく）

`station` CSV は **1.4MB** あり、Server Action の既定ボディ上限 1MB を超える。
`next.config.ts` の `serverActions.bodySizeLimit` を引き上げる手もあるが、
これは**アプリ全体の設定**であり、1画面の都合でグローバルな上限を緩めることになる。
Route Handler にこの制限は無く、`apps/admin` に既に多数存在する形式であるため、
新しい規約を持ち込まない。

### ファイル配置（[ADR-0001](../adr/0001-layer-structure.md) の4層に従う）

```
apps/admin/src/
├── app/
│   ├── api/master-import/route.ts        # multipart 受け口・2段階（plan / apply）
│   ├── api/master-migration/route.ts     # 突合。同じ4ファイル・同じ2段階
│   ├── master-import/page.tsx            # アップロードUI
│   └── master-migration/page.tsx         # 突合UI
├── features/master-import/
│   ├── domain/
│   │   ├── importedRecords.ts            # furatora 側の型。ekidata の列名を持たない
│   │   ├── normalize.ts                  # 駅名正規化（突合と共用）
│   │   └── plan.ts                       # 差分計画の算出
│   ├── ports.ts                          # MasterImportRepository / EkidataCsvSource
│   ├── usecases/
│   │   ├── planImport.ts
│   │   └── applyImport.ts
│   └── components/MasterImportForm.tsx
├── features/master-migration/            # ODPT 由来行の突合（Phase 3・一度きり）
│   ├── domain/
│   │   ├── migrationPlan.ts              # 型
│   │   ├── manualMappings.ts             # 手動対応表（事業者17 / 路線 / 駅）
│   │   └── match.ts                      # 突合（純粋関数）
│   ├── ports.ts                          # MasterMigrationRepository
│   ├── usecases/{planMigration,applyMigration}.ts
│   └── components/MasterMigrationForm.tsx
├── features/station-publishing/          # 駅の公開操作（TASK-5.2）
│   ├── domain/
│   │   └── romaji.ts                     # カナ→修正ヘボン式。slug 候補の生成
│   ├── ports.ts
│   └── components/
├── external/
│   ├── ekidata/ekidataCsvParser.ts       # CSV形式の知識はここだけ
│   ├── repository/masterImportRepository.ts
│   └── repository/masterMigrationRepository.ts
└── di.ts                                 # 配線を追加
```

#### `domain/` に何を置くかの基準

**判定は「純粋関数かどうか」ではない。** 純粋性は
[ADR-0001](../adr/0001-layer-structure.md) の依存ルールから来る結果であって、
そこに置く理由ではない。基準は次の1つとする。

> **ekidata が消えても残る知識か。**

| ファイル | 判定 |
|---|---|
| `normalize.ts`（括弧除去・`ヶ`/`ケ`） | **domain。** 実体は「駅名の同一性」であり、ODPT↔ekidata の突合でも使う |
| `plan.ts`（空値で上書きしない・触らない列） | **domain。** furatora のポリシーであり、供給元と無関係に生き残る |
| `importedRecords.ts` | **domain。** furatora が取り込みたい形。`ekidata*Cd` は furatora のスキーマの一部 |
| `ekidataCsvParser.ts` | **domain ではない。** ekidata の CSV 列名・`e_status` の意味という外部仕様の知識で、供給元を替えれば丸ごと消える |
| `romaji.ts` | **domain。ただし置き場が違う**（次項） |

`ekidataCsvParser.ts` は `external/` に置く。ADR-0001 の
「外部世界との接続」に該当する（現在 `external/` の中身が DB だけなのは偶然であり、
DB 専用の層ではない）。`usecases/ → external/` の直接 import は依存の向きに反するため、
**`ports.ts` に `EkidataCsvSource` を定義して `di.ts` で配線する**
（[ADR-0002](../adr/0002-dependency-inversion-ports.md) の既存パターン）。
DB に触れないので、テストは従来どおり DB を起動せずに書ける。

#### `romaji.ts` は master-import に置かない

**`master-import` は `romaji.ts` を一度も呼ばない。** slug の生成は
インポート時ではなく公開操作の時点で行うため（後述「生成タイミング」）、
利用者は Admin の公開UI だけである。

`shared/` にも置かない。カナ→ローマ字の変換表自体は汎用だが、
**採用している規則（長音を縮約する / 撥音を `m` 化しない / `ジェイアール`→`jr`）は
slug の形を決める furatora の方針**であり、汎用ユーティリティではない。
公開操作の feature に閉じる。

---

## データモデル

### 粒度の対応

| ekidata | furatora | 粒度 |
|---|---|---|
| `company_cd` | `operators` | 事業者 |
| `line_cd` | `lines` | 路線（線路名称ベース。一部は運行系統） |
| `station_cd` | `stations` | **路線×駅** |
| `station_g_cd` | `stationGroups`（新設） | **乗換単位の「駅」** |
| `join` | `stationAdjacencies`（新設） | 路線内の隣接関係 |

`stations` は現行の路線×駅粒度を維持する。ekidata `station_cd` と 1:1 で対応するため
既存行を UPDATE で移行でき、`platforms`（14件・7駅）と `lineDirections`（52件）からの
参照を切らずに済む。

#### 粒度は暫定である

**この粒度は「移行を通すための選択」であり、furatora のドメインとして正しいものではない。**

ekidata の粒度は furatora が必要とするものと一致しない。同一事業者・同一駅で
**2,020行 / 10,625（19%）** が複数行に割れる（JR東493 / JR西236 / メトロ86）。
東京駅は18行、新宿は13行になる。東京駅の `JR東海道本線` `上野東京ライン` `宇都宮線` は
**同じ7〜10番線**であり、3つの駅行がそれぞれホーム設備を持つことになる。
新幹線はさらに極端で、**東京〜大宮を5路線（東北・上越・北陸・山形・秋田）が主張する。**

では事業者×物理駅（`station_g_cd` × `company_cd` = 9,441）にすればよいかというと、
ホームを事業者跨ぎで共用する駅（目黒・赤羽岩淵・渋谷・小竹向原）で逆向きに割れる。

**どの粒度も正しくない。** したがって本Issueでは粒度を確定させず、
**暫定の粒度に依存する不変条件を課さない**方針を採る（次項以降）。
確定は実データ投入後に別Issueで行う。

調査の詳細（実測値・検討した案・新幹線と直通運転の問題）は
Obsidian `Projects/furatora/駅・路線の粒度 — 設計のための調査メモ` にある。

### 新設テーブル

```ts
// 乗換単位の「駅」。ekidata station_g_cd に対応
export const stationGroups = pgTable('station_groups', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  ekidataStationGroupCd: integer('ekidata_station_group_cd').notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  nameKana: varchar('name_kana', { length: 100 }),
  prefCode: integer('pref_code'),
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lon: decimal('lon', { precision: 9, scale: 6 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// 路線内の隣接駅。ekidata join に対応。無向グラフ
export const stationAdjacencies = pgTable('station_adjacencies', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  stationAId: uuid('station_a_id').references(() => stations.id).notNull(),
  stationBId: uuid('station_b_id').references(() => stations.id).notNull(),
}, (t) => [
  unique('unique_station_adjacency').on(t.lineId, t.stationAId, t.stationBId),
]);

```

#### `serviceRoutes` を今回は作らない

当初は `serviceRoutes` / `serviceRouteSegments`（順序付き区間の並び）を
新設する設計だった。**取りやめる。**

理由は、この1つのテーブルに**性質の異なる3種類**が混ざるためである。

| 種別 | 例 | 実体 |
|---|---|---|
| 1. 通しで1路線と認知される | 横須賀・総武快速線、京浜東北・根岸線、琵琶湖線/JR京都線/JR神戸線、京阪本線・鴨東線 | **案内路線**（表示単位） |
| 2. 相互直通運転 | 東急東横線 ↔ 副都心線 ↔ 東武東上線 | **運行**（列車の走り方） |
| 3. 分岐するが独立扱いしない | 京王線・京王新線、西武池袋線・西武有楽町線 | **案内路線**（表示単位） |

**1 と 3 は同じ問題である。** どちらも「ekidata の `line_cd` が、
利用者の認識する路線より細かい」。1が「複数を束ねる」、3が「本線に吸収する」
という向きの違いにすぎない。**2 だけが別種**で、これは路線の粒度ではなく
列車の運行の話である。

構造上は「順序付き区間の並び」で1も2も表現できてしまう。だが表示のときに破綻する。
路線一覧に 1・3 は出したいが 2 は出したくない（「東横線・副都心線・東武東上線直通」が
路線一覧に並ぶのは誤りである）。判別する列が必要になり、それは
`displayPriority` が「表示順」と「可視性」を1列に持って壊れたのと同じ構造になる。

加えて**今回はデータを1件も投入しない。** 概念が未分化のまま空のテーブルを
作ると、`docs/domain/` に検証されていないモデルが恒久ドキュメントとして固定される。
`stationAdjacencies` は今回 10,040 行を実際に投入するため事情が異なる。

後続Issueで、**案内路線**と**運行系統**を別概念として設計する。

### 既存テーブルの変更

```ts
operators += {
  ekidataCompanyCd: integer('ekidata_company_cd').unique(),
}
// odptOperatorId は残す（ADR-0007 決定3）。一意制約は付けない
// displayPriority を NOT NULL DEFAULT 0 に変更し、「null=非表示」の意味を外して
// 表示順専用の列にする（理由は次項）。
// 【実測】main は17事業者中 15行が NULL、development は 14行（2026-09-04）。
// バックフィル（0005）がこの NULL を読み終えるまで実行してはならない。
// 先に埋めると「移行前に非表示だった事業者」が判別できなくなる。
// 【実行時点】NOT NULL 化は Phase 5b（TASK-5b.1）であり、TASK-5.0 が本番に出た後の
// 単独PRで行う。apps/web が displayPriority を読んでいる間に純化すると
// 述語が常に真になり、非表示事業者の駅が全公開される（tasks.md「実行順序の根拠」）

lines += {
  ekidataLineCd: integer('ekidata_line_cd').unique(),
  abolishedAt: date('abolished_at'),
}
// 削除: unique('uniqueRailwayPerOperator')

stations += {
  ekidataStationCd: integer('ekidata_station_cd').unique(),
  stationGroupId: uuid('station_group_id').references(() => stationGroups.id),
  prefCode: integer('pref_code'),
  abolishedAt: date('abolished_at'),
  publishedAt: timestamp('published_at'), // 管理者が明示的に設定。null = 非公開
}
// 削除: unique('uniqueStationPerOperator')
// 追加: check('published_requires_slug', sql`published_at IS NULL OR slug IS NOT NULL`)
//       公開されている駅は必ず slug を持つ（理由は後項）

stationLines: 変更しない
// 実測で複数路線を持つ駅は0件だが、unique(stationId) は付けない。
// 0件なのは ekidata が路線ごとに駅を割っているからであり、ドメインの不変条件ではない
// （理由は後項。コメントとしてスキーマにも残す）

stationConnections:
  削除 → odptStationId, odptRailwayId, connectedRailwayId
  変更 → connectedStationId を notNull 化
  追加 → source varchar(20), unique(stationId, connectedStationId)
  // unique は Phase 1 で付与する（Phase 4 ではない）。TASK-2.8 の
  // onConflictDoNothing がこれを衝突対象にするため、Phase 2 より前に必要である。
  // 【実測 2026-08-30】既存546行に重複ペア0件・connectedStationId の NULL 0件のため付与可能

削除 → odptMetadata テーブルごと
```

#### `stationLines` に `unique(stationId)` を付けない理由

実測で複数路線を持つ駅は0件であり、制約は今すぐ付けられる。**付けない。**

**0件なのは ekidata が路線ごとに駅を割っているからであって、
furatora のドメインの不変条件ではない。** ekidata の粒度は暫定であり
（前項「粒度は暫定である」）、確定したものとして扱ってはならない。

そして**コストはマイグレーションではない。制約を前提としたコードが書かれることである。**
制約の削除は安いが、「1駅は1路線」を仮定したクエリと表示ロジックが増えた後では、
粒度の変更が制約の削除では済まなくなる。

`odptStationId` の一意制約と同じ扱いをする。**なぜ制約が無いかをスキーマの
コメントに残す。** 残さなければ、次にスキーマへ触れる者が「実測0件なのに制約が無い」
のを見て付与し、前提を壊す。

#### `connectedRailwayId` を削除する理由

`stationConnections` は**難易度が全546件 NULL** であり、`station_g_cd` から
全置換で再生成される（後述「`stationConnections` は全置換」）。
粒度が将来変わってもデータを作り直せるため、路線を指す列を保持しておく必要がない。

当初は「`stationLines` が 1:1 に固定されるため `connectedStationId` から
路線が一意に定まる」を根拠にしていたが、上記の通り 1:1 は固定しないため
この根拠は使わない。**再生成可能であることが根拠である。**

#### ODPT ID 列に一意制約が無い理由をコメントに残す

[ADR-0007](../adr/0007-station-master-data-source.md) の「影響」に従い、
`odptStationId` / `odptRailwayId` / `odptOperatorId` の各定義に
**なぜ一意でないか**をコメントで書く。残さなければ、次にスキーマへ触れる者が
制約の欠落をバグと判断して再付与し、ODPT 非同期の前提を壊す。

#### 表示順（`displayPriority`）と公開状態（`publishedAt`）を分離する理由

現行の `operators.displayPriority`（`数字=表示順、null=非表示`）は、
17事業者（メトロ・都営 + 未解決接続由来）を前提に成立していた。
ekidata 移行で 162事業者・10,625駅に増えると、この列は使えなくなる。

- **1列に2つの関心が同居している。** 「非表示にしたい」と思うたびに順序を失う。
  `NOT NULL` にもできない（非表示のために null 枠を空けておく必要がある）
- **可視性の粒度が事業者単位では粗すぎる。** JR東日本を「表示」にした瞬間、
  山手線も地方の1路線も一斉に出る。furatora の価値はホーム設備データにあり、
  **整備が進むのは駅単位**である。事業者単位のON/OFFとは合わない

そこで役割を分離する。

- **`operators.displayPriority`**: 表示順専用に純化する。`NOT NULL DEFAULT 0`。
  可視性の意味を持たない
- **`stations.publishedAt`**: 可視性を担う。ekidata 由来の新規駅は
  `NULL`（非公開）で作成され、**管理者が明示的に設定するまで一覧・検索・詳細ページに出ない**

**充足度から自動導出しない。** 「ホーム設備が4件中1件しか入っていない駅は
自動的に非公開」という設計は採らない。編集は途中状態を持つ行為であり、
条件を満たした瞬間に無言で公開されると、公開の可否が編集者の意図から外れる。
`publishedAt` は常に人が設定する。データの充足度は、Admin が公開操作をする際の
**確認材料**（「設備が1/4件しか入力されていません」等）に留め、
公開条件そのものにはしない。この確認UIの実装は本設計のスコープ外とする
（Admin側のバリデーションとして後続Issueで扱う）。

**粒度は `stations`（路線×駅）単位とする。** `stationGroups` 単位にはしない。
利用者が見るページ（駅詳細・検索結果）は `stations` の単位で存在するため、
公開・非公開もその単位で判断できる必要がある。乗換駅グループの一部路線だけ
整備が進んでいる状態（新宿の丸ノ内線は公開・都営新宿線は未整備、等）も
この粒度なら自然に表現できる。

`lines` / `operators` 自体には公開フラグを追加しない。
「所属する `stations` が1件も公開されていない路線・事業者を一覧から隠す」は
`EXISTS` 述語で導出でき、専用の列を持つ必要はない（YAGNI）。

#### 公開されている駅は `slug` を必ず持つ（CHECK 制約）

`getBySlug` は `stations.slug` の一致しか見ない
（`apps/web/src/external/query/stationDetailQuery.ts:79`）。一方
`StationCard.tsx:15` と `StationSearch.tsx:112` は `station.slug ?? station.id` へ
リンクする。**slug が NULL の駅はリンク先が UUID になり、`getBySlug(uuid)` が
何も引かずに 404 する。** この誘導は REQ-6.2 が定めていたが未実装であり、
本制約により状況そのものが発生しなくなるため、**REQ-6.2 は削除した。**
`station.slug ?? station.id` はデッドコードとして整理する。

したがって「公開されているのに開けない駅」を表現不可能にする。

```ts
check('published_requires_slug', sql`${t.publishedAt} IS NULL OR ${t.slug} IS NOT NULL`)
```

これは規約ではなく不変条件であるため、Admin のバリデーションだけに委ねず
DB に置く。既存481行は slug が全件生成済みであるため、
後述の `publishedAt` バックフィルはこの制約に触れない。

**`nameEn` はこの制約に含めない。** 表示側は全箇所
`{station.nameEn && ...}` でガードしており（`StationCard.tsx:22` ほか）、
欠損しても壊れない。slug と違って不変条件ではない。
加えて `nameEn` は事業者公式の表記であり開発者が決められないため、
これを公開のブロッカーにすると **「とりあえず機械ローマ字を貼る」圧力が生じる**。
ekidata の `station_name_r` を採用しないという判断を、制約が逆向きに崩すことになる。
Admin 側の警告表示（「英語名が未設定です」）に留め、公開条件にはしない。
設備充足度を公開条件にしない判断（前項）と同じ扱いである。

#### 現行の可視性ガードは一覧にしか無い（実バグ）

`operators.displayPriority` による可視性判定は、`apps/web` の**8つの読み取り経路の
うち2つにしか存在しない。**

| 経路 | 判定 |
|---|---|
| `app/page.tsx:16` | あり `isNotNull(operators.displayPriority)` |
| `app/api/v1/stations/route.ts:39` | あり（検索もここを通る） |
| `app/stations/[slug]/page.tsx` → `stationDetailQuery.getBySlug` | **無し** |
| `app/lines/[slug]/stations/page.tsx` | **無し** |
| `app/lines/[slug]/page.tsx` | **無し**（上へリダイレクト） |
| `app/api/v1/lines/[slug]/stations/route.ts` | **無し** |
| `app/api/v1/stations/[id]/route.ts` | **無し**（`eq(stations.id, id)` のみ） |
| `app/api/v1/operators/route.ts` | **無し**（`.select().from(operators)` 無条件） |

**最も重いのは `/api/v1/operators` である。** 非表示事業者とその全路線を
無条件に列挙して返すため、URLを推測する必要すらない。
URL直打ちで露出する `/lines/...` `/stations/...`（実証済みの2件）より
到達が容易である。

原因は構造にある。**可視性が「一覧を組み立てる側」の責務として書かれ、
「行を1件引く側」には無い。** `publishedAt` へ移行しても、判定を
経路ごとに書く限り同じ漏れが再発する。

そこで可視性述語を1箇所に閉じる。

```ts
// features/station/domain/visibility.ts
export const publishedStation = () => isNotNull(stations.publishedAt);
```

- **駅の詳細**: `getBySlug` の `where` に上記を足す。該当なしは 404
- **路線のページ**: 公開駅を1件も持たない路線は 404
  （`EXISTS` 述語。前項「`lines` に公開フラグを追加しない」の帰結）
- **公開API**: 同じ述語を通す。`/api/v1/operators` も同様に
  公開駅を持つ事業者だけを返す
- **乗換接続**: `stationDetailQuery` の `getStationConnectionRows` にも足す。
  未公開駅への接続をリンクとして出すと、そこから未公開ページへ到達できる

`displayPriority` は表示順専用に純化されるため（前項）、
**移行後に可視性を判定する述語は `publishedAt` の1つだけになる。**
現行の `isNotNull(operators.displayPriority)` は2箇所とも置き換える。

#### 規模とパフォーマンス

移行後の行数は `operators` 162 / `lines` 602 / `stations` 10,625 /
`stationLines` 10,625 である（いずれも ekidata 由来の分。突合できなかった既存行が
これに加わる）。**この規模では専用のインデックスを先に置かない。**

| 経路 | 変化 | 評価 |
|---|---|---|
| 駅詳細 | `slug` の一意インデックスで1行に絞った後 `publishedAt` を見るだけ | 影響なし |
| トップページ | 全事業者・全路線を引いてJSで組む現行実装に `EXISTS` が加わる。路線 62→602 | ハッシュ結合で完結する規模 |
| 駅検索 `/api/v1/stations` | 部分一致のため btree が効かず全走査。481→10,625行 | 1万行の走査は問題にならない |

いずれも Neon の接続確立コストの方が支配的である。
**現時点で計測せずにインデックスを足さない。**
必要になるとすればトップページの `EXISTS` であり、その場合は
`stations` への部分インデックス（`WHERE published_at IS NOT NULL`）が候補になる。
公開駅は当面ごく少数であるため、部分インデックスは小さく選択性が高い。

なお、トップページの「全件引いてJSで絞る」形（`app/page.tsx:20`）は
**バグの温床そのもの**である。可視性が SQL ではなく組み立てコードに
書かれていたことが、詳細ページで抜けた原因であった。
TASK-5.0 では述語を `where` へ移す。

### `slug` の導出

現行の slug は ODPT ID からの完全自動生成である（`apps/scripts/src/update-odpt.ts:96`）。

```
odpt.Station:TokyoMetro.Ginza.Shibuya → tokyometro-ginza-shibuya
```

ODPT ID が `事業者.路線.駅` の三つ組をローマ字で持っていたために成立していた。
**ekidata 移行で失われるのはこの入力である。** `line` CSV にローマ字列は
1つも存在せず、`station_name_r` は `station_name_k` の機械転写に過ぎない（後述）。

#### 一意性: 路線を前置すれば全国で衝突しない

現役10,625行での実測。

| 案 | 衝突 |
|---|---|
| 駅名ヘボンのみ（`shinjuku`） | 3,773行 / 10,625（35.5%） |
| 乗換グループ単位 + 都道府県 | 104グループ |
| **`(line_cd, ヘボン駅名)`** | **0行。衝突ゼロ** |

駅名だけでは全く足りない（`tokyo` 18行、`shinjuku` 13行、`shiyakushomae` 17行）。
路線を前置すれば全国で完全に一意になる。現行の `tokyometro-ginza-shibuya` と
同じ構造である。

```
stations.slug = `${lines.slug}-${hepburn(normalize(stations.nameKana))}`
```

手入力が必要なのは **602路線の `lines.slug`** であり、10,625駅ではない。
しかも公開する路線の分だけで足りる。`lines.nameEn` も ekidata から
供給されないため、どのみち手で書くことになる。

#### `nameEn` と分離する

slug は URL 識別子であって公式英語名ではない。`Kita-senju` のハイフン位置や
大文字は公式表記の問題であり、slug には影響しない（`kitasenju` で機能上も
可読性上も足りる）。**公式表記の正しさが要るのは `nameEn` だけである。**
ここを混同すると、`nameEn` を機械生成しないという判断
（[requirements.md](./requirements.md)）が崩れる。

#### ローマ字変換規則（`features/station-publishing/domain/romaji.ts`）

**変換元は `station_name_r` ではなく `station_name_k`。**
`station_name_r` を後から修正する方式は採らない。`shinnjukusannchoume` を
直そうとすると「`nn` は撥音か、`n` で終わる語＋ナ行か」の判別が要るが、
カナにその曖昧さは存在しない。CSV の誤字（`echigouuzawa`＝エチゴユザワ、
`ohanadyaya`＝オハナヂャヤ）も、変換元を替えるだけで消える。

実測: CSV に混在する手入力ヘボン式186件との突合で、純粋なローマ字化としての
正解率 **116/135 = 85.9%**（英訳48件・カナ欠陥3件を対象外とした後）。
下記の置換辞書と撥音の方針を含めると約90%。

**決定的（カナから一意に決まる）**

| 規則 | 例 |
|---|---|
| `ヂ`/`ヅ` → `ji`/`zu` | オハナヂャヤ→`ohanajaya`、コウヅ→`kozu` |
| `シ`/`チ`/`ツ`/`フ`/`ジ` → `shi`/`chi`/`tsu`/`fu`/`ji` | ワープロ式の `si`/`ti`/`tu`/`hu` を排除 |
| 促音 `ッ` → 次の子音を重ねる（`ch` の前は `t`） | クッチャン→`kutchan` |
| 拗音・外来音 | シンジュクサンチョウメ→`shinjukusanchome` |
| `ー` → 削除 | ガーラ→`gara` |
| `ジェイアール` → `jr`（置換辞書。該当13駅） | ジェイアールソウジジ→`jr-sojiji` |

**方針として決めるもの（正誤ではなく選択）**

| 論点 | 決定 |
|---|---|
| 長音の縮約 | **縮約する**。トウキョウ→`tokyo` |
| 撥音の `n`→`m` 化（b/p/m の前） | **しない**。コウエンマエ→`koenmae` |
| `ン`＋母音のアポストロフィ | **入れない**。シンオオサカ→`shinosaka` |

`n`→`m` は修正ヘボン式としては正しいが、slug はハイフンを入れないため
`mm` が出る（実測221件が該当。`koemmae` / `byoimmae` / `kumamotokosemmae`）。
公式表記が `Koen-mae` と切るのはこの読みにくさを避けるためであり、
ハイフンの無い slug では `n` のままが素直である。
一意性は `n`→`m` の有無に関わらず衝突ゼロを確認済み。

**原理的に決まらないもの**

母音の連続が長音なのか、形態素境界をまたぐ別々の母音なのかは、
カナから判別できない。

```
タケオオンセン  武雄温泉    タケオ + オンセン  → takeonsen      (正: takeo-onsen)
テダコウラニシ  てだこ浦西  テダコ + ウラニシ  → tedakoranishi  (正: tedako-uranishi)
コウミ          小海        長音               → komi           (正: koumi)
```

露出は長音縮約が発火する2,680行（25.2%）、実測誤り率は約3%。
**形態素解析器は導入しない。** 得られる3%に対して依存が重い。
この3%は次項の公開ゲートで回収する。

#### 生成タイミング: インポートではなく公開時

**インポートは `slug` を書かない**（上書きルール表の通り「触らない列」のまま）。
`slug` は公開操作の時点で Admin が生成値を提示し、管理者が確認して確定する。

インポート時に全10,625駅へ自動投入すると、CHECK 制約が無条件に充足されてしまい、
**人の目を通す機会が消える。** 誤変換の約3%は「公開する駅だけ、公開時に1回」
見れば捕まる。全駅をレビューする必要はない。未公開駅の誤変換は表出しないが、
到達不能であるため害が無い。この非対称性が、精度を追わずに済む根拠である。

変換器そのものは使い捨てではない。インポートは ekidata の更新のたびに
繰り返し実行され、新線開業・新駅設置のたびに slug を持たない駅が入ってくる。
`romaji.ts` は恒久コードであり、テスト対象である。

#### カナ側の欠陥（要確認9駅）

漢字名に無い「駅」「停留場」がカナにだけ付いている行がある。

```
天童南        テンドウミナミエキ
羽沢横浜国大   ハザワヨコハマコクダイエキ
東宿郷        ヒガシシュクゴウテイリュウジョウ
阿蘇下田城     アソシモダジョウエキ
```

**末尾の `エキ` を機械的に落としてはならない。** 同じ検出に
`家城（イエキ）` `植木（ウエキ）` が引っかかる。これらは正当な駅名である。
9駅のみのため自動除去せず、公開ゲートの要確認リストに載せる。

#### `lines.slug` の欠落は駅より先に踏む

`apps/web/src/components/LineAccordion.tsx:11` は
`/lines/${line.slug}/stations` へフォールバック無しでリンクしている。
ekidata 由来の602路線は slug が NULL で入ってくるため、`/lines/null/stations`
が生成される。駅の slug より先にここを踏む。

**前項の可視性ガードで塞ぐ**（別Issueに切り出さない）。

ここで「公開駅を持つ路線は必ず slug を持つ」という不変条件を立てて
それを担保する方針は**採らない。** その不変条件は暗黙の連鎖に乗っており、

```
駅が公開されている → CHECK により slug を持つ
                  → その slug は `lines.slug` から生成された
                  → ゆえに `lines.slug` は非 NULL
```

連鎖の途中（例: 路線の slug を後から空にする）が切れると復活する。
そして Postgres の CHECK は他テーブルを参照できないため、
DB制約で押さえるにはトリガか非正規化フラグが要る。問題に対して重い。

**不変条件を守るのではなく、不要にする。** 路線の可視性述語に
`slug IS NOT NULL` を含める。

```ts
// features/station/domain/visibility.ts
export const publishedStation = () => isNotNull(stations.publishedAt);

// 路線が見えるのは「公開駅を1件以上持ち、かつ slug を持つ」とき
export const visibleLine = () => and(
  isNotNull(lines.slug),
  exists(/* stationLines → stations で publishedStation() */),
);
```

こうすると slug が NULL の路線はそもそも描画されないため、
連鎖が切れても `/lines/null/stations` は生成されない。
`LineAccordion` 側にガードを足す必要もない。

書き込み側でも同じ状態を作らせない。Admin の公開操作は、
路線の slug が未設定なら駅を公開させない（TASK-5.2）。
加えて「公開駅を持つのに slug が無い路線」は
**データ健全性の警告**として Admin に一覧表示する。
これは正しさを担保するためではなく、
`lines.slug` の付け忘れを検知するためである。

---

## インポートのデータフロー

### 2段階（plan → apply）

```
POST /api/master-import  { mode: 'plan', 4ファイル }
   解析 → 検証 → 差分計画を返す（DBは変更しない）
   ← { summary, warnings, blockers, planToken = sha256(4ファイル) }
      ↓ 管理者が確認
POST /api/master-import  { mode: 'apply', 4ファイル, planToken }
   ダイジェストを照合 → withTransaction 内で適用
```

#### 計画はサーバに保持しない

`planToken` は**計画の格納場所を指す識別子ではなく、4ファイルのダイジェストである。**
apply は同じ4ファイルの再送を受け、解析と差分算出をやり直す。

サーバレス環境ではプロセス間でメモリを共有できないため、計画を保持するなら
DB に置くことになる。しかし計画は最大47,800行分あり、そのために
（`jsonb` の使用を含む）テーブルを増やすのは、1.7MB の再送とパース40msに対して重い。
差分算出は純粋関数であり、再計算しても同じ結果になる。

再算出には副次的な利点もある。**スナップショットを適用時のトランザクション内で
取り直す**ため、提示から承認までの間に DB が変わっていても、
書き込みが古い前提に基づかない。

#### 適用不能な事象は plan の時点で提示する

`operators.name` は一意制約付きである。そして現行DBの17事業者の `name` は
**ekidata の `company_name` と全件完全に一致する**（JR東日本 / 東京メトロ / ゆりかもめ …）。
突合（Phase 3 / Admin の `/master-migration`）で `ekidataCompanyCd` を
埋める前にインポートを流すと、
17件すべてが別行として INSERT され、`operators_name_unique` の 23505 で
**トランザクション全体が失敗する。**

これを実行時の 500 として表出させない。差分計画が「別の既存事業者が同じ name を
持っている」組を検出し、**適用不能（blockers）として提示する。**
`apply` はこれが残っている限り 422 を返して適用しない。

したがって**実運用の順序は「Phase 3 の突合 → インポート」である。**
逆順では blockers が消えない。

### トランザクション規模（実測）

Neon `furatora-db` の使い捨てブランチ（PG17 / 0.25 CU / ap-southeast-1）に対し、
実データと同じ行数・同じ upsert 文の合成データを投入した結果（`BATCH_SIZE = 1000`）。

| | 全体 | コールバック内 | 接続+BEGIN+COMMIT | 1文あたり平均 |
|---|---|---|---|---|
| 1周目（全件 INSERT） | **7,960 ms** | 7,564 ms | 396 ms | 151.3 ms |
| 2周目（全件 UPDATE・定常状態） | **7,293 ms** | 6,871 ms | 422 ms | 137.4 ms |

46,538行 / 50文。**単一トランザクションで成立する。**

サーバ側の制限値は `statement_timeout = 0`（無制限）、
`idle_in_transaction_session_timeout = 300,000 ms`、`idle_session_timeout = 0`。
**トランザクション全体の時間制限は存在しない。**

#### 決定: 単一 `withTransaction` で適用する

判定基準（実測前に確定させたもの）は「全体時間が制限値の 1/3 未満なら一括」であった。
実測は **1/37** であり、境界に近づいてすらいない。テーブル単位の分割コミットは採らない。
`BATCH_SIZE` は **1000** を採用する。

#### パースは必ずトランザクションの外で行う

`idle_in_transaction_session_timeout = 300,000 ms` は**文と文の「間」にのみ効く**。
バッチを連続投入している限りアイドルはネットワーク往復1回分であり、この8秒は
制限に当たっていない。**トランザクション内でCSVを解析すると、そこで初めて
この5分がリスクになる。** `plan` 段階で解析を終え、`apply` は投入だけを行う。

#### `BATCH_SIZE` を詰める最適化はしない

1文あたり137〜151msに対し、`operators` は175行1文で207ms、`lines` は602行1文で382ms
かかっている。行数を1/6にしても時間は半分にしかならないため、固定費（往復遅延）が
支配的である。`BATCH_SIZE` を上げれば全体時間は縮むが、
**8秒を4秒にする最適化に意味はない**ため行わない。
なお PostgreSQL の bind パラメータ上限は1文あたり65535であり、
`stations` の約14列では約4,600行/文が上限である。1000はその範囲に収まる。

1万行超を無確認で流す操作にはしない。`plan` の結果は
新規 / 更新 / 廃止 / 突合失敗 をテーブルごとに提示する。

### 上書きルール

インポートが触る列と触らない列を分離する。これが手編集保護の主機構である
（列単位のロックは今回のスコープ外。[requirements.md](./requirements.md) スコープ外表）。

| テーブル | ekidata が上書きする列 | 触らない列（furatora 固有） |
|---|---|---|
| `operators` | `name` | `displayPriority`, `odptOperatorId` |
| `lines` | `name`, `nameKana`, `color` | `slug`, `nameEn`, `lineCode`, `displayOrder` |
| `stations` | `name`, `nameKana`, `lat`, `lon`, `prefCode`, `stationGroupId` | `slug`, `nameEn`, `code`, `notes`, `publishedAt` |
| `stationGroups` | `name`, `nameKana`, `prefCode`, `lat`, `lon` | — |

#### `nameEn` を ekidata が触らない理由

**そもそも `lines` には供給元が無い。** `line` CSV の列は
`line_cd, company_cd, line_name, line_name_k, line_name_h, line_color_c,
line_color_t, line_type, lon, lat, zoom, e_status, e_sort` であり、
ローマ字列が存在しない（`line_name_h` は135件を除き `line_name` と同一の日本語）。

`stations` については `station_name_r` が存在するが、**採用しない。**
現役10,625行を `station_name_k` から機械変換して突合したところ、
**97.9% が再現でき**、内訳はワープロ式31.3% / 修正ヘボン式3.7% /
両者で同一63.0%であった。つまりこの列は `station_name_k` が既に持つ情報しか
持っておらず、残り2.1%も大半はノイズである（`Nayoro High School` などの英訳混入、
`echigouuzawa`＝エチゴユザワの誤字、`ohanadyaya`＝ヂャの処理揺れ）。

一方、現行DBの `nameEn` は `odpt:stationTitle.en`、すなわち**事業者公式の英語名**である
（`apps/scripts/src/update-odpt.ts:195`）。`Kita-senju` / `Shinjuku-sanchome` /
`Jimbocho` / `Kozu` が正しく入っている側であり、ekidata で上書きすると
メトロ・都営335駅＋未解決由来146駅の公式英語名が
`shinnjukusannchoume` 等で潰れる。後述「未突合行の扱い」と矛盾する。

ハイフン位置と大文字は**原理的に導出できない**。CSV でハイフンを持つのは
250/10,625行、大文字は217行のみで、いずれも新幹線路線に偏った手入力である。
`Kita-senju` の切れ目は形態素境界の知識であり、カナにもローマ字にも入っていない。

全国展開分の `nameEn` は **NULL のまま運用する。** 表示側は全箇所
`{station.nameEn && ...}` でガードしており（`StationCard.tsx:22`、
`StationSearch.tsx:104`、`stations/[slug]/page.tsx:38`）、NULL は安全に握り潰される。
「英語名を持っていない」と正直に表現する方が、漢字の下に
`shinnjukusannchoume` を出すより良い状態である。
駅ナンバリングの欠落（[requirements.md](./requirements.md) C-2）と同じ扱いになる。

**空値では上書きしない。**

```sql
name_kana = COALESCE(NULLIF(EXCLUDED.name_kana, ''), stations.name_kana)
```

無料版CSVはカナ・ローマ字が全件空、路線色が 576/624 空である。
素朴な `EXCLUDED` 上書きだと、現行DBのメトロ・都営335駅のカナと
東京メトロ9路線の色がインポートの瞬間に消える。会員版に切り替えた後も、
ekidata 側が一時的に値を落とした版を配布した場合に同じ事故が起きる。

代償として、値を「消す」方向の更新が CSV からできなくなる。
消す操作は Admin の編集画面から行う。

### 廃止データの扱い

`e_status` は **0 = 現役 / 1 = 未開業 / 2 = 廃止** の3値である
（初版は 0 と 2 しか想定していなかった）。取り込むのは 0 だけで、
現役は 駅10,625 / 路線602 / 事業者162 である。

`e_status = 1`（未開業。路線1件・駅5件）は**取り込まず、廃止扱いにもしない。**
まだ存在しない駅であり、廃止日を立てるのは誤りだからである。件数だけ警告に出す。
既にDBに存在する行が CSV から消えた、または `e_status = 2` になった場合は
`abolishedAt` を設定して**行は残す**。`platforms` 等からの参照を切らないため。

### 乗換接続の生成

同一 `station_g_cd` に属する現役駅の全順序対（**6,946行**）を
`source = 'ekidata_group'` として生成する。

生成は JS で行数を組み立てず、**`stations` の自己結合による `INSERT ... SELECT` 1文**で行う。
`ON CONFLICT (station_id, connected_station_id) DO NOTHING` が
`source = 'manual'` の行と難易度入力済みの行を守る。
このため実際の挿入数は適用してからでないと確定しない。
差分計画に出す 6,946 は CSV から見た**上限**である。

- `source = 'manual'` の行には触れない
- 難易度が入力済みの行は `onConflictDoNothing` で保持する

`station_g_cd` は乗換関係を正しく捉えている。実データで確認した例:

```
浅草:  東武2100201 / 銀座線2800101 / 浅草線9930218 → g_cd=2100201 で同一
       つくばEX 9930903                            → g_cd=9930903 で独立
野田:  阪神3500103 → g_cd=1162506 (JR東西線 海老江)
       大阪環状線1162308 → 独立
```

駅名が異なってもグループ化される（255件。北新地⇔大阪、朝霞台⇔北朝霞 など）。

**ただし完全ではない。** 新宿(g_cd=1130208) と 新宿西口(都営大江戸線 9930102) は
別グループだが実際には乗り換えできる。`source = 'manual'` での追加が前提となる。

---

## 移行アルゴリズム（一度きり）

**Admin の画面操作として実装する**（`/master-migration`）。
`apps/admin/src/features/master-migration/` + `external/repository/masterMigrationRepository.ts`。

初版は `apps/scripts/src/migrate-to-ekidata.ts` としていたが、2点で成立しない。
`apps/scripts` の依存は `@furatora/database` だけであり、`@/` エイリアスを使う
`ekidataCsvParser.ts` を持ち込めない。また ADR-0008 は「各環境のアプリが自分の
Neon ブランチに書く」形であり、本番の接続文字列をローカルへ置く経路を新設したくない。
画面にすれば、取り込みと同じ CSV・同じ認証・同じ2段階（試算 → 承認）で完結する。

**feature 間の依存 `master-migration → master-import` が新しく生じる**
（`normalizeStationName` / `EkidataCsvSource` / `ImportedLine` / `ImportedStation`）。
一方向で循環しないため許可する（ADR-0001「feature 間の依存」）。
CSV 形式の知識は `external/ekidata/` に1つだけ置き、両方の feature が
port 越しに使う。突合側に別のパーサを持たせない。

**`stations.id` / `lines.id` は変更しない。** UPDATE で `ekidata*Cd` を埋める。
**手動対応表は自動突合より先に引く**（人が CSV を読んで確認した結果の方が、
名前一致より確かな根拠であるため）。

### 順序: 事業者 → 路線 → 駅

路線を主役にすると n:m を解くことになる。ODPT の路線は運行系統粒度で作られており、
ekidata の線路名称粒度と対応しないためである（例: ODPT「京浜東北線・根岸線」1件 ↔
ekidata 11332 + 11307 の2件）。**駅名から引けば `line_cd` は自動的に確定する。**

#### 1. 事業者（17件）

`odptOperatorId` が全17件に入っていることを実測済み。手動対応表で解決する。

```
JR-East→2  JR-Central→3  TokyoMetro→18  Toei→119  Tobu→11  Seibu→12
Keisei→13  Keio→14  Odakyu→15  Tokyu→16  Keikyu→17  SaitamaRailway→121
MIR→123  Yurikamome→125  TokyoMonorail→148  TWR→149  ToyoRapid→150
```

#### 2. 路線（62件）

事業者を確定した上で、手動対応表 → 路線名の正規化一致 → 全駅包含判定 の順に試みる。

**実測（2026-09-04・会員版CSVと本番相当DB）: 62件中 自動50 / 手動9 / 対応行なし3。**
初版の「46件中42件が自動決定」は未解決接続由来の46路線に対する数字であり、
62件全体のものではない。

自動で決まらない理由は2種類だった。

1. **包含判定が複数に一致する。** ODPT の路線は運行系統粒度で区間が短く、
   駅数が少ないほど「その駅を全部持つ ekidata 路線」が増える。
   `高崎線` の {上野, 東京} は新幹線5路線すべてに含まれる
2. **包含判定が成立しない。** `常磐線快速` は上野東京ライン経由の東京・新橋を
   含むが ekidata の常磐線に無い。`有楽町線` は `麴町`(U+9EB4) と
   `麹町`(U+9EB9) の異体字差で1駅欠ける

**絞れないときは機械的に1件へ倒さず、候補を添えて人に渡す。**
駅数が最少のものを採る等の規則を入れると、根拠の無い対応が黙って本番に入る。

#### 対応表は「対応行が無い」も表現する

3路線（`丸ノ内線支線` / `東武スカイツリーライン(支線)` / `常磐線各駅停車`）は
**ekidata に対応する行が存在しない。** ekidata が親路線に畳んでいるためである。
値を書けないだけでなく、自動突合を**止めなければならない**。放置すると
包含判定で親路線に吸われ、親と子が同じコードを主張して
`duplicate_ekidata_code` になる。

そこで対応表の値を `number | null` とし、`null` を
「人が確認した結果、対応行が無い」の記録とする。未記載（自動突合に任せる）と区別する。

#### 3. 駅（481件）

路線が確定していれば、その路線の ekidata 駅から正規化した駅名の完全一致で引く。

**正規化ルール**（`domain/normalize.ts`。実データで踏んだもの）

- **括弧は中身ごと除去**: `押上〈スカイツリー前〉` / `押上（スカイツリー前）` → `押上`
  （ekidata 内部でも山括弧と丸括弧が混在している）
- `ヶ` → `ケ`（市ケ谷など）

未解決由来146件での実測: **131件が自動解決、15件が要手動**。

| 件数 | 内容 | 対応 |
|---|---|---|
| 11 | 新幹線の東京・上野 | 会員版CSVに駅があり、**自動で解決した** |
| 3 | 常磐線快速の新橋・東京、高崎線の東京 | 上野東京ライン経由。**対応づけられない**（下記） |
| 1 | 京王新線「新宿」 | ekidata 側の駅名が「**新線新宿**」(2400701)。手動 |

**実測（2026-09-04）: 481件中 477件が解決、4件が NULL のまま残る。**

対応づけられない4件は、突合の失敗ではなく**粒度が一致しないこと**の現れである。

- `丸ノ内線支線` の `中野坂上`: 現行DBは路線×駅粒度で同じ駅を2行持つが、
  ekidata は `2800220` 1行しか持たない。`丸ノ内線` 側の行が取る
- `常磐線快速` の `東京`・`新橋`、`高崎線` の `東京`: これらに当たるのは
  `11343`「上野東京ライン」の1行だけで、`東京` を要する行が2つある。
  `ekidataStationCd` は一意であり、片方に割り当てる根拠が無い

いずれも `null` として対応表に記録し、理由を残す。行は削除しない（REQ-3.2）。
粒度の確定は実データ投入後の後続Issueで行う（「粒度は暫定である」）。

#### 4. 未突合行の扱い

**削除しない。** `ekidata*Cd` を NULL のまま残し、Admin の解決UIに一覧表示する。
未解決由来の146駅は `code`（駅ナンバリング）と `nameEn` を全件持っており、
突合できれば全部保持される。

#### 5. 既存行の `publishedAt` バックフィル

`publishedAt` は新規行で `NULL`（非公開）が既定になる（前述）。
**そのままでは移行実行時に既存481駅が一斉に非公開へ落ち、本番サイトが空になる。**

**手書きのSQLマイグレーション（`0005_backfill_published_at.sql`）で行う。**
突合とは独立であり、Vercel のビルドが development / preview / production の
すべてへ自動適用する。スクリプトや画面操作にすると環境ごとに実行忘れが起き、
とくに Phase 5 の Preview で「公開駅0件の空サイト」を検証してしまう。

突合の成否に関わらず、既存481行のうち
`publishedAt` が未設定のものへ移行実行時刻を設定する。
既に管理者が値を設定していた場合は上書きしない
（本スクリプトは一度きりの初期化であり、上書きルールの対象外だが同じ方針を踏襲する）。

**ただし全件ではない。移行前の可視性をそのまま引き継ぐ。**

```sql
UPDATE stations SET published_at = now()
FROM operators
WHERE stations.operator_id = operators.id
  AND stations.published_at IS NULL
  AND operators.display_priority IS NOT NULL   -- 移行前に非表示だった事業者を除く
```

`displayPriority` が NULL の事業者に属する駅を一律に公開すると、
**前項の実バグ（URL直打ちで非表示事業者の駅が見える）を、
仕様として恒久化することになる。** ゆりかもめ等が該当する。
これらは `publishedAt` を NULL のまま残し、整備が済んだ時点で
管理者が個別に公開する。

`displayPriority` を `NOT NULL DEFAULT 0` へ変更する前に本バックフィルを
実行すること。順序を逆にすると、可視性の情報が失われて判定できなくなる。

さらに、**純化は TASK-5.0（可視性述語の一元化）が本番に出た後の単独PRで行う**
（Phase 5b）。`apps/web` が `isNotNull(operators.displayPriority)` を読んでいる間に
`NOT NULL DEFAULT 0` にすると述語が常に真になり、非表示事業者の駅が全公開される。
マイグレーションはビルド時に走る（ADR-0008）ため、同じPRに入れると
ビルド完了までの間だけ古いコードが純化後のDBを見る。

バックフィルの件数は環境ごとに違ってよい。この文は各環境の「移行前の可視性」を
写すためである（2026-09-04 実測: main 335件 / development 438件）。

### `stationConnections` は全置換

実測で 546件すべて難易度未入力（`stroller_difficulty` / `wheelchair_difficulty` が
全件 NULL）であるため、削除して `station_g_cd` から作り直す。

**ただし実測0件に依存しない。** 削除は由来で絞り、`source IS NULL` かつ
難易度・メモがすべて NULL の行だけを対象にする。`'manual'` と `'ekidata_group'`
には触れない。守るべき行に構造的に触れない形にしておく。
入力済みの行が1件でもあれば `connection_has_input` として適用を止める。

削除から取り込みまでの間、公開サイトの乗換接続は空になる。続けて実行すること。

### `unresolved-connections` ページの転生

`apps/admin/src/app/unresolved-connections/`（556行）は ODPT の未解決接続を
人が解消するUIだった。役割は同じまま、**キーを ODPT ID から ekidata コードへ
差し替えて「ekidata 未突合マスタの解決UI」にする。** 上記の未突合15件が最初の対象になる。

---

## エラーハンドリング

| 状況 | 検出箇所 | 応答 |
|---|---|---|
| CSVの必須列が欠落 | `external/ekidata/ekidataCsvParser.ts` | 適用せず、ファイル名と欠落列名を返す |
| `line_cd` が `line` CSV に存在しない駅行 | `domain/plan.ts` | 当該駅をスキップし、計画に警告として計上 |
| `station_g_cd` がダングリング（59件） | `external/ekidata/ekidataCsvParser.ts` | グループを破棄せず、所属する現役駅の最小 `station_cd` から代表値を決定 |
| `join` の端点が現役駅でない、または `line_cd` が現役路線でない（149行） | `external/ekidata/ekidataCsvParser.ts` | FK を張れないため取り込まず、警告に計上 |
| ekidata の事業者名が既存の別事業者と重複する | `domain/plan.ts` | **適用不能**として `plan` の時点で提示し、`apply` を受け付けない（`operators.name` の一意制約） |
| 適用中の SQL エラー | `external/` | トランザクションをロールバックし、失敗テーブルと件数を返す |
| 突合失敗 | `master-migration/domain/match.ts` | NULL のまま残し、名前の近い候補を添えて画面に一覧表示する。処理は継続 |
| 複数の既存行が同じ ekidata コードに突合 | `master-migration/domain/match.ts` | **適用不能**として試算の時点で提示し、`apply` を受け付けない（`ekidata*Cd` の一意制約） |
| トランザクションのサイズ超過 | — | **起きない。** TASK-1.1 で全体7.3〜8.0秒／制限の1/37と実測済み（上記「トランザクション規模（実測）」） |

---

## テスト戦略

**DBを起動せずに書けるものが主戦場。** CSV文字列 → 構造体 → 差分計画 までが
純粋関数であり、ここで振る舞いを固定できる（[ADR-0002](../adr/0002-dependency-inversion-ports.md)）。
`ekidataCsvParser.ts` は `external/` にあるが DB に触れないため、同じ扱いにする。

| 対象 | 種別 | 主なケース |
|---|---|---|
| `external/ekidata/ekidataCsvParser.ts` | 単体 | 必須列欠落、`e_status` の分岐、`line_cd` と `station_cd` 上位桁の不一致。**DBに触れないため domain と同様に単体で書ける** |
| `master-import/domain/normalize.ts` | 単体 | 山括弧・丸括弧の除去、`ヶ`/`ケ`、正規化しても衝突しないこと |
| `station-publishing/domain/romaji.ts` | 単体 | `ヂ`/`ヅ`、促音（`ch` の前は `t`）、拗音・外来音、長音縮約、撥音を `m` 化しないこと、置換辞書（`ジェイアール`）。CSV の手入力ヘボン式186件を回帰用の固定データにする |
| `master-import/domain/plan.ts` | 単体 | 新規/更新/廃止の判定、空値で上書きしないこと、冪等性（同一入力で差分0） |
| `usecases/` | 単体 | ports をスタブして計画と適用の調停を検証 |
| `route.ts` | 結合 | 1.4MB のアップロードが通ること、plan→apply の順序 |
| `master-migration/domain/match.ts` | 単体 | 事業者の対応表、路線の名前一致・全駅包含、駅の名前一致、`ヶ`/`ケ`、適用不能の検出、冪等性（適用後の状態を入れると書き込み対象が0） |
| 移行（画面） | 手動 | `main` から切った使い捨てブランチで、試算 → 適用 → 取り込みまで通しで演習する（tasks.md「リハーサル手順」） |

---

## 恒久知識の振り分け（フェーズ5で反映）

本設計で確定した内容のうち、次のIssue以降も有効であり続けるもの。
**実装完了後に `docs/domain/` へ反映する**（[運用ルール](../domain/README.md)）。

| 内容 | 行き先 |
|---|---|
| ekidata のコード体系（`station_cd` / `station_g_cd` / `line_cd` の意味と粒度）、`station_cd` 上位桁が `line_cd` と一致しない件、ダングリング59件、`e_status` が3値（現役／未開業／廃止）であること | `docs/domain/station-master-model.md`（新規） |
| **現在の粒度が暫定であること**（ekidata 粒度は 19% 重複し、事業者×物理駅はホーム共用駅で割れる）。`stationLines` に `unique(stationId)` を付けない理由 | 同上 |
| 乗換接続の由来区分（`ekidata_group` / `manual`）と、g_cd が捉えない乗換の存在 | 同上 |
| `stationAdjacencies` は無向辺を1行で持ち、書き込み時に端点 UUID を昇順へ正規化して逆向きの重複を防ぐこと。読み取り側は両方向を見る必要があること | 同上 |
| 路線概念の3分類（案内路線 / 運行 / 支線の吸収）と、ekidata `line_cd` がそれらを混在させていること | `docs/domain/station-master-model.md` |
| 駅名正規化ルール | `docs/domain/station-master-model.md` |
| `slug` の導出規則（`lines.slug` + カナ由来の修正ヘボン式、`(line_cd, ヘボン駅名)` が全国で一意であること、撥音を `m` 化しない方針、形態素境界の母音連続は判別不能であること） | 同上 |
| `nameEn` は事業者公式表記のみを入れ、機械生成しないこと。ekidata は供給元にならないこと | 同上 |
| ekidata 規約に由来する制約（非加工データの第三者提供は無償に限る） | 同上 |
| 公開状態のモデル（`operators.displayPriority` は表示順専用、可視性は `stations.publishedAt` が単独で担う。粒度は `stations` 単位で `stationGroups`/`lines`/`operators` には持たせない） | `docs/domain/station-master-model.md` |

---

## 規約に由来する設計上の注記

[利用規約](https://ekidata.jp/agreement.php) 第6条は、
**非加工のデータを第三者へ提供する場合は無償でなくてはならない**と定める。

公開API `/api/v1/stations` / `/api/v1/lines/[slug]/stations` は
駅マスタを素に近い形で返しており、この条項の射程に入りうる。
現在 furatora は無償であるため問題は生じない。**有償プランを設ける場合、
公開APIが返す駅データが「加工」に当たるかの評価が必要になる。**
設備情報を結合した応答は加工と解しうるが、判断は有償化の設計時に行う。

出典表示は義務ではない（第4条）。任意表記は歓迎されている。
