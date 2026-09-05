import { describe, it, expect } from 'vitest';
import { normalizeStationName } from './normalize';

describe('normalizeStationName', () => {
  it('山括弧と丸括弧のどちらでも中身ごと除去する', () => {
    expect(normalizeStationName('押上〈スカイツリー前〉')).toBe('押上');
    expect(normalizeStationName('押上（スカイツリー前）')).toBe('押上');
    expect(normalizeStationName('押上(スカイツリー前)')).toBe('押上');
    expect(normalizeStationName('獨協大学前〈草加松原〉')).toBe('獨協大学前');
    expect(normalizeStationName('成田空港（第１旅客ターミナル）')).toBe('成田空港');
    expect(normalizeStationName('鹿島サッカースタジアム（臨）')).toBe('鹿島サッカースタジアム');
  });

  it('ヶ と ケ の揺れを吸収する', () => {
    expect(normalizeStationName('市ヶ谷')).toBe(normalizeStationName('市ケ谷'));
    expect(normalizeStationName('八ヶ岳')).toBe('八ケ岳');
  });

  it('括弧の無い駅名は変えない', () => {
    expect(normalizeStationName('新宿')).toBe('新宿');
    expect(normalizeStationName('計算科学センター')).toBe('計算科学センター');
  });

  it('前後の空白を落とす', () => {
    expect(normalizeStationName(' 東京 ')).toBe('東京');
  });

  // キーが空文字になると無関係な駅どうしが一致してしまう
  it('除去の結果が空になる場合は原文を返す', () => {
    expect(normalizeStationName('（臨時）')).toBe('（臨時）');
  });

  it('正規化しても別の駅どうしは衝突しない', () => {
    const names = [
      '押上〈スカイツリー前〉',
      '押上（スカイツリー前）',
      '市ケ谷',
      '市ヶ谷',
      '新宿',
      '新線新宿',
      '西新宿',
      '成田空港（第１旅客ターミナル）',
      '空港第２ビル（第２旅客ターミナル）',
    ];
    const normalized = names.map(normalizeStationName);
    // 押上2件・市ケ谷2件が意図的に一致し、残り5件は互いに異なる
    expect(new Set(normalized).size).toBe(7);
    expect(normalized.filter((n) => n === '押上')).toHaveLength(2);
    expect(normalized.filter((n) => n === '市ケ谷')).toHaveLength(2);
  });
});
