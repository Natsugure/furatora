import type { ImportedRecords } from '@/features/master-import/domain/importedRecords';
import type { MigrationResult, MigrationSnapshot } from './domain/migrationPlan';

/**
 * 突合は取り込みとまったく同じ4ファイルを入力にする。CSV 形式の知識は
 * external/ekidata/ に1つだけ置き、両方の feature が master-import の
 * EkidataCsvSource 越しに使う（ADR-0002）。ここに別のパーサを持たない。
 *
 * 依存の向きは master-migration → master-import の一方向で、循環しない
 * （ADR-0001「feature 間の依存」）。
 */

/**
 * 書き込みは Repository（ADR-0003）。
 *
 * apply はパース済みのレコードだけを受け取り、突合はトランザクションの内側で
 * やり直す。plan を見せてから apply するまでの間に Admin で行が編集されても、
 * 実際に書くのは「そのトランザクションで見えた現在の姿」に対する突合結果になる。
 */
export interface MasterMigrationRepository {
  /** plan 用。DB を変更しない */
  loadSnapshot(): Promise<MigrationSnapshot>;
  apply(records: ImportedRecords): Promise<MigrationResult>;
}

/** 適用不能な事象（blockers）が残ったまま apply が呼ばれた */
export class MigrationBlockedError extends Error {
  constructor() {
    super('適用不能な事象が残っている');
    this.name = 'MigrationBlockedError';
  }
}
