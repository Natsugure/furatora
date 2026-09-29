-- line_directions の代表駅・終点駅の除去の1段目（Issue #129。二段階マイグレーション）
-- schema.ts からは両列を消したが、DB の列は次のデプロイ（2段目）まで残す。旧コードは代表駅を書き続けるため、
-- 列を残したまま NOT NULL だけを外し、新コードの INSERT（列を含まない）が通るようにする。
-- drizzle-kit generate --custom で作った手書きのマイグレーションで、スナップショットは両列が残った 0015 と同じ。
-- 2段目は pnpm run db:generate が両列の DROP COLUMN を生成する。それまで他の作業で db:generate / db:push を実行しない
ALTER TABLE "line_directions" ALTER COLUMN "representative_station_id" DROP NOT NULL;
