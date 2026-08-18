import type { PlatformLocationInput } from './schema';

export type PlatformLocationRecord = {
  id: string;
  platformId: string;
  exits: string | null;
  notes: string | null;
};

export interface PlatformLocationRepository {
  create(input: PlatformLocationInput): Promise<PlatformLocationRecord>;
  update(id: string, input: PlatformLocationInput): Promise<PlatformLocationRecord | null>;
  delete(id: string): Promise<boolean>;
  duplicate(id: string): Promise<PlatformLocationRecord | null>;
}
