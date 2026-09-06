// コンポジションルート。DIライブラリは使わず手動配線する（ADR-0002）。
import { dbPlatformRepository } from '@/external/repository/platformRepository';
import { dbPlatformLocationRepository } from '@/external/repository/platformLocationRepository';
import { dbStopPatternRepository } from '@/external/repository/stopPatternRepository';
import { dbStopPatternPageQuery } from '@/external/query/stopPatternPageQuery';
import { dbStationPublishingRepository } from '@/external/repository/stationPublishingRepository';
import { dbStationPublishingPageQuery } from '@/external/query/stationPublishingPageQuery';

export const platformRepository = dbPlatformRepository;
export const platformLocationRepository = dbPlatformLocationRepository;
export const stopPatternRepository = dbStopPatternRepository;
export const stopPatternPageQuery = dbStopPatternPageQuery;
export const stationPublishingRepository = dbStationPublishingRepository;
export const stationPublishingPageQuery = dbStationPublishingPageQuery;
