import { describe, it, expect } from 'vitest';
import { toKatakana, toKanaSearchKey } from './kana';

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

describe('toKanaSearchKey', () => {
  // DB の name_kana は副駅名の区切りに全角空白を持つ（例: メイジジングウマエ　ハラジュク）。
  // 入力の空白の有無・全半角を問わず一致させるため、空白はすべて取り除く
  it.each([
    ['めいじじんぐうまえ　はらじゅく', 'メイジジングウマエハラジュク'], // 全角空白
    ['めいじじんぐうまえ はらじゅく', 'メイジジングウマエハラジュク'], // 半角空白
    ['めいじじんぐうまえはらじゅく', 'メイジジングウマエハラジュク'], // 空白なし
  ])('%s の検索キーは %s', (input, expected) => {
    expect(toKanaSearchKey(input)).toBe(expected);
  });

  it('空白だけの入力は空文字になる', () => {
    expect(toKanaSearchKey(' 　')).toBe('');
  });
});
