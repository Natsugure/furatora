import { describe, it, expect } from 'vitest';
import { stationPageTitle, linePageTitle } from './pageTitle';

describe('stationPageTitle', () => {
  it('駅名に「駅」を足し、路線名を空白でつなぐ', () => {
    expect(stationPageTitle('渋谷', ['東京メトロ銀座線'])).toBe('渋谷駅 東京メトロ銀座線');
  });

  it('中にカッコを持つ路線名はそのまま出す', () => {
    expect(stationPageTitle('王子駅前', ['東京さくらトラム（都電荒川線）'])).toBe(
      '王子駅前駅 東京さくらトラム（都電荒川線）',
    );
  });

  it('駅名が「駅」で終わるときは「駅」を足さない', () => {
    expect(stationPageTitle('A駅', ['B線'])).toBe('A駅 B線');
  });

  it('複数の路線は重複を除いて「、」でつなぐ', () => {
    expect(stationPageTitle('A', ['日暮里・舎人ライナー', 'B線', '日暮里・舎人ライナー'])).toBe(
      'A駅 日暮里・舎人ライナー、B線',
    );
  });

  it('路線が無いときは駅名だけを出す', () => {
    expect(stationPageTitle('A', [])).toBe('A駅');
  });
});

describe('linePageTitle', () => {
  it('路線名に「の駅一覧」を足す', () => {
    expect(linePageTitle('東京メトロ銀座線')).toBe('東京メトロ銀座線の駅一覧');
  });
});
