import { z } from 'zod';
import { isDoorOrderReversed } from '@furatora/platform-diagram/domain';

const trainStopPatternCarSchema = z
  .object({
    carNumber: z.number().int().min(1),
    startMeters: z.number(),
    endMeters: z.number(),
  })
  .refine((v) => v.startMeters < v.endMeters, {
    message: '開始位置は終了位置より小さい値にしてください',
    path: ['endMeters'],
  });

// docs/domain/train-stop-patterns.md「単位と精度」の decimal(6,2) に合わせた許容誤差
const BOUNDARY_TOLERANCE_METERS = 0.01;

export const trainStopPatternSchema = z
  .object({
    platformId: z.string().uuid(),
    trainId: z.string().uuid(),
    cars: z.array(trainStopPatternCarSchema).min(1),
  })
  // 隣接号車は境界を共有する（docs/domain/train-stop-patterns.md「隣接号車は境界を
  // 共有する」）。どちらのフィールドが共有側かは編成の向きに依存するため、
  // isDoorOrderReversed() を admin の図上編集（editDraft.ts）と同じ唯一の判定源として使う。
  // 向きを考慮しない単純な end===start 比較では、反転編成を不連続と誤検出する
  // （実データの茗荷谷2番線・丸ノ内線で実際に誤検出した）。
  .superRefine((v, ctx) => {
    const sorted = [...v.cars].sort((a, b) => a.carNumber - b.carNumber);
    if (sorted.length < 2) return;
    const reversed = isDoorOrderReversed(sorted);

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      const sharesBoundary = reversed
        ? Math.abs(a.startMeters - b.endMeters) <= BOUNDARY_TOLERANCE_METERS
        : Math.abs(a.endMeters - b.startMeters) <= BOUNDARY_TOLERANCE_METERS;

      if (!sharesBoundary) {
        const indexInInput = v.cars.findIndex((c) => c.carNumber === a.carNumber);
        ctx.addIssue({
          code: 'custom',
          message: `${a.carNumber}号車と${b.carNumber}号車の間に隙間または重なりがあります（隣接号車は境界を共有する必要があります）`,
          path: ['cars', indexInInput],
        });
      }
    }
  });

export type TrainStopPatternInput = z.infer<typeof trainStopPatternSchema>;
