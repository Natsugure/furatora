# 設計: 乗換難易度 新モデルのスキーマ実装 (Issue #122)

## 参照

[requirements.md](./requirements.md) / [tasks.md](./tasks.md) /
ドメイン定義: Issue #30 の設計（commit 3c2fa0c 時点の `docs/spec/design.md`。決定1〜12）/
[ADR-0005](../adr/0005-write-atomicity-driver.md)（複数文の書き込みは Repository と
`withTransaction`）/ [ADR-0008](../adr/0008-environment-database-branch-mapping.md)

本Issueはスキーマの追加のみ。ドメイン定義そのもの（4層構造・不変条件・決定記録）は
#30 で確定済みで、恒久知識としてフェーズ5で `docs/domain/station-master-model.md` へ移す。
本書には**この作業限りの実装判断**だけを置く。

## アーキテクチャ

```
station_connections（既存・変更しない）        新規（本Issue）
  乗換できる相手駅の一覧（有向2行）              transfer_connections   接続（無向1行・駅×方面）
  + 難易度4列（#125 のあとに DROP）                 └─ connection_routes  接続×ルート（label, isBaseline）
                                                        └─ transfer_routes  ルート（minutes, 4フラグ）
                                                             └─ transfer_route_facilities  設備（seq, typeCode）
                                                                     └→ facility_types.code
```

旧表と新表は独立で、FK で結ばない。旧表は方面を持たない有向2行のため、
新表の端点（駅×方面）と対応する外部キーを張れない。

## データモデル

### `transfer_connections`

| 列 | 型 | 備考 |
|---|---|---|
| `id` | uuid pk | `uuid_generate_v7()` |
| `station_a_id` / `station_b_id` | uuid → stations, not null | |
| `direction_a` / `direction_b` | varchar(20) not null | `DirectionType` |
| `notes` | text | |
| `source` | varchar(20) | `StationConnectionSource` |
| `created_at` / `updated_at` | timestamp | |

制約: `unique (station_a_id, direction_a, station_b_id, direction_b)` /
`check ((station_a_id, direction_a) < (station_b_id, direction_b))`

### `transfer_routes`

`id` / `minutes smallint`（nullable）/ `is_outdoor` `requires_exit_gate` `requires_staff`
`is_officially_guided`（boolean not null default false）/ `notes` / `created_at` / `updated_at`

### `connection_routes`

`id` / `connection_id → transfer_connections`（cascade）/ `route_id → transfer_routes`（cascade）/
`label varchar(100) not null` / `is_baseline boolean not null default false` / `created_at`

制約: `unique (connection_id, label)` / `unique (connection_id, route_id)` /
`unique index (connection_id) where is_baseline`

### `transfer_route_facilities`

`id` / `route_id → transfer_routes`（cascade）/ `seq smallint not null` /
`type_code varchar → facility_types.code not null`

制約: `unique (route_id, seq)`

## エラーマトリックス

| 操作 | 結果 | 拒否する制約 |
|---|---|---|
| 同じ端点対を再挿入 | 拒否 | `unique_transfer_connection` |
| 逆順の端点で挿入（A > B） | 拒否 | `transfer_connection_endpoints_ordered` |
| 両端点が同一の行を挿入 | 拒否 | 同上（`<` は等値で偽） |
| 接続に2本目の `is_baseline` を結ぶ | 拒否 | `unique_connection_baseline` |
| 同一接続で同じ `label` を結ぶ | 拒否 | `unique_connection_route_label` |
| 同じルートを同じ接続に2回結ぶ | 拒否 | `unique_connection_route` |
| 同じルートに同じ `seq` の設備 | 拒否 | `unique_transfer_route_facility_seq` |
| 未定義の `type_code` | 拒否 | FK → `facility_types` |
| 接続を削除 | 紐付けは cascade。**ルート行は残る** | — |
| 設備の並びと4フラグが既存ルートと一致するルート | **DBは拒否しない** | アプリ層（#124, REQ-23） |

## ユニットテスト戦略

- 正規化関数: `normalize.test.ts`（vitest）。昇順/逆順/対称性/同一駅で方面違い/
  完全な等値/`stationId` の大文字小文字。
- DB制約は生成SQLの目視確認と、開発者による `BEGIN; … ROLLBACK;` の動作確認SQLで検証する
  （制約を自動テストで検証するための DB が CI に無いため）。

## 決定記録（この作業限りの判断）

いずれも既存ADRに反せず、覆すときに明示的な意思決定を要するアーキテクチャ決定ではないため、
ADR にしない。

### 決定1 — 既存 `station_connections` を改修せず、新テーブルを追加する

**決定**: 評価は新テーブル4つで持ち、`station_connections` は接続一覧（トポロジ）として残す。

**コンテキスト**: 旧表は有向2行（6,950行）・方面なしで、Admin（Repository・駅編集・設備編集・
レイアウト）と Web（駅詳細）が接続一覧と難易度の両方を読んでいる。新モデルは無向1行・
方面必須で行の意味が異なる。

**オプション**:
- (a) 新テーブルを追加（採用）— 追加のみで非破壊。#123 が移すのは評価済み16行だけ。
  未評価は「新表に行が無い」で表せる（#30 REQ-4）。
- (b) 旧表を改修して無向化・方面展開 — 却下。約3,475組×最大4方面（約13,900行）の
  未評価行が必要になり、「行が無い＝未評価」と食い違う。接続一覧を読む4か所も同時に
  書き換える必要がある。

