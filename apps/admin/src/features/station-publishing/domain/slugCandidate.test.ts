import { describe, it, expect } from 'vitest';
import { buildSlugCandidate, hasKanaEkiSuffixMismatch } from './slugCandidate';

describe('buildSlugCandidate', () => {
  it('路線slug + ヘボン式カナで候補を組み立てる', () => {
    expect(buildSlugCandidate('jr-east-yamanote', 'シンジュク')).toBe('jr-east-yamanote-shinjuku');
  });

  it('路線slugが未設定なら null（先に路線のslugを求める判断材料）', () => {
    expect(buildSlugCandidate(null, 'シンジュク')).toBeNull();
  });

  it('カナが未設定なら null', () => {
    expect(buildSlugCandidate('jr-east-yamanote', null)).toBeNull();
  });
});

describe('hasKanaEkiSuffixMismatch', () => {
  it('天童南（漢字は駅で終わらないがカナはエキで終わる）は検出する', () => {
    expect(hasKanaEkiSuffixMismatch('天童南', 'テンドウミナミエキ')).toBe(true);
  });

  it('東宿郷（テイリュウジョウ）も検出する', () => {
    expect(hasKanaEkiSuffixMismatch('東宿郷', 'ヒガシシュクゴウテイリュウジョウ')).toBe(true);
  });

  it('富山駅（漢字もエキで終わる正当な駅名）は検出しない', () => {
    expect(hasKanaEkiSuffixMismatch('富山駅', 'トヤマエキ')).toBe(false);
  });

  it('新宿（エキで終わらない駅名）は検出しない', () => {
    expect(hasKanaEkiSuffixMismatch('新宿', 'シンジュク')).toBe(false);
  });

  it('カナが未設定なら検出しない', () => {
    expect(hasKanaEkiSuffixMismatch('新宿', null)).toBe(false);
  });
});
