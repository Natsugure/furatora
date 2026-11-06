// 停車位置パターンの号車番号の向き（ADR-0025）。
// 'plusX' = 号車番号が x の増える側へ増える（1号車が x の小さい側）、'minusX' = その逆。
// train_stop_patterns.car_numbers_ascend_toward の CHECK 制約はこの一覧から作る
export const CAR_NUMBERS_ASCEND_TOWARD = ['plusX', 'minusX'] as const;

export type CarNumbersAscendToward = (typeof CAR_NUMBERS_ASCEND_TOWARD)[number];
