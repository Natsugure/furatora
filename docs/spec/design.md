# 設計: 停車位置パターンの基準点を NOT NULL にし、train_stop_pattern_cars を DROP する (Issue #224)

参照: [requirements.md](./requirements.md) / [tasks.md](./tasks.md) / [ADR-0025](../adr/0025-stop-pattern-as-car-one-anchor.md)

## マイグレーション

| ファイル | 作り方 | 内容 |
|---|---|---|
| `0024_rebackfill_stop_pattern_car_one_anchor.sql` | `drizzle-kit generate --custom` | 0023 と同じ UPDATE（`car_one_outer_meters IS NULL` の行だけ） |
| `0025_stop_pattern_anchor_not_null.sql` | `db:generate` | `DROP TABLE "train_stop_pattern_cars" CASCADE`、2列の `SET NOT NULL` |

- 0024 → 0025 の順に、Vercel のビルドの `db:migrate` が流す。埋め戻しは DROP より先に走る
- 旧表に1号車の行が無いパターンは 0024 で埋まらず、0025 の `SET NOT NULL` が失敗してビルドが止まる。
  マージ直前に本番で `SELECT id FROM train_stop_patterns WHERE car_one_outer_meters IS NULL OR car_numbers_ascend_toward IS NULL;` が 0 件であることを確かめる
- 書き込み（Admin の zod `stopPatternSchema`、`stopPatternRepository`）は1段目から2列を必ず埋めている

## 読み取り

`packages/platform-diagram/src/domain/stopPatternCars.ts`（新規、domain のバレルから export）

```ts
groupEquipmentsByTrainCar(rows: { trainId; carNumber; type: TrainEquipmentType; nearDoor; isStandard }[]): EquipmentsByTrainCar
// EquipmentsByTrainCar = { get(trainId, carNumber): { free, prio } | undefined }。キーの組み立てを外に出さない

stopPatternCarsOf(
  pattern: { trainId; carOneOuterMeters: string; carNumbersAscendToward },
  carCount, carStructure: CarStructureSpec[], equipments: EquipmentsByTrainCar,
): StopPatternCarDTO[]
```

- `resolvePatternCars()` の `PatternAnchor` を非 null にし、null を返す分岐を外す
- Web `stationDetailQuery.ts`・Admin `stationLayoutPageQuery.ts` は上の2関数を呼ぶだけにし、`if (!resolved || !ascendToward) continue;` を消す
- `type` は `TrainEquipmentType` で受ける。型を schema から `@furatora/database/enums` へ移し、domain の packages から import できるようにする（ADR-0015 決定3）。種別を増やすと振り分けの `switch` が型エラーになる

## テスト

- `carSegments.test.ts`: null を受けないことを `@ts-expect-error` で確かめる（呼び出さない）
- `stopPatternCars.test.ts`: string の基準点からの算出、設備の振り分け、他の列車の設備を添えないこと
- DB に触れるクエリは単体テストの仕組みが無いため、型チェックとブラウザ確認で代える

## 恒久知識の振り分け

- `docs/domain/train-stop-patterns.md`: 適用状況の注記を外し、2列が NOT NULL であることと `stopPatternCarsOf()` を書く
- `packages/database/CLAUDE.md`: 既知の誤検出の外部キーから旧表の分を外す
- ADR: 新しい決定は無い（ADR-0025 は Accepted のまま）
