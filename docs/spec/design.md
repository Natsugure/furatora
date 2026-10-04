# 設計: 方面ラベルの解決・接続の向きの揃え方を transfer-difficulty に集める (Issue #138)

純粋な部分をパッケージへ移し SQL を各アプリに残す判断は [ADR-0015](../adr/0015-shared-domain-packages-and-vocabulary.md) 決定2 による。
方面ラベルの解決順（①ホーム ②既定行 ③フォールバック）は [ADR-0014](../adr/0014-direction-label-by-default-row.md) と
[docs/domain/line-directions.md](../domain/line-directions.md) による。ここには実装だけを書く。

## 変更するファイル

```
packages/transfer-difficulty/src/domain/directionLabel.ts(.test.ts)   firstLineByStation / resolveStationDirectionLabels を追加
packages/transfer-difficulty/src/domain/connection.ts(.test.ts)       新規。orientConnection
packages/transfer-difficulty/src/domain/index.ts                     バレルに connection を追加
apps/admin/src/features/transfer-connection/domain/normalize.ts       comboOfConnection を orientConnection で実装
apps/admin/src/external/query/transferPairEditPageQuery.ts            firstLineOf・hints() を共有関数に置き換え
apps/web/src/features/station/domain/transferPartners.ts(.test.ts)    新規。assembleTransferPartners / facilitiesByRoute / PartnerLine
apps/web/src/external/query/transferPartnerRows.ts                    SQL を実行して assembleTransferPartners を呼ぶだけにする
apps/web/src/external/query/transferPartnerRows.test.ts               削除（transferPartners.test.ts へ移す）
apps/web/src/external/query/stationDetailQuery.ts                     PartnerLine の import 元を変える
```

## データの流れ

```
Web: stationDetailQuery
  └─ buildTransferPartners (external/query/transferPartnerRows.ts)
       ├─ SQL 5本（ルート・設備・駅の路線・ホーム・既定行）  ← 変更なし
       └─ assembleTransferPartners (features/station/domain/transferPartners.ts)  ← 純関数
            ├─ facilitiesByRoute
            ├─ orientConnection                 ─┐
            ├─ firstLineByStation                ├─ @furatora/transfer-difficulty/domain
            └─ resolveStationDirectionLabels    ─┘

Admin: transferPairEditPageQuery.getContext  ← SQL は変更なし
  ├─ firstLineByStation / resolveStationDirectionLabels
  └─ comboOfConnection (features/transfer-connection/domain/normalize.ts) → orientConnection
```

## インターフェース

### `packages/transfer-difficulty/src/domain/directionLabel.ts`

```ts
// 行は呼び出し側の SQL で lines.displayOrder, lines.id 順に並べてある前提。駅ごとに先頭を採る
export function firstLineByStation<Row extends { stationId: string; lineId: string; lineName: string }>(
  rows: readonly Row[],
): Map<string, { lineId: string; lineName: string }>;

export function resolveStationDirectionLabels(input: {
  stationId: string;
  firstLineOf: ReadonlyMap<string, { lineId: string }>;
  platformRows: readonly {
    stationId: string; lineId: string; platformNumber: string;
    inboundName: string | null; outboundName: string | null;
  }[];
  defaultRows: readonly { lineId: string; directionType: DirectionType; displayName: string }[];
}): Record<DirectionType, string>;
```

- 駅が `firstLineOf` に無いときは、ホーム・既定行を見ずに `resolveDirectionLabel` に空のホームと `null` の既定行を渡す
  （現行コードは `lineId === undefined` との比較で偶然一致しないだけだったので、明示的に分岐する）
- ホーム番号は varchar なので `localeCompare(..., 'ja', { numeric: true })` で並べる（'2' → '10'）

### `packages/transfer-difficulty/src/domain/connection.ts`

```ts
export function orientConnection(
  row: { stationAId: string; directionA: DirectionType; stationBId: string; directionB: DirectionType },
  stationId: string,
): { connectedStationId: string; stationDirection: DirectionType; connectedDirection: DirectionType };
```

- uuid は小文字で比べる（Zod の uuid は大文字も通すため）。返す ID は入力のまま
- 同一駅どうしの接続（#82 で正当になりうる）は扱わない。stationId の一致だけで A/B を決める

### `apps/web/src/features/station/domain/transferPartners.ts`

```ts
export type PartnerLine = Pick<TransferPartnerDTO, 'connectedStationId' | 'connectedStationName' | 'lineName' | 'lineColor'>;
export function facilitiesByRoute(rows: readonly { routeId: string; typeCode: string }[]): Map<string, FacilityTypeCode[]>;
export function assembleTransferPartners(input: {
  stationId: string;
  partnerLines: readonly PartnerLine[];
  connectionRows: readonly { id; stationAId; directionA; stationBId; directionB; notes }[];
  routeRows: readonly ({ connectionId: string } & Omit<TransferRouteDTO, 'facilities'>)[];
  facilityRows: readonly { routeId: string; typeCode: string }[];
  stationLineRows: readonly { stationId; lineId; lineName }[];
  platformRows: ...;   // resolveStationDirectionLabels と同じ
  defaultDirectionRows: ...;
}): TransferPartnerDTO[];
```

- 入力の行型は構造的な最小型で定義し、features から external・schema の型を import しない（ADR-0001）
- `routeRows` の並び（`label` 昇順）はそのまま接続ごとのルートの並びになる。順序を変えない
- `partnerLines` が空なら `[]`（SQL を発行しない早期 return は external 側に残す）

## エラーハンドリング

| 状況 | 振る舞い |
|---|---|
| 駅が路線を持たない | 方面ラベルはフォールバック（上り／下り）、路線名は `''`（Web）/ `null`（Admin） |
| 相手駅の接続行が無い | `combos: []`（未評価） |
| 知らない設備コードを含むルート | Web は設備を空（未入力）にする（#139 の挙動を維持）。Admin は従来どおり編集画面を止める |
| uuid の大文字小文字が食い違う | 小文字で比べて同じ駅として扱う |

## テスト戦略

- `directionLabel.test.ts`: 駅で絞る／路線で絞る／'10' と '2' の順／null の除外／既定行・フォールバック／
  駅が `firstLineOf` に無いときフォールバック／`firstLineByStation` が先頭を採る
- `connection.test.ts`: A 側／B 側／大文字 uuid の一致／返す ID は入力のまま
- `transferPartners.test.ts`: 既存の `facilitiesByRoute` 3ケースを移す。大文字小文字違いの uuid で combo が相手駅に紐づく／
  未評価の相手は combos 空／方面ラベル／ルートの label 順が保たれる／知らない設備コードのルートは設備が空
- Admin の `normalize.test.ts` は変更せずに通ること（`comboOfConnection` のシグネチャ不変）

## 恒久知識の振り分け

- `docs/domain/line-directions.md`: 実装の所在を `resolveStationDirectionLabels` / `firstLineByStation` に上書きする（フェーズ5）
- `docs/domain/station-master-model.md`: 向きの揃え方の記述は無い。未知の設備コードの Web 側の所在（ファイルパス）だけを直す
- ADR: 新規なし。ステータス変更なし
