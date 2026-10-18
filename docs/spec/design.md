# 設計: admin の API GET を整理し、残る1本を Query Service 化する (Issue #48)

読みを Query Service、書きを Repository にする方針は [ADR-0003](../adr/0003-read-write-separation.md) による。
ここには実装だけを書く。

## 変更するファイル

```
apps/admin/src/features/train/ports.ts                                    TrainDTO を切り出し、TrainEditPageQuery に getTrain を足す
apps/admin/src/external/query/trainEditPageQuery.ts                       列車1件の読み取りを getTrain に切り出し、getEditContext から使う
apps/admin/src/app/api/trains/[trainId]/route.ts                          GET を trainEditPageQuery.getTrain に置き換える
apps/admin/src/components/DuplicateButton.tsx                             GET のレスポンスを TrainDTO として読む（operatorId / lineIds）
apps/admin/src/app/api/stations/[stationId]/platform-locations/route.ts   GET を削除
apps/admin/src/app/api/stations/[stationId]/train-stop-patterns/route.ts  GET を削除
apps/admin/src/app/api/stations/[stationId]/platforms/[platformId]/route.ts GET を削除
apps/admin/src/app/api/trains/route.ts                                    GET を削除
apps/admin/eslint.config.mjs                                              db を import しなくなった station 系 route 3本を除外から外す
```

## インターフェース

```ts
// features/train/ports.ts
export type TrainDTO = {
  id: string;
  name: string;
  operatorId: string;
  lineIds: string[];
  carCount: number;
  carStructure: TrainCarStructureDTO[] | null;
  freeSpaces: TrainEquipmentDTO[];
  prioritySeats: TrainEquipmentDTO[];
};

export interface TrainEditPageQuery {
  getCreateContext(): Promise<TrainEditContext>;
  getEditContext(trainId: string): Promise<TrainEditContext | null>;
  getTrain(trainId: string): Promise<TrainDTO | null>;
}
```

## 設計上の判断

- 呼び出し元の無い GET は、Query Service に移さず削除する。読まれないコードを増やさないため（#90 と同じ扱い）
- 複製用に新しい Query Service は作らない。複製が要るのは編集ページと同じ列車 DTO なので、`TrainEditPageQuery` に
  `getTrain` を足し、`getEditContext` もそれを使う。整形（`carLength` の数値化など）が1か所に揃う
- `PUT /api/trains/[trainId]` のレスポンス整形（`shapeTrainWithEquipments`）は残す。書き込みは範囲外で、
  `TrainForm` は `res.ok` しか見ない
- `trains/route.ts` と `trains/[trainId]/route.ts` は書き込みが db を直接使うため、ESLint の除外に残す

## エラーマトリックス

| 状況 | 結果 |
|---|---|
| `GET /api/trains/[trainId]` で列車が無い | 404 |
| `GET /api/trains/[trainId]` で DB エラー | 500 |
| 複製で GET が失敗 | モーダルに「列車データの取得に失敗しました」（従来どおり） |
| 削除した GET を呼ぶ | 405（Next.js が返す。呼び出し元は無い） |

## テスト戦略

- `app/api/trains/[trainId]/route.test.ts`: `@/di` をモックし、200 / 404 / 500 を確かめる
- `components/DuplicateButton.test.tsx`: GET のレスポンスの `operatorId` / `lineIds` / 数値の `carLength` が POST の body に入ることを確かめる
- 削除した GET は、grep で呼び出し元が無いことを確かめる
