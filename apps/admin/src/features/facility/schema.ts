import { z } from 'zod';

const facilitySchema = z.object({
  typeCode: z.string().min(1),
  isWheelchairAccessible: z.boolean().optional(),
  isStrollerAccessible: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

// ホーム端（x=0）からのメートル位置。null = コンコース全体
const cellSchema = z.object({
  xPositionMeters: z.number().nullable().optional(),
  facilities: z.array(facilitySchema).min(1),
});

const connectionSchema = z
  .object({
    stationId: z.string().uuid(),
    connectedPlatformId: z.string().uuid().nullable().optional(),
    directionId: z.string().uuid().nullable().optional(),
    exitLabel: z.string().nullable().optional(),
    // 対面乗り換え帯（自ホーム座標系）。connectedPlatformId 指定時のみ意味を持つ
    xRangeStart: z.number().nullable().optional(),
    xRangeEnd: z.number().nullable().optional(),
  })
  .refine(
    (v) => v.xRangeStart == null || v.xRangeEnd == null || v.xRangeStart < v.xRangeEnd,
    { message: '開始位置は終了位置より小さい値にしてください', path: ['xRangeEnd'] }
  );

export const platformLocationSchema = z.object({
  platformId: z.string().uuid(),
  exits: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cells: z.array(cellSchema).min(1),
  connections: z.array(connectionSchema).optional(),
});

export type PlatformLocationInput = z.infer<typeof platformLocationSchema>;
