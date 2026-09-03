import type { EkidataCsvFiles, EkidataCsvSource, CsvParseError } from '@/features/master-import/ports';
import { computeMigrationPlan } from '../domain/match';
import type { MigrationBlocker, MigrationPlan, TableMatch, Unmatched } from '../domain/migrationPlan';
import type { MasterMigrationRepository } from '../ports';

/** 画面に出す件数。突合結果そのもの（id とコードの対）は返さない */
export type MigrationTableSummary = {
  total: number;
  assigned: number;
  alreadySet: number;
  unmatched: number;
  byMethod: TableMatch['byMethod'];
};

export type MigrationSummary = {
  operators: MigrationTableSummary;
  lines: MigrationTableSummary;
  stations: MigrationTableSummary;
  connections: MigrationPlan['connections'];
};

export type PlanMigrationResult =
  | {
      ok: true;
      summary: MigrationSummary;
      /** REQ-3.2: 突合できなかった行は削除せず一覧として報告する */
      unmatched: { operators: Unmatched[]; lines: Unmatched[]; stations: Unmatched[] };
      blockers: MigrationBlocker[];
      planToken: string;
    }
  | { ok: false; errors: CsvParseError[] };

/**
 * 突合の試算。DB を変更しない。
 *
 * planToken は master-import と同じく4ファイルの SHA-256 である。
 * サーバは計画を保持せず、apply では同じ4ファイルが再送される
 * （理由は docs/spec/design.md「計画はサーバに保持しない」）。
 */
export function makePlanMigration(deps: {
  source: EkidataCsvSource;
  repository: MasterMigrationRepository;
}) {
  return async function planMigration(files: EkidataCsvFiles): Promise<PlanMigrationResult> {
    const parsed = deps.source.parse(files);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };

    const [snapshot, planToken] = await Promise.all([
      deps.repository.loadSnapshot(),
      deps.source.digest(files),
    ]);

    const plan = computeMigrationPlan(parsed.records, snapshot);

    return {
      ok: true,
      summary: {
        operators: toTableSummary(plan.operators),
        lines: toTableSummary(plan.lines),
        stations: toTableSummary(plan.stations),
        connections: plan.connections,
      },
      unmatched: {
        operators: plan.operators.unmatched,
        lines: plan.lines.unmatched,
        stations: plan.stations.unmatched,
      },
      blockers: plan.blockers,
      planToken,
    };
  };
}

function toTableSummary(match: TableMatch): MigrationTableSummary {
  return {
    total: match.total,
    assigned: match.assigned.length,
    alreadySet: match.alreadySet,
    unmatched: match.unmatched.length,
    byMethod: match.byMethod,
  };
}
