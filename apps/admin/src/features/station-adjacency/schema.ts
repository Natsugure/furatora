import { z } from 'zod';
import { uuidSchema } from '@/shared/schema/uuid';

// 路線内の隣接（stationAdjacencies）の新規作成フォームの入力（#88）。
// 端点の順序はここでは問わない（書き込み側が昇順正規化する）。
// 自己隣接だけ弾く。lineId は URL パラメータのためボディに含めない。
export const stationAdjacencyCreateSchema = z
  .object({
    stationAId: uuidSchema,
    stationBId: uuidSchema,
  })
  .refine((v) => v.stationAId !== v.stationBId, {
    message: '同じ駅どうしを隣接にはできません',
  });

export type StationAdjacencyCreateInput = z.infer<typeof stationAdjacencyCreateSchema>;
