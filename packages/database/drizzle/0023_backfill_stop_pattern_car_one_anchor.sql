-- 既存の停車位置パターンの基準点を、号車ごとの区間（train_stop_pattern_cars）から埋める（ADR-0025、#215）。
-- 向きの判定は isDoorOrderReversed()（packages/platform-diagram）と同じ:
-- 1号車と最大号車の start_meters を比べ、最大号車のほうが小さければ minusX。1両の編成は plusX。
-- 基準点は1号車の外側の端（plusX なら start_meters、minusX なら end_meters）。
-- まだ埋まっていない行だけを対象にするので、2段目で同じ文を流し直してもよい
UPDATE "train_stop_patterns" AS p
SET
  "car_numbers_ascend_toward" = CASE WHEN last_car."start_meters" < car_one."start_meters" THEN 'minusX' ELSE 'plusX' END,
  "car_one_outer_meters" = CASE WHEN last_car."start_meters" < car_one."start_meters" THEN car_one."end_meters" ELSE car_one."start_meters" END
FROM "train_stop_pattern_cars" AS car_one,
  LATERAL (
    SELECT c."start_meters"
    FROM "train_stop_pattern_cars" AS c
    WHERE c."train_stop_pattern_id" = car_one."train_stop_pattern_id"
    ORDER BY c."car_number" DESC
    LIMIT 1
  ) AS last_car
WHERE car_one."train_stop_pattern_id" = p."id"
  AND car_one."car_number" = 1
  AND p."car_one_outer_meters" IS NULL;
