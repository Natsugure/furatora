import { z } from 'zod';

export const operatorSchema = z.object({
  name: z.string().min(1),
  odptOperatorId: z.string().nullable().optional(),
  displayPriority: z.number().int().nullable().optional(),
});

const trainEquipmentSchema = z.object({
  carNumber: z.number().int().min(1),
  nearDoor: z.number().int(),
  isStandard: z.boolean(),
});

const carStructureItemSchema = z.object({
  carNumber: z.number().int(),
  doorCount: z.number().int(),
});

export const trainSchema = z.object({
  name: z.string().min(1),
  operatorId: z.string().uuid(),
  lineIds: z.array(z.string().uuid()),
  carCount: z.number().int().min(1),
  carStructure: z.array(carStructureItemSchema).nullable().optional(),
  limitedToPlatformIds: z.array(z.string().uuid()).nullable().optional(),
  freeSpaces: z.array(trainEquipmentSchema).nullable().optional(),
  prioritySeats: z.array(trainEquipmentSchema).nullable().optional(),
});

export const stationUpdateSchema = z.object({
  nameKana: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const carStopPositionSchema = z.object({
  carCount: z.number().int().min(1),
  referenceCarNumber: z.number().int().min(1),
  referencePlatformCell: z.number().int(),
  direction: z.enum(['ascending', 'descending']),
});

export const platformSchema = z.object({
  platformNumber: z.string().min(1),
  lineId: z.string().uuid(),
  inboundDirectionId: z.string().uuid().nullable().optional(),
  outboundDirectionId: z.string().uuid().nullable().optional(),
  maxCarCount: z.number().int().min(1),
  platformSide: z.enum(['top', 'bottom']).nullable().optional(),
  notes: z.string().nullable().optional(),
  carStopPositions: z.array(carStopPositionSchema).nullable().optional(),
});

const facilitySchema = z.object({
  typeCode: z.string().min(1),
  isWheelchairAccessible: z.boolean().optional(),
  isStrollerAccessible: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

const connectionSchema = z.object({
  stationId: z.string().uuid(),
  exitLabel: z.string().nullable().optional(),
});

export const platformLocationSchema = z.object({
  platformId: z.string().uuid(),
  nearPlatformCell: z.number().int().nullable().optional(),
  exits: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  facilities: z.array(facilitySchema).optional(),
  connections: z.array(connectionSchema).optional(),
});

export const lineUpdateSchema = z.object({
  nameKana: z.string().nullable().optional(),
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

export const unresolvedRailwaySchema = z.object({
  odptRailwayId: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().nullable().optional(),
  operatorId: z.string().uuid(),
  lineCode: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

export const unresolvedStationSchema = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('create'),
      odptStationId: z.string().min(1),
      name: z.string().min(1),
      nameEn: z.string().nullable().optional(),
      code: z.string().nullable().optional(),
      operatorId: z.string().uuid(),
    }),
    z.object({
      action: z.literal('link'),
      odptStationId: z.string().min(1),
      stationId: z.string().uuid(),
    }),
  ]);
