import { z } from 'zod';

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
  operatorId: z.string().uuid(),
  lineIds: z.array(z.string().uuid()),
  carCount: z.number().int().min(1),
  carStructure: z.array(carStructureItemSchema).nullable().optional(),
  freeSpaces: z.array(trainEquipmentSchema).nullable().optional(),
  prioritySeats: z.array(trainEquipmentSchema).nullable().optional(),
});

export type TrainInput = z.infer<typeof trainSchema>;
