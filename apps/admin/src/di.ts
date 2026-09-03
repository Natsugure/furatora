// コンポジションルート。DIライブラリは使わず手動配線する（ADR-0002）。
import { dbPlatformRepository } from '@/external/repository/platformRepository';
import { dbPlatformLocationRepository } from '@/external/repository/platformLocationRepository';
import { dbStopPatternRepository } from '@/external/repository/stopPatternRepository';
import { dbStopPatternPageQuery } from '@/external/query/stopPatternPageQuery';
import { dbMasterImportRepository } from '@/external/repository/masterImportRepository';
import { ekidataCsvSource } from '@/external/ekidata/ekidataCsvParser';
import { makePlanImport } from '@/features/master-import/usecases/planImport';
import { makeApplyImport } from '@/features/master-import/usecases/applyImport';

export const platformRepository = dbPlatformRepository;
export const platformLocationRepository = dbPlatformLocationRepository;
export const stopPatternRepository = dbStopPatternRepository;
export const stopPatternPageQuery = dbStopPatternPageQuery;

// ekidata マスタ取り込み。CSV 形式の知識も external/ にあるため、
// usecase からは port 越しにしか触らせない（ADR-0002）
export const planImport = makePlanImport({
  source: ekidataCsvSource,
  repository: dbMasterImportRepository,
});
export const applyImport = makeApplyImport({
  source: ekidataCsvSource,
  repository: dbMasterImportRepository,
});
