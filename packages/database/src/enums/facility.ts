// 設備の種類のコード（キャメルケース）。設備コードの一覧の正はこの定数である（ADR-0016）。
// DB と seed はこれに従う:
//   - facility_types.code の CHECK 制約を、この定数から組み立てる（src/schema/platform.ts）
//   - seed の表示名は Record<FacilityTypeCode, string> なので、足し忘れはコンパイルエラーになる
// 定数を変えるときは、マイグレーションの順序を守ること。CHECK の作り直し（ADD CONSTRAINT）は既存の行も検査し、
// マイグレーションは番号順に流れるので、CHECK が許さない行がその時点で facility_types にあるとビルドが落ちる。
// 原則は「CHECK を広げてから行を足す。行を消してから CHECK を狭める」
// 種類を足すとき:
//   1. 定数に足して pnpm run db:generate で、CHECK を広げるマイグレーションを作る
//   2. そのあとで、facility_types への INSERT を手書きのマイグレーション（drizzle-kit generate --custom）で足す
//      （例: drizzle/0010。既存の環境には seed が届かない）。先に作ると番号が CHECK より前になり、INSERT が古い CHECK に違反する
//      忘れると、その種類を保存したときに外部キーのエラーになる
// 種類を消すとき（足すときと逆順）:
//   1. 手書きのマイグレーションで、子（transfer_route_facilities / station_facilities）の行を片付けてから facility_types の行を消す。
//      子の行を別の種類に置き換えるか消すかで判定が変わるので、データを見て決める。子が残っていると外部キーで消せない
//   2. そのあとで定数から消して pnpm run db:generate で、CHECK を狭めるマイグレーションを作る
//   二段階のデプロイは要らない。古いコードが消した種類を保存しても外部キーのエラーになり、
//   古いコードが知らない種類を読んでも isFacilityTypeCode で見分ける（下記）
// 名前を変えるときは、新しい種類を足す（INSERT のマイグレーションで子の行を新しいコードに UPDATE する）→ 古い種類を消す、の順に
// 分けて行う。一度に定数を書き換えると、生成される CHECK が新旧どちらの行とも矛盾する
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
