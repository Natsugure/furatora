// コンポジションルート。DIライブラリは使わず手動配線する（ADR-0002）。
import { dbPlatformRepository } from '@/external/repository/platformRepository';
import { dbPlatformLocationRepository } from '@/external/repository/platformLocationRepository';
import { dbStopPatternRepository } from '@/external/repository/stopPatternRepository';
import { dbStopPatternPageQuery } from '@/external/query/stopPatternPageQuery';
import { dbMasterImportRepository } from '@/external/repository/masterImportRepository';
import { dbMasterMigrationRepository } from '@/external/repository/masterMigrationRepository';
import { ekidataCsvSource } from '@/external/ekidata/ekidataCsvParser';
import { makePlanImport } from '@/features/master-import/usecases/planImport';
import { makeApplyImport } from '@/features/master-import/usecases/applyImport';
import { makePlanMigration } from '@/features/master-migration/usecases/planMigration';
import { makeApplyMigration } from '@/features/master-migration/usecases/applyMigration';

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

// ekidata コードの突合（Issue #56 Phase 3・一度きり）。
// CSV の読み手は取り込みと同じ ekidataCsvSource である。
// 実運用の順序は「突合 → 取り込み」であり、逆順では取り込みが
// operator_name_conflict を出して適用を拒否する（docs/spec/design.md）
export const planMigration = makePlanMigration({
  source: ekidataCsvSource,
  repository: dbMasterMigrationRepository,
});
export const applyMigration = makeApplyMigration({
  source: ekidataCsvSource,
  repository: dbMasterMigrationRepository,
});
