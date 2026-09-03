/**
 * ekidata が配布する CSV のための最小パーサ。
 *
 * 【引用符を扱わない理由】2026-08 配布分の4ファイル
 * （company / line / station / join）を実測したところ、引用符は全ファイルで 0 件、
 * 列数は全行でヘッダと一致し、住所列（address）にもカンマは含まれていなかった。
 * RFC4180 の完全実装も外部ライブラリも必要としない。
 *
 * ただし「今そうである」ことに寄りかからないために、**列数がヘッダと異なる行は
 * 例外にする**。将来 ekidata が引用符付きフィールドを導入した場合、
 * 黙って値がずれるのではなく、この検査でエラーとして表面化する。
 */

export class CsvFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvFormatError';
  }
}

export type CsvTable = {
  header: string[];
  rows: string[][];
};

const BOM_CODE = 0xfeff;

/**
 * CSV 本文を表に分解する。CRLF / LF / CR と先頭 BOM を吸収し、空行は読み飛ばす。
 * @throws {CsvFormatError} ヘッダが無い場合、または列数の合わない行がある場合
 */
export function parseCsv(text: string): CsvTable {
  const body = text.charCodeAt(0) === BOM_CODE ? text.slice(1) : text;
  const lines = body.split(/\r\n|\n|\r/);

  const headerLine = lines.find((line) => line.trim() !== '');
  if (headerLine === undefined) {
    throw new CsvFormatError('CSVが空である');
  }
  const header = headerLine.split(',').map((cell) => cell.trim());

  const rows: string[][] = [];
  for (let i = lines.indexOf(headerLine) + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    const cells = line.split(',');
    if (cells.length !== header.length) {
      throw new CsvFormatError(
        `${i + 1}行目の列数が ${cells.length} で、ヘッダの ${header.length} と一致しない`,
      );
    }
    rows.push(cells);
  }

  return { header, rows };
}

/** 必須列のうちヘッダに無いものを、指定された順で返す（REQ-1.4） */
export function missingColumns(header: readonly string[], required: readonly string[]): string[] {
  const present = new Set(header);
  return required.filter((name) => !present.has(name));
}

/**
 * 列名から添字を引く関数を作る。
 * 【重要】列位置に依存しないこと。ekidata は将来の版で列を追加しうる
 */
export function columnReader(header: readonly string[]): (row: readonly string[], name: string) => string {
  const index = new Map<string, number>();
  header.forEach((name, i) => {
    if (!index.has(name)) index.set(name, i);
  });

  return (row, name) => {
    const i = index.get(name);
    if (i === undefined) {
      throw new CsvFormatError(`列 ${name} がヘッダに存在しない`);
    }
    return row[i] ?? '';
  };
}
