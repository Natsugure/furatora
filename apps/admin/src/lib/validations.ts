import { z } from 'zod';

export const operatorSchema = z.object({
  name: z.string().min(1),
  odptOperatorId: z.string().nullable().optional(),
  displayPriority: z.number().int().nullable().optional(),
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
  directionType: z.enum(['inbound', 'outbound']),
  representativeStationId: z.string().uuid(),
  displayName: z.string().min(1),
  displayNameEn: z.string().nullable().optional(),
  terminalStationIds: z.array(z.string().uuid()).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const stationConnectionUpdateSchema = z.object({
  strollerDifficulty: z
    .enum(['optimal', 'elevator_detour', 'stairs_partial', 'exit_required', 'inaccessible'])
    .nullable()
    .optional(),
  wheelchairDifficulty: z
    .enum(['optimal', 'detour', 'assistance_required', 'discouraged', 'inaccessible'])
    .nullable()
    .optional(),
  notesAboutStroller: z.string().nullable().optional(),
  notesAboutWheelchair: z.string().nullable().optional(),
});
