import type {
  EkidataCsvFiles,
  EkidataCsvSource,
  MasterImportRepository,
  CsvParseError,
} from '../ports';
import { computeImportPlan } from '../domain/plan';
import type { ImportBlocker, ImportSummary, ImportWarning } from '../domain/importedRecords';

export type PlanImportResult =
  | { ok: false; errors: CsvParseError[] }
  | {
      ok: true;
      summary: ImportSummary;
      warnings: ImportWarning[];
      blockers: ImportBlocker[];
      /**
       * apply に添えて「差分を見せたのと同じCSVか」を照合するための値。
       * サーバは計画を保持しないため、これが plan と apply をつなぐ唯一の紐である
       */
      planToken: string;
    };

/**
 * 差分を提示する（REQ-1.1 / REQ-1.2）。**DB は変更しない。**
 * CSV の解析はここで完結させる。適用側のトランザクションに解析を持ち込むと、
 * `idle_in_transaction_session_timeout` が初めてリスクになる。
 */
export function makePlanImport(deps: {
  source: EkidataCsvSource;
  repository: MasterImportRepository;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  return async (files: EkidataCsvFiles): Promise<PlanImportResult> => {
    const parsed = deps.source.parse(files);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };

    const [snapshot, planToken] = await Promise.all([
      deps.repository.loadSnapshot(),
      deps.source.digest(files),
    ]);

    const plan = computeImportPlan(parsed.records, snapshot, toRunDate(now()));

    return {
      ok: true,
      summary: plan.summary,
      warnings: plan.warnings,
      blockers: plan.blockers,
      planToken,
    };
  };
}

export function toRunDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
