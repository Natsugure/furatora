// 設備の種類のコード（キャメルケース）。設備コードの一覧の正はこの定数である（ADR-0016）。
// DB と seed はこれに従う:
//   - facility_types.code の CHECK 制約を、この定数から組み立てる（src/schema/platform.ts）
//   - seed の表示名は Record<FacilityTypeCode, string> なので、足し忘れはコンパイルエラーになる
// 種類を足すときは、次の2つも行うこと。
//   1. pnpm run db:generate で、CHECK 制約を作り直すマイグレーションを作る
//   2. facility_types への INSERT を手書きのマイグレーションで足す（例: drizzle/0010。既存の環境には seed が届かない）
//      忘れると、その種類を保存したときに外部キーのエラーになる
// 並び順は Admin の設備の並べ替えに使う
export const FACILITY_TYPE_CODES = [
  'sameFloor',
  'elevator',
  'ramp',
  'wheelchairEscalator',
  'escalator',
  'stairLift',
  'stairs',
] as const;

export type FacilityTypeCode = (typeof FACILITY_TYPE_CODES)[number];

// DB の値は CHECK 制約でこの定数に従うが、それは「最後にマイグレーションを流したビルドの定数」である。
// Web と Admin は別々にデプロイされるため、稼働中のコードが知らないコードを DB から読むことがある（ADR-0016「残るずれ」）。
// 読み取りの境界でこれを使って見分ける
export const isFacilityTypeCode = (code: string): code is FacilityTypeCode =>
  (FACILITY_TYPE_CODES as readonly string[]).includes(code);
