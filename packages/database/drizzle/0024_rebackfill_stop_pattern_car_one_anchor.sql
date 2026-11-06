-- 二段階の移行の2段目（#224）。0023 と同じ埋め戻しを流し直す。
-- 1段目のデプロイ中（0023 が走ってから新コードに切り替わるまで）に旧コードが作った行は、
-- 基準点が NULL のまま旧表 train_stop_pattern_cars にだけ号車の区間を持つ。
-- このあとの 0025 で2列を NOT NULL にし旧表を DROP するので、その前に旧表から埋める。
-- 文は 0023 と同じ（まだ埋まっていない行だけが対象なので、流し直してよい）。
-- 旧表に1号車の行が無いパターンはここで埋まらず、0025 の SET NOT NULL が失敗する。
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