**影響**: 旧表と新表の整合（旧表の接続を削除したとき評価をどうするか）はDB制約で
縛れず、#124 の Repository が担う。

**レビュー**: #124 着手時。

### 決定2 — 設備コードはキャメルケースの `wheelchairEscalator`

**決定**: `facility_types` に `wheelchairEscalator` を追加する。#30 の spec の
`wheelchair_escalator` などスネークケース表記は概念名として扱う。

**コンテキスト**: Neon main 実測で `facility_types.code` は `sameFloor` / `stairLift` の
キャメルケースで、`station_facilities` に `sameFloor` が3件ある。設備は
`facility_types.code` を外部キー参照する。

**オプション**: (a) `wheelchairEscalator`（採用・開発者確認済み）/
(b) `wheelchair_escalator` — 却下、既存6値と表記が揃わない /
(c) 全コードをスネークケースに統一 — 却下、`station_facilities` のデータ更新と
参照コード修正が必要でスコープが広がる。

### 決定3 — 端点の順序をCHECKでもDBに守らせる

**決定**: `transfer_connections` に
`check ((station_a_id, direction_a) < (station_b_id, direction_b))` を付ける（開発者確認済み）。

**コンテキスト**: `station_adjacencies` は正規化をアプリ層だけで守る。逆向きの行は
一意制約をすり抜けて重複する。新表は一意制約が方面を含む4列に依存し、
逆向きの行がより気付きにくい。

**オプション**: (a) CHECKを付ける（採用）/ (b) 付けない（`station_adjacencies` と同じ）—
却下、正規化の通し忘れをDBが止められない。

**影響**: 正規化関数の順序を DB と一致させる必要がある。PostgreSQL の uuid 比較は
バイト順で、小文字16進の文字列順と一致する。`'inbound' < 'outbound'` は照合順序に依らない。
`station_a_id <> station_b_id` は付けない（#82 後は同一駅・方面違いが正当になる）。

### 決定4 — `minutes` は nullable、フラグは not null default false

**決定**: 所要時分が分からないルートを許容する。フラグは未入力を表さず、
false を既定とする。

**コンテキスト**: #30 決定10のレビュー事項（基準ルートの所要時分が不明な接続が多い場合の
運用）。迂回度は `minutes` が揃うときだけ導出する（#125）。

### 決定5 — 接続を消してもルート行は自動で消さない

**決定**: `connection_routes` は接続の削除で cascade するが、`transfer_routes` は
他の接続から共有されうるため DB では消さない。孤立ルートの掃除は #124 の Repository が行う。

**オプション**: トリガーで参照0のルートを消す — 却下。トリガーは Drizzle のスキーマで
表現できず、ADR-0005 の方針（複数文の書き込みは Repository）にも合わない。

## フェーズ5で `docs/domain/` へ移す内容

`docs/spec/` は次のIssueで全面書き換えされる。#30 の「この定義の引き継ぎ先」を、
ここに転記して確定させる。反映先は `docs/domain/station-master-model.md`
「乗換接続（`stationConnections`）」節。実装後の姿を上書きで書く。

- 4層構造（接続 → 接続とルートの紐付け → ルート → 設備）と、ペルソナが層でないこと。
  ルートは接続に従属せず `connection_routes` で多対多に結ばれること
- 評価の単位が方面×方面。方面の値域は `direction_type`（`'inbound' | 'outbound'`）で
  `line_directions.id` ではない。両端点とも必須。優先順位規則もタイブレークも無く、
  完全一致の1行を引くだけで解決すること
- 全方面共通の表現は、方面の組み合わせ分の接続が同一のルートを共有すること
- `label` と `isBaseline` は `transfer_routes` ではなく `connection_routes` に属すること
- 無向1行への正規化と、読み取り側が両方向を見る必要があること
- 不変条件の表（部分ユニーク・`unique (connectionId, label)`・`unique (routeId, seq)`・
  端点の CHECK・アプリ層で守るもの）。`NULLS NOT DISTINCT` は不要であること
- 設備の並びは直列のみで、同じ段差の代替手段は別ルートであること
- 「通れる」と「バリアフリーで通れる」が別の述語であること
- `source` 由来の記述は維持。「難易度・備考は両方向に同じ値が入る」の記述は削除して書き換える
- 備考の役割（モデルが構造的に表現しない次元の受け皿。経路上の選好は書かない）
- `direction_type` は乗換単位（ホーム）を一意に決めないこと。中野坂上型は
  [#128](https://github.com/Natsugure/furatora/issues/128) を前提とした既知の制約
- 旧 `station_connections` は接続一覧として残り、評価は新表が担うこと（本Issueの決定1）
- 適用状況の注記: スキーマのみ存在し、現行の読み書きは旧表。#123〜#125 で移行する
- 用語: `stationGroups` の「乗換単位」（物理駅）と、ここでの乗換単位（ホーム）を区別して書く

## 先送りした将来作業

- [#123](https://github.com/Natsugure/furatora/issues/123) データ移行 →
  [#124](https://github.com/Natsugure/furatora/issues/124) Admin入力 →
  [#125](https://github.com/Natsugure/furatora/issues/125) Web表示
- [#82](https://github.com/Natsugure/furatora/issues/82) 物理駅粒度への統合
- [#128](https://github.com/Natsugure/furatora/issues/128) 中野坂上型
- [#96](https://github.com/Natsugure/furatora/issues/96) `stationGroups` の新規作成手段
  （本Issueとは独立。用語の衝突のみ注意）
