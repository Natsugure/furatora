# 設計: 停車位置パターンを「1号車の外側の端＋向き」で持つ (Issue #215)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md) / [ADR-0025](../adr/0025-stop-pattern-as-car-one-anchor.md)

## データモデル

`train_stop_patterns` に2列を足す（1段目は nullable）。

| 列 | 型 | 意味 |
|---|---|---|
| `car_one_outer_meters` | `decimal(6,2)` | 1号車の外側の端（隣の号車と接していない側）のホーム座標 |
| `car_numbers_ascend_toward` | `varchar(10)` `'plusX' \| 'minusX'` | 号車番号が x の増える側へ増えるか、減る側へ増えるか |

`train_stop_pattern_cars` はテーブル定義から外す（DB の表は2段目で DROP）。

## 区間の算出

`packages/platform-diagram/src/domain/carSegments.ts`（web と admin の両方が使う。ADR-0015）。

```ts
export type CarNumbersAscendToward = 'plusX' | 'minusX';
export function carSegmentsFromCarOne(
  carStructure: { carNumber: number; carLength: number | null }[],
  carOneOuterMeters: number,
  ascendToward: CarNumbersAscendToward,
): { carNumber: number; startMeters: number; endMeters: number }[];
export function standardCarStructure(carCount: number): { carNumber: number; carLength: null }[];
export function carOneAnchorOf(cars, ascendToward): number; // 区間から基準点を戻す（Admin の保存用）
```

- `plusX`: 1号車が `[X, X+len1]`、2号車がその右
- `minusX`: 1号車が `[X−len1, X]`、2号車がその左
- 各端は小数2桁に丸める（`decimal(6,2)` と、隣接号車の境界の一致を保つため）

読み取り側（Web `stationDetailQuery.ts`、Admin `stationLayoutPageQuery.ts`）は `external/query/` で区間を算出し、
DTO（`StopPatternCarDTO`）の形は変えない。描画（`packages/platform-diagram` のコンポーネント）は変わらない。

## 書き込み

- API の入力（`trainStopPatternSchema`）: `{ platformId, trainId, carOneOuterMeters, carNumbersAscendToward }`
- Repository: `train_stop_patterns` の1行だけを書く
- Admin の編集: 未保存 state（`PatternDraft`）は `{ ascendToward, cars }`。`cars` は表示用の区間で、
  平行移動（`shiftConsistByEdge`）だけが書き換える。保存時に `carOneAnchorOf` で基準点へ戻す。
  内側の境界のハンドル（`moveCarBoundary`）はなくす
- 新規作成のプレビュー（インスペクタ）: 入力は従来どおり「x=0 に近い側の端＋向き」。`carOneNearest` → `plusX`、`lastCarNearest` → `minusX`

## マイグレーション

1段目（このPR）: `drizzle-kit generate --custom` の手書き。

```sql
ALTER TABLE train_stop_patterns ADD COLUMN car_one_outer_meters numeric(6,2);
ALTER TABLE train_stop_patterns ADD COLUMN car_numbers_ascend_toward varchar(10);
-- 1号車と最大号車の startMeters の大小で向きを決める（区間から推定していた旧 isDoorOrderReversed と同じ判定。この関数はレビュー対応で消した）
UPDATE ...
```

| 状況 | 結果 |
|---|---|
| マイグレーション後、旧コードが動いている間 | 旧コードは新しい列を書かない。その間に作ったパターンは基準点が NULL になり、新コードでは表示されない（REQ-8）。2段目で旧表から埋め直す |
| 新コードが動いたあと | 旧表は読み書きされない |

2段目: NULL の行を旧表から埋め直す → 2列を `NOT NULL` → `DROP TABLE train_stop_pattern_cars`。
1段目と2段目の間は、他の作業で `db:generate` / `db:push` を流さない。

## エラー

| 状況 | 応答 |
|---|---|
| 基準点が ±9999.99 の外、向きが不正 | 400 |
| 組み合わせの重複 | 409（従来どおり） |
| 他駅のホーム | 404（従来どおり） |

## テスト

- `carSegments.test.ts`（platform-diagram）: plusX / minusX、carLength の混在、1両、丸め、`carOneAnchorOf` との往復
- `schema.test.ts`、`stopPatternRepository.test.ts`: 新しい入力
- `editDraft.test.ts`: 平行移動・ペイロード
- 照合 SQL: development で、算出した区間が旧表と全行一致する
