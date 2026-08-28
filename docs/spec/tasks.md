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
Phase 1: スキーマ変更 + トランザクション規模の計測  (基盤・唯一の未知)
Phase 2: インポート機構                           (P0)
Phase 3: 移行スクリプト（突合）                    (P0・Phase 2 に依存)
Phase 4: ODPT 後始末                             (Phase 3 完了後)
Phase 5: 公開ガードと Admin UI                     (P0・現行バグの修正を含む)
Phase 6: 検証・振り返り                            (必須)
```

### 実行順序の根拠

Phase 1 に**唯一の未知**（35,000行の一括投入が `withTransaction` で成立するか）がある。
ここで分割コミットが必要と判明すると Phase 2 の `applyImport` の構造が変わるため、
先に片付ける。

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

## Phase 1: スキーマ変更 + 規模計測

### TASK-1.1: トランザクション規模の計測
- **依存**: なし
- **内容**: `stations` 10,465 + `stationAdjacencies` 10,189 + `stationConnections` 5,876 +
  `stationGroups` 8,766 ≒ 35,000行を `withTransaction` で投入し、
  Neon の接続時間制限に収まるか計測する。捨てスクリプトで可
- **期待結果**: 所要時間と成否。失敗する場合はテーブル単位の分割コミットへ方針変更し、
  design.md の該当箇所を更新する
- **完了条件**: 数値が記録され、Phase 2 の `applyImport` の構造が確定している

### TASK-1.2: 新設テーブルのスキーマ定義
- **依存**: なし（TASK-1.1 と並行可）
- **内容**: `stationGroups` / `stationAdjacencies` / `serviceRoutes` /
  `serviceRouteSegments` を `packages/database/src/schema.ts` に追加
- **期待結果**: 4テーブルが定義され、型が通る

### TASK-1.3: 既存テーブルの列追加
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
- **依存**: TASK-1.3
- **内容**: `check('published_requires_slug', sql\`published_at IS NULL OR slug IS NOT NULL\`)`
- **事前確認**: **既存481行の `slug` に NULL が無いことを SQL で確認する。**
  design.md は「`update-odpt.ts` が全件生成済み」を前提にしているが、
  TASK-3.7 のバックフィルが失敗しないことを保証するため実測する
- **期待結果**: 制約が付与される。この時点で `publishedAt` は全行 NULL のため違反は出ない

### TASK-1.4: ODPT ID 列にコメントを付与
- **依存**: TASK-1.3
- **内容**: `odptStationId` / `odptRailwayId` / `odptOperatorId` の定義に、
  **なぜ一意制約が無いか**をコメントで記述する（ADR-0007 の「影響」）
- **期待結果**: 次にスキーマへ触れる者が制約の欠落をバグと誤認しない

### TASK-1.5: マイグレーション生成と適用
- **依存**: TASK-1.3, TASK-1.4
- **内容**: `pnpm run db:generate` → 開発DBで `db:push`
- **注意**: 対話型ウィザードが出た場合は選択内容を開発者に提示して待機する

---

## Phase 2: インポート機構

### TASK-2.1: CSV パーサと型定義
- **依存**: Phase 1
- **成果物**: `apps/admin/src/features/master-import/domain/ekidataCsv.ts`
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

### TASK-2.2b: カナ→修正ヘボン式の変換器
- **依存**: なし
- **成果物**: `apps/admin/src/features/master-import/domain/romaji.ts`
- **内容**: design.md「ローマ字変換規則」の表に従う。
  決定的規則（`ヂ`/`ヅ`、促音、拗音・外来音、`ー` 削除、`ジェイアール`→`jr`）と、
  方針（長音は縮約する / 撥音は `m` 化**しない** / アポストロフィを入れない）
- **注意**: **変換元は `station_name_k`。`station_name_r` を修理する実装にしない**
- **テスト**: 上記各規則の単体ケースに加え、
  **CSV の手入力ヘボン式186件を回帰用の固定データとして持つ**。
  design.md が「原理的に決まらない」と記した形態素境界の4件
  （武雄温泉 / 嬉野温泉 / えちご押上ひすい海岸 / てだこ浦西）は
  **既知の不一致として明示的に許容する**（期待値に誤変換side を書く）

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
- **内容**: `withTransaction` での適用。TASK-1.1 の結果に応じて一括／分割を選ぶ。
  conflict target は `ekidata*Cd`

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

### TASK-3.6: `stationLines` の 1:1 制約を付与
- **依存**: TASK-3.3
- **内容**: `unique(stationId)` を追加
- **前提の再確認**: 付与直前に複数路線を持つ駅が0件であることを確認する

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

### TASK-5.2: Admin の公開操作UI（slug の確定を含む）
- **依存**: TASK-2.2b, TASK-5.0
- **対象**: `apps/admin`
- **内容**: 駅の公開・非公開を切り替えるUI。公開時に以下を行う
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
    「1駅 = 1路線」の不変条件、乗換接続の由来区分、駅名正規化ルール、
    ekidata 規約に由来する制約、**`slug` の導出規則**、
    **`nameEn` は公式表記のみで機械生成しないこと**、
    **可視性は `stations.publishedAt` が単独で担い、判定は単一の述語を通すこと**
  - `docs/domain/service-routes.md`（新規）:
    運行系統による直通運転の表現。**データ投入は後続Issue のため冒頭に適用状況を明記する**
  - `docs/domain/README.md` の一覧に2件を追加
- **確認**: 既存の `platform-coordinate-system.md` / `train-stop-patterns.md` に
  変更が要るかを確認し、**不要ならその旨を記録する**

### TASK-6.3: ADR-0007 を `Accepted` に更新
- **依存**: TASK-6.1
- **注意**: ステータス変更は**開発者の承認を得てから**行う（[ADR運用ルール](../../.claude/rules/adr.md)）

### TASK-6.4: 後続Issue の起票
- **内容**: 以下を GitHub Issue として起票する
  - 運行系統のデータ投入と Admin 管理UI（ODPT路線46件が種として使える）
  - 列単位の上書きロック（`lockedFields`）
  - `ekidataStationCd` の notNull 化（未突合ゼロ達成後）
  - `facilityConnections` の粒度見直し
  - `operators.displayPriority` の全国運用ルール

### TASK-6.5: ワークスペースの最終化
- **内容**: 一時ファイル・作業用スクリプトを削除する
