import { describe, it, expect } from 'vitest';
import { stripRomajiSeparator } from './romaji';

describe('stripRomajiSeparator', () => {
  it('ローマ字内のハイフンを削除する', () => {
    expect(stripRomajiSeparator('shinjuku-sanchome')).toBe('shinjukusanchome');
  });
  it('ローマ字内のスペースを削除する', () => {
    expect(stripRomajiSeparator('toranomon hills')).toBe('toranomonhills');
  });
  it('ローマ字内のハイフンとスペースを削除する', () => {
    expect(stripRomajiSeparator('nishi-shinjuku gochome')).toBe('nishishinjukugochome');
  });
});