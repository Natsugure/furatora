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
  it('全角英字と全角ハイフンを半角にそろえてから区切り記号を削除する', () => {
    expect(stripRomajiSeparator('ｎａｋａ－ｍｅｇｕｒｏ')).toBe('nakameguro');
  });
  it('全角空白も区切り記号として削除する', () => {
    expect(stripRomajiSeparator('toranomon　hills')).toBe('toranomonhills');
  });
  it('区切り記号だけの入力は空文字になる', () => {
    expect(stripRomajiSeparator(' - ')).toBe('');
  });
});
