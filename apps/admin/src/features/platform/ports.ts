import type { PlatformInput } from './schema';

export type PlatformRecord = {
  id: string;
  stationId: string;
  platformNumber: string;
  lineId: string;
  inboundDirectionId: string | null;
  outboundDirectionId: string | null;
  physicalLength: string;
  platformSide: string | null;
  notes: string | null;
};

export interface PlatformRepository {
  create(stationId: string, input: PlatformInput): Promise<PlatformRecord>;
  update(id: string, stationId: string, input: PlatformInput): Promise<PlatformRecord | null>;
  delete(id: string, stationId: string): Promise<boolean>;
}
