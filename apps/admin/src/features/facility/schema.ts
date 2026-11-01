import { z } from 'zod';
import { uuidSchema } from '@/shared/schema/uuid';
import { FACILITY_TYPE_CODES } from '@furatora/database/enums';

const facilitySchema = z.object({
  // 定数に無いコードは facility_types の外部キーで落ちる前に 400 で弾く（ADR-0016）
  typeCode: z.enum(FACILITY_TYPE_CODES),
  // 設備は種類だけを持つ。ベビーカー・車いすで通れるかは種類から導く（transfer-difficulty の requirement.ts）
});

// ホーム端（x=0）からのメートル位置。null = コンコース全体
const cellSchema = z.object({
  xPositionMeters: z.number().nullable().optional(),
  facilities: z.array(facilitySchema).min(1),
});

const connectionSchema = z
  .object({
    stationId: uuidSchema,
    connectedPlatformId: uuidSchema.nullable().optional(),
    directionId: uuidSchema.nullable().optional(),
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
  platformId: uuidSchema,
  exits: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cells: z.array(cellSchema).min(1),
  connections: z.array(connectionSchema).optional(),
});

export type PlatformLocationInput = z.infer<typeof platformLocationSchema>;
