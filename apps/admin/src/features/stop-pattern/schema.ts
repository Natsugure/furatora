import { z } from 'zod';
import { CAR_NUMBERS_ASCEND_TOWARD } from '@furatora/database/enums';
import { uuidSchema } from '@/shared/schema/uuid';

// docs/domain/platform-coordinate-system.md「単位と精度」の decimal(6,2) に入る絶対値の上限。
// 超えた値は保存時に DB の numeric field overflow になるため、ここで弾く
export const STOP_METERS_LIMIT = 9999.99;

const stopMetersSchema = z
  .number()
  .min(-STOP_METERS_LIMIT, { message: `位置は${-STOP_METERS_LIMIT}m以上にしてください` })
  .max(STOP_METERS_LIMIT, { message: `位置は${STOP_METERS_LIMIT}m以下にしてください` });

// 停車位置は「1号車の外側の端」と「号車番号の向き」だけで持つ（ADR-0025）。
// 号車の区間は列車の号車構成から算出するので受け取らない。strict にして、
// 旧い形（cars）の入力を黙って捨てずに 400 にする
export const trainStopPatternSchema = z
  .object({
    platformId: uuidSchema,
    trainId: uuidSchema,
    carOneOuterMeters: stopMetersSchema,
    carNumbersAscendToward: z.enum(CAR_NUMBERS_ASCEND_TOWARD),
  })
  .strict();

export type TrainStopPatternInput = z.infer<typeof trainStopPatternSchema>;
