import { describe, it, expect } from 'vitest';
import { toKatakana } from './kana';

describe('toKatakana', () => {
  it('ひらがなをカタカナに変換する', () => {
    expect(toKatakana('とうきょう')).toBe('トウキョウ');
  });

  it('拗音・濁音は小書き・濁点を保ったまま変換される', () => {
    expect(toKatakana('しんじゅく')).toBe('シンジュク');
  });

  it('漢字とカタカナが混合している場合はそのまま返す', () => {
    expect(toKatakana('行川アイランド')).toBe('行川アイランド');
  });

  it('半角カタカナを全角カタカナに変換する', () => {
    expect(toKatakana('ｼﾝｼﾞｭｸ')).toBe('シンジュク');
  });

  it.each([
    ['ゔ', 'ヴ'],   // 範囲の境界（U+3094）
    ['ゖ', 'ヶ'],   // 範囲の末尾（U+3096）
    ['ー', 'ー'],   // 長音記号は変換対象外
  ])('%s を変換した結果は %s', (input, expected) => {
    expect(toKatakana(input)).toBe(expected);
  });
});
