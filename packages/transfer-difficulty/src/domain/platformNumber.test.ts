import { describe, expect, it } from 'vitest';
import { comparePlatformNumber } from './platformNumber';

describe('comparePlatformNumber', () => {
  it('ホーム番号を数値として比べる (2 が 10 より前)', () => {
    expect(['10', '2', '1'].sort(comparePlatformNumber)).toEqual(['1', '2', '10']);
  });

  it('同じ番号は 0 を返す', () => {
    expect(comparePlatformNumber('3', '3')).toBe(0);
  });
});
