import { describe, expect, it } from 'vitest';
import { FALLBACK_DIRECTION_LABELS, resolveDirectionLabel } from './index';

describe('resolveDirectionLabel: ① ホームの文言', () => {
  it('ホームの文言が1件あれば、既定行より優先する', () => {
    expect(
      resolveDirectionLabel({
        directionType: 'inbound',
        platformNames: ['東京・新宿・荻窪・方南町方面'],
        defaultName: '荻窪・方南町方面',
      }),
    ).toEqual({ label: '東京・新宿・荻窪・方南町方面', source: 'platform' });
  });

  it('複数あれば、並び順のまま「／」で連結する（中野坂上 inbound。#128）', () => {
    expect(
      resolveDirectionLabel({
        directionType: 'inbound',
        platformNames: ['方南町方面', '荻窪・方南町方面'],
        defaultName: '荻窪・方南町方面',
      }),
    ).toEqual({ label: '方南町方面／荻窪・方南町方面', source: 'platform' });
  });

  it('同じ文言を持つホームが複数あっても、1回だけ出す', () => {
    expect(
      resolveDirectionLabel({
        directionType: 'outbound',
        platformNames: ['池袋方面', '池袋方面'],
        defaultName: null,
      }),
    ).toEqual({ label: '池袋方面', source: 'platform' });
  });

  it('空文字は無いものとして扱う', () => {
    expect(
      resolveDirectionLabel({
        directionType: 'outbound',
        platformNames: ['', '池袋方面'],
        defaultName: null,
      }),
    ).toEqual({ label: '池袋方面', source: 'platform' });
  });
});

describe('resolveDirectionLabel: ② 既定行', () => {
  it('ホームが無ければ、既定行の文言を使う', () => {
    expect(
      resolveDirectionLabel({ directionType: 'outbound', platformNames: [], defaultName: '池袋方面' }),
    ).toEqual({ label: '池袋方面', source: 'default' });
  });

  it('ホームの文言が空文字だけなら、既定行へ進む', () => {
    expect(
      resolveDirectionLabel({ directionType: 'inbound', platformNames: [''], defaultName: '内回り' }),
    ).toEqual({ label: '内回り', source: 'default' });
  });
});

describe('resolveDirectionLabel: ③ フォールバック', () => {
  it('ホームも既定行も無ければ、inbound は「上り」', () => {
    expect(
      resolveDirectionLabel({ directionType: 'inbound', platformNames: [], defaultName: null }),
    ).toEqual({ label: '上り', source: 'fallback' });
  });

  it('ホームも既定行も無ければ、outbound は「下り」', () => {
    expect(
      resolveDirectionLabel({ directionType: 'outbound', platformNames: [], defaultName: null }),
    ).toEqual({ label: '下り', source: 'fallback' });
  });

  it('既定行の文言が空文字なら、フォールバックする', () => {
    expect(
      resolveDirectionLabel({ directionType: 'outbound', platformNames: [], defaultName: '' }),
    ).toEqual({ label: FALLBACK_DIRECTION_LABELS.outbound, source: 'fallback' });
  });
});
