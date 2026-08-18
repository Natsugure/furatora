import { z } from 'zod';

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

export const trainStopPatternSchema = z.object({
  platformId: z.string().uuid(),
  trainId: z.string().uuid(),
  cars: z.array(trainStopPatternCarSchema).min(1),
});

export type TrainStopPatternInput = z.infer<typeof trainStopPatternSchema>;
