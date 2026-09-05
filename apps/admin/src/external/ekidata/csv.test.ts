import { describe, it, expect } from 'vitest';
import { parseCsv, missingColumns, columnReader, CsvFormatError } from './csv';

describe('parseCsv', () => {
  it('ヘッダと行に分解する', () => {
    const table = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
    expect(table.header).toEqual(['a', 'b', 'c']);
    expect(table.rows).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('CRLF と先頭 BOM を吸収する', () => {
    // BOM は生の文字を置くと IDE 上で消えて見えるため、エスケープで書く
    const table = parseCsv('\uFEFFa,b\r\n1,2\r\n');
    expect(table.header).toEqual(['a', 'b']);
    expect(table.rows).toEqual([['1', '2']]);
  });

  it('途中と末尾の空行を読み飛ばす', () => {
    const table = parseCsv('a,b\n1,2\n\n3,4\n\n');
    expect(table.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('空文字のセルを保持する', () => {
    const table = parseCsv('a,b,c\n1,,3');
    expect(table.rows).toEqual([['1', '', '3']]);
  });

  // 引用符を実装しない代わりの安全弁。将来 ekidata が引用符を導入したら
  // 値が黙ってずれるのではなく、ここで落ちる
  it('列数がヘッダと合わない行があれば例外にする', () => {
    expect(() => parseCsv('a,b,c\n1,2,3\n4,5')).toThrow(CsvFormatError);
    expect(() => parseCsv('a,b\n"x,y",2')).toThrow(/3 で、ヘッダの 2/);
  });

  it('行番号を報告する', () => {
    expect(() => parseCsv('a,b\n1,2\n3,4,5')).toThrow(/3行目/);
  });

  it('空のCSVは例外にする', () => {
    expect(() => parseCsv('')).toThrow(CsvFormatError);
    expect(() => parseCsv('\n\n')).toThrow(CsvFormatError);
  });
});

describe('missingColumns', () => {
  it('欠落した列名だけを指定順で返す', () => {
    expect(missingColumns(['a', 'c'], ['a', 'b', 'c', 'd'])).toEqual(['b', 'd']);
  });

  it('すべて揃っていれば空配列を返す', () => {
    expect(missingColumns(['a', 'b'], ['b'])).toEqual([]);
  });
});

describe('columnReader', () => {
  it('列位置ではなく列名で値を引く', () => {
    const read = columnReader(['x', 'y']);
    expect(read(['1', '2'], 'y')).toBe('2');
  });

  it('未知の列名は例外にする', () => {
    const read = columnReader(['x']);
    expect(() => read(['1'], 'z')).toThrow(CsvFormatError);
  });
});
