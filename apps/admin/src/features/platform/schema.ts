import { z } from 'zod';

export const platformSchema = z.object({
  platformNumber: z.string().min(1),
  lineId: z.string().uuid(),
  inboundDirectionId: z.string().uuid().nullable().optional(),
  outboundDirectionId: z.string().uuid().nullable().optional(),
  physicalLength: z.number().positive(),
  notes: z.string().nullable().optional(),
});

export type PlatformInput = z.infer<typeof platformSchema>;
