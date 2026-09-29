import { z } from 'zod';
import { DIRECTIONS } from '@/features/transfer-connection/domain/types';

export const operatorSchema = z.object({
  name: z.string().min(1),
  odptOperatorId: z.string().nullable().optional(),
  displayPriority: z.number().int().min(0).optional(),
});

export const stationUpdateSchema = z.object({
  name: z.string().min(1),
  nameKana: z.string().nullable().optional(),
  nameEn: z.string().nullable().optional(),
  odptStationId: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  lat: z.string().nullable().optional(),
  lon: z.string().nullable().optional(),
  operatorId: z.string().uuid(),
  notes: z.string().nullable().optional(),
});

export const lineUpdateSchema = z.object({
  name: z.string().min(1),
  nameKana: z.string().nullable().optional(),
  nameEn: z.string().nullable().optional(),
  odptRailwayId: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  lineCode: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  displayOrder: z.number().int().nullable().optional(),
  operatorId: z.string().uuid(),
});

export const directionSchema = z.object({
  directionType: z.enum(DIRECTIONS),
  displayName: z.string().min(1),
  // 省略時は null にして、Repository の書き込み形（LineDirectionWriteInput）をそのまま出す
  displayNameEn: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  // (路線, 走行方向) の既定行にするか（ADR-0014）。true なら、同じ組の旧既定は Repository が外す。
  // 省略を false と読むと、PUT で送り忘れたクライアントが既定行を黙って既定から外すため、必須にする
  isDefault: z.boolean(),
});
