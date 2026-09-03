import type { ImportedRecords, MasterSnapshot, ApplyResult } from './domain/importedRecords';

/** 管理者がアップロードする4種のCSV本文。ekidata の配布単位そのもの */
export type EkidataCsvFiles = {
  company: string;
  line: string;
  station: string;
  join: string;
};

export type CsvFileKey = keyof EkidataCsvFiles;

export type CsvParseError =
  /** 必須列が欠けている。どのファイルのどの列かを返す（REQ-1.4） */
  | { kind: 'missing_columns'; file: CsvFileKey; columns: string[] }
  /** 列数が合わない等、表として読めない */
  | { kind: 'malformed'; file: CsvFileKey; message: string };

export type ParseResult =
  | { ok: true; records: ImportedRecords }
  | { ok: false; errors: CsvParseError[] };

/**
 * CSV 形式の知識はこのポートの実装（external/ekidata/）にだけ置く。
 * DB に触れないが、供給元固有の外部仕様であるため domain ではない
 * （docs/spec/design.md）。usecases から直接 import せず di.ts で配線する（ADR-0002）。
 */
export interface EkidataCsvSource {
  parse(files: EkidataCsvFiles): ParseResult;
  /**
   * plan と apply が同一入力であることを照合するためのダイジェスト。
   * サーバは計画を保持しないため、これが plan → apply をつなぐ唯一の紐である
   */
  digest(files: EkidataCsvFiles): Promise<string>;
}

/**
 * 書き込みは Repository（ADR-0003）。
 * apply は全テーブルを単一の withTransaction で適用する（TASK-1.1 で確定）。
 * 差分算出に必要なスナップショットはトランザクションの内側で取り直すため、
 * ここで受け取るのはパース済みのレコードだけである
 */
export interface MasterImportRepository {
  /** plan 用。DB を変更しない */
  loadSnapshot(): Promise<MasterSnapshot>;
  apply(records: ImportedRecords): Promise<ApplyResult>;
}

/** apply に渡された planToken が、送られてきたCSVのダイジェストと一致しない */
export class PlanTokenMismatchError extends Error {
  constructor() {
    super('planToken が CSV の内容と一致しない。差分の確認をやり直すこと');
    this.name = 'PlanTokenMismatchError';
  }
}

/** 適用不能な事象（blockers）が残ったまま apply が呼ばれた */
export class ImportBlockedError extends Error {
  constructor() {
    super('適用不能な事象が残っている');
    this.name = 'ImportBlockedError';
  }
}
