import {
  PlanTokenMismatchError,
  type CsvParseError,
  type EkidataCsvFiles,
  type EkidataCsvSource,
} from '@/features/master-import/ports';
import type { MigrationResult } from '../domain/migrationPlan';
import type { MasterMigrationRepository } from '../ports';

export type ApplyMigrationResult =
  | { ok: true; applied: MigrationResult }
  | { ok: false; errors: CsvParseError[] };

/**
 * 突合の適用。
 *
 * 差分を見せたのと同じ4ファイルであることを planToken で照合してから
 * repository へ渡す。突合そのものはトランザクションの内側でやり直される。
 */
export function makeApplyMigration(deps: {
  source: EkidataCsvSource;
  repository: MasterMigrationRepository;
}) {
  return async function applyMigration(
    files: EkidataCsvFiles,
    planToken: string,
  ): Promise<ApplyMigrationResult> {
    const digest = await deps.source.digest(files);
    if (digest !== planToken) throw new PlanTokenMismatchError();

    const parsed = deps.source.parse(files);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };

    return { ok: true, applied: await deps.repository.apply(parsed.records) };
  };
}
