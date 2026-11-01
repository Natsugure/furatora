# 設計: 使われていない DB の列をコードから外す（二段階の削除の1段目）

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 二段階の削除

CLAUDE.md の禁止事項に従い、列を読むコードが稼働したまま DROP しない。

1. **この PR**: テーブル定義（`packages/database/src/schema/`）から列を外す。Drizzle は定義にある列を全列 SELECT と INSERT に含めるので、定義から外さないと「読まないコード」にならない
2. **#217**: `pnpm run db:generate` で DROP COLUMN を作る

5列はどれも nullable（フラグは default true も付く）なので、INSERT から外しても DB 側の変更は要らない。手書きのマイグレーション（`--custom`）は作らない。

## 変更する所

| 層 | ファイル | 変更 |
|---|---|---|
| スキーマ | `packages/database/src/schema/platform.ts` | `stationFacilities` からフラグ2列と `notes` を外す |
| スキーマ | `packages/database/src/schema/stationMaster.ts` | `stations` / `lines` から `abolishedAt` を外す（参照するコードは無い） |
| DTO | `packages/platform-diagram/src/domain/types.ts` | `FacilityDTO` からフラグ2項目を外す |
| Web | `apps/web/src/external/query/stationDetailQuery.ts` | 詰め替えから外す |
| Admin 読み取り | `apps/admin/src/external/query/stationLayoutPageQuery.ts`、`features/station-layout/ports.ts` | 詰め替えと `LayoutFacilityDTO.notes` を外す |
| Admin 書き込み | `features/facility/schema.ts`、`external/repository/platformLocationRepository.ts` | zod の3項目と、既定値 true の補完を外す |
| Admin 画面 | `features/station-layout/domain/editDraft.ts`、`components/inspector/ConcourseInspector.tsx` | `FacilityDraft` を `{ typeCode }` にする。`updateCellFacility` を消す。差分判定は種類の集合だけを比べる |

## インターフェース

```ts
// features/station-layout/domain/editDraft.ts
export type FacilityDraft = { typeCode: FacilityTypeCode };

// features/facility/schema.ts（platform-locations の設備）
const facilitySchema = z.object({ typeCode: z.enum(FACILITY_TYPE_CODES) });
// z.object は知らないキーを捨てる。古い画面が isWheelchairAccessible などを送っても 400 にならない（REQ-2）
```

## 公開 API への影響

`/api/v1/stations/[id]` と `/api/v1/operators`（の lines）は行を全列で返しているので、JSON から `abolishedAt` が消える。値は常に `null` で、リポジトリ内に使っている所は無い。

## エラー

| 状況 | 応答 |
|---|---|
| 古い画面が設備のフラグ・メモを送る | 捨てて保存する（200） |
| 1段目のデプロイ中に古いコードが動く | 古いコードは列を読み書きするが、列は残っているので失敗しない |

## テスト

- `ConcourseInspector.test.tsx`: 設備を選んでも、車いす対応・ベビーカー対応・設備メモの入力欄が出ない
- `facility/schema.test.ts`: 設備の種類以外の項目を捨てる
- `editDraft.test.ts`: 追加・複製・ペイロード・表示用 DTO で、設備が `{ typeCode }` だけになる
- 型検査: 消した項目を読む所が残っていればコンパイルエラーになる

## 恒久知識の振り分け

- `docs/domain/station-master-model.md`「ルートと設備」: ホーム図の設備も種類だけを持ち、通れるかは種類から導く。対応フラグ・メモは持たない
- ADR は作らない。使っていない列を外すだけで、却下した選択肢と比べて選んだ設計ではない
