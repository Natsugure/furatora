// コンポジションルート。DIライブラリは使わず手動配線する（ADR-0002）。
import { dbPlatformRepository } from '@/external/repository/platformRepository';
import { dbPlatformLocationRepository } from '@/external/repository/platformLocationRepository';
import { dbStopPatternRepository } from '@/external/repository/stopPatternRepository';

export const platformRepository = dbPlatformRepository;
export const platformLocationRepository = dbPlatformLocationRepository;
export const stopPatternRepository = dbStopPatternRepository;
