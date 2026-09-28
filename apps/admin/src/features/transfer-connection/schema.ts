import { z } from 'zod';
import { FACILITY_TYPE_CODES } from '@furatora/transfer-difficulty/domain';
import { COMBO_KEYS } from './domain/types';

// PUT …/transfer の本文。形だけを見る（400）。label の空・重複・基準ルートの2本などの
// 意味の検証（422）は domain/validate.ts の validateSaveInput が担う（クライアントと共通）。
export const pairSaveInputSchema = z.object({
  routes: z.array(
    z.object({
      routeId: z.string().uuid().nullable(),
      label: z.string(),
      isBaseline: z.boolean(),
      minutes: z.number().nullable(),
      isOutdoor: z.boolean(),
      requiresExitGate: z.boolean(),
      requiresStaff: z.boolean(),
      isOfficiallyGuided: z.boolean(),
      notes: z.string().nullable(),
      facilities: z.array(z.enum(FACILITY_TYPE_CODES)),
      combos: z.array(z.enum(COMBO_KEYS)),
    }),
  ),
  connectionNotes: z.partialRecord(z.enum(COMBO_KEYS), z.string().nullable()),
});
