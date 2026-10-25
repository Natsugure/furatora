import { z } from 'zod';
import { uuidSchema } from '@/shared/schema/uuid';
import { equipmentDoorIssues } from '@/features/train/domain/equipmentDoors';

const trainEquipmentSchema = z.object({
  carNumber: z.number().int().min(1),
  nearDoor: z.number().int(),
  isStandard: z.boolean(),
});

const carStructureItemSchema = z.object({
  carNumber: z.number().int(),
  doorCount: z.number().int(),
  // メートル。未指定時はアプリ側で標準値（20.0m）を使う
  carLength: z.number().positive().nullable().optional(),
});

export const trainSchema = z.object({
  name: z.string().min(1),
  operatorId: uuidSchema,
  lineIds: z.array(uuidSchema),
  carCount: z.number().int().min(1),
  carStructure: z.array(carStructureItemSchema).nullable().optional(),
  freeSpaces: z.array(trainEquipmentSchema).nullable().optional(),
  prioritySeats: z.array(trainEquipmentSchema).nullable().optional(),
}).superRefine((v, ctx) => {
  // 設備のドア番号はその号車のドア数の範囲内（#194）。範囲の判定は TrainForm と共有する
  for (const key of ['freeSpaces', 'prioritySeats'] as const) {
    for (const issue of equipmentDoorIssues(v.carStructure, v[key] ?? [])) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: [key, issue.index, issue.field] });
    }
  }
});

export type TrainInput = z.infer<typeof trainSchema>;
