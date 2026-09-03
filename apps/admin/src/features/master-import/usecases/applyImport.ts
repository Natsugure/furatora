import type {
  EkidataCsvFiles,
  EkidataCsvSource,
  MasterImportRepository,
  CsvParseError,
} from '../ports';
import { PlanTokenMismatchError } from '../ports';
import type { ApplyResult } from '../domain/importedRecords';

export type ApplyImportResult =
  | { ok: false; errors: CsvParseError[] }
  | { ok: true; applied: ApplyResult };

/**
 * 承認された差分を適用する（REQ-1.3）。
 *
 * サーバは計画を保持しないため、apply には plan と同じ4ファイルが再送される。
 * 同一入力であることは `planToken`（4ファイルのダイジェスト）で照合する。
 * 差分の算出は適用側でトランザクション内にやり直すため、
 * 提示から承認までの間に DB が変わっていても古い前提で書き込まない。
 */
export function makeApplyImport(deps: {
  source: EkidataCsvSource;
  repository: MasterImportRepository;
}) {
  return async (files: EkidataCsvFiles, planToken: string): Promise<ApplyImportResult> => {
    const digest = await deps.source.digest(files);
    if (digest !== planToken) throw new PlanTokenMismatchError();

    const parsed = deps.source.parse(files);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };

    return { ok: true, applied: await deps.repository.apply(parsed.records) };
  };
}
