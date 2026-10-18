# 設計: admin の API GET を整理し、残る1本を Query Service 化する (Issue #48)

読みを Query Service、書きを Repository にする方針は [ADR-0003](../adr/0003-read-write-separation.md) による。
ここには実装だけを書く。

## 変更するファイル

```
apps/admin/src/features/train/ports.ts                                    TrainDTO を切り出し、TrainEditPageQuery に getTrain を足す
apps/admin/src/external/query/trainEditPageQuery.ts                       列車1件の読み取りを getTrain に切り出し、getEditContext から使う。号車・設備に並び順をつけ、3クエリを並列にする
apps/admin/src/app/api/trains/[trainId]/route.ts                          GET を trainEditPageQuery.getTrain に置き換える。PUT は読み直さず { success: true } を返す
apps/admin/src/components/DuplicateButton.tsx                             GET のレスポンスを TrainDTO として読む（operatorId / lineIds）。通信の失敗を捕まえる
apps/admin/src/features/train/components/TrainForm.tsx                    保存の通信の失敗を捕まえる
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
- `PUT /api/trains/[trainId]` は書き込み後に列車を読み直さず、`{ success: true }` を返す（DELETE と同じ形）。
  唯一の呼び出し元 `TrainForm` は `res.ok` しか見ない。読み直すと、その間に削除されたとき本文 null の 200 になり、
  読み直しが失敗したときは書き込み済みなのに 500 になる
- `getTrain` は号車構成を `carNumber`、設備を `carNumber, nearDoor` の順で返す。`TrainForm` は配列の順に描画し、
  PostgreSQL は ORDER BY が無いと順序を保証しない
- `getTrain` は trains・設備・号車構成の3クエリを並列に読み、その後に列車の有無を見る。`neon-http` は await 1回が
  HTTP 1往復になるため、直列だと2往復かかる
- `getEditContext` は `getTrain` と選択肢2本を並列に読む。列車が無い（404）ときも選択肢を読むが、
  早期 return にすると正常時が2往復に戻るため、まれな 404 の無駄を許す
- `trains/route.ts` と `trains/[trainId]/route.ts` は書き込みが db を直接使うため、ESLint の除外に残す

## エラーマトリックス

| 状況 | 結果 |
|---|---|
| `GET /api/trains/[trainId]` で列車が無い | 404 |
| `GET /api/trains/[trainId]` で DB エラー | 500 |
| 複製で GET が失敗 | モーダルに「列車データの取得に失敗しました」（従来どおり） |
| 複製で fetch / `res.json()` が reject | モーダルに「複製に失敗しました」。複製ボタンは loading から戻る |
| `PUT /api/trains/[trainId]` で列車が無い | 404。号車構成・設備には触れない |
| 列車の保存（`TrainForm`）で fetch が reject | `alert('保存に失敗しました')`。更新ボタンは送信中から戻る（応答が ok でないときと同じ） |
| 削除した GET を呼ぶ | 405（Next.js が返す。呼び出し元は無い） |

## テスト戦略

- `app/api/trains/[trainId]/route.test.ts`: `@/di` をモックし、200 / 404 / 500 を確かめる
- `app/api/trains/[trainId]/route.test.ts`（PUT）: db を `vi.hoisted` でモックし、`{ success: true }` を返して `getTrain` を呼ばないこと、
  列車が無ければ 404 で号車構成・設備に触れないことを確かめる
- `components/DuplicateButton.test.tsx`: GET のレスポンスの `operatorId` / `lineIds` / 数値の `carLength` が POST の body に入ることと、
  fetch が reject してもエラーを出してボタンが押せる状態に戻ることを確かめる
- `features/train/components/TrainForm.test.tsx`: 保存できたら一覧へ戻ること、fetch が reject してもエラーを出して
  ボタンが押せる状態に戻ることを確かめる（MultiSelect が使う `ResizeObserver` はテスト内で差し替える）
- `getTrain` の並び順・並列化は DB を伴うため、dev で全列車を GET して確かめる
- 削除した GET は、grep で呼び出し元が無いことを確かめる
