import { describe, expect, it } from 'vitest';
import { parseStationCode } from './stationCode';

describe('parseStationCode', () => {
  it('路線記号の英字と番号に分ける', () => {
    expect(parseStationCode('G01')).toEqual({ lineSymbol: 'G', number: '01' });
  });

  it('小文字を含む路線記号（方南町支線の Mb）も分ける', () => {
    expect(parseStationCode('Mb03')).toEqual({ lineSymbol: 'Mb', number: '03' });
  });

  it.each(['A-11', '123', 'G', ''])('英字と数字に分けられない %o は null', (code) => {
    expect(parseStationCode(code)).toBeNull();
  });
});
