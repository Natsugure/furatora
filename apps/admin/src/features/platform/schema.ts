import { z } from 'zod';
import { uuidSchema } from '@/shared/schema/uuid';

export const platformSchema = z.object({
  platformNumber: z.string().min(1),
  lineId: uuidSchema,
  inboundDirectionId: uuidSchema.nullable().optional(),
  outboundDirectionId: uuidSchema.nullable().optional(),
  physicalLength: z.number().positive(),
  notes: z.string().nullable().optional(),
});

export type PlatformInput = z.infer<typeof platformSchema>;
