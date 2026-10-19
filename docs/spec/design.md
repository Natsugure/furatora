# 設計: 駅から乗り換えられる路線を導くドメインの関数を作る (Issue #172)

出どころの決定と却下案は [ADR-0021](../adr/0021-transfer-lines-from-station-connections.md) による。ここには変更点だけを書く。

## データの流れ

```
stationDetailQuery
  ├─ stationLines ⋈ lines（自駅の全路線。displayOrder, name 順）──┐→ DTO.stationLines（先頭の色 → headerLineColor）
  └─ stationConnections ⋈ stations ⋈ stationLines ⋈ lines（既存）→ DTO.transferPartners
                                                                    │
page.tsx: reachableLines(station.name, stationLines, transferPartners) → ReachableLines → <StationLines>
```

## インターフェース

### DTO（`apps/web/src/features/station/domain/types.ts`）

```ts
export type StationDetailDTO = {
  // …既存
  /** 自駅の路線（stationLines）。ホームの有無に依存しない */
  stationLines: { lineName: string; lineColor: string | null }[];
};
```

### ドメインの関数（`apps/web/src/features/station/domain/reachableLines.ts`）

```ts
export type LineRef = { lineName: string; lineColor: string | null };
export type ReachableLines = {
  /** この駅名で乗れる路線（自駅 + 同じ駅名の乗換先） */
  here: LineRef[];
  /** 別の駅名の乗換先。駅名ごと */
  transfers: { stationName: string; lines: LineRef[] }[];
};
export function reachableLines(
  stationName: string,
  ownLines: LineRef[],
  partners: (LineRef & { connectedStationName: string })[],
): ReachableLines;
```

規則:

- `here` = 自駅の路線 → `connectedStationName === stationName` の乗換先の路線、の順
- `transfers` = それ以外の乗換先。駅名は最初に出た順。空の駅名グループは作らない
- 路線名で重複を除く。最初に出た位置を残す（`here` が先なので、`here` に出た路線は `transfers` に出ない）

`partners` には `TransferPartnerDTO[]` をそのまま渡せる（構造的部分型）。

### 表示（`apps/web/src/components/StationLines.tsx`）

```tsx
export function StationLines({ lines }: { lines: ReachableLines }): JSX.Element | null
```

- `here`: `aria-label="路線"` の `ul` にチップで並べる（チップの見た目は #166 のものを流用）
- `transfers` が1件以上: 小見出し「乗り換え」の下に、駅名ごとに「駅名 + チップの `ul`」を1行ずつ
- 両方とも空なら `null`
- 件数の上限なし（`flex-wrap`）

## 変更するファイル

| ファイル | 変更 |
|---|---|
| `features/station/domain/reachableLines.ts`・`.test.ts` | 新規 |
| `components/StationLines.tsx`・`.test.tsx` | 新規 |
| `features/station/domain/types.ts` | `StationDetailDTO.stationLines` を足す |
| `external/query/stationDetailQuery.ts` | 自駅の路線を `.limit(1)` から全件に。`stationLines` を DTO に載せる |
| `app/stations/[slug]/page.tsx` | `stationLineChips` を `reachableLines` + `StationLines` に置き換える |
| `features/station/domain/stationLineChips.ts`・`.test.ts` | 削除 |
| `features/station/usecases/getStationDetail.test.ts` | フィクスチャに `stationLines` を足す |

## エラーハンドリング

| 状況 | 応答 |
|---|---|
| 自駅の路線が0件 | `stationLines: []`、`headerLineColor: null`（今と同じ） |
| 乗換先の相手駅が未公開 | 今と同じく出す（リンクを作らないため。`docs/domain/station-visibility.md`） |
| 路線色が null | `railLineColor` の既定色 |

## テスト戦略（TDD）

- `reachableLines`: 純関数。vitest で Red → Green を1ケースずつ
- `StationLines`: Testing Library（`TransferDifficultySection.test.tsx` に倣う）
- `stationDetailQuery.ts` の SQL: **単体テストの例外。** DB に依存し、既存のクエリにもテストの仕組みが無い。
  型チェックとブラウザでの確認（春日・淡路町・渋谷）で代える

## 恒久知識の振り分け

| 内容 | 置き場 |
|---|---|
| 乗換は乗換接続から導き、乗換単位を使わない（却下案つき） | ADR-0021 |
| 乗換単位は推移的でない乗換関係を表せない。「どの駅か」を表す単位である | `docs/domain/station-master-model.md`「コード体系」（フェーズ5） |
| Web の乗り換えられる路線は乗換接続から導く（`reachableLines`） | `docs/domain/station-master-model.md`「乗換接続」（フェーズ5） |
| 型・並び・重複除去の規則 | この design.md（コードのコメントにも置く） |
