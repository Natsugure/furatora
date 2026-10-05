import { describe, expect, it } from 'vitest';
import {
  FALLBACK_DIRECTION_LABELS,
  firstLineByStation,
  resolveDirectionLabel,
  resolveStationDirectionLabels,
  type PlatformDirectionRow,
} from './index';

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

describe('firstLineByStation', () => {
  it('駅ごとに、並び順の先頭の路線を採る', () => {
    const firstLineOf = firstLineByStation([
      { stationId: 's1', lineId: 'L2', lineName: '丸ノ内線' },
      { stationId: 's2', lineId: 'L3', lineName: '新宿線' },
      { stationId: 's1', lineId: 'L1', lineName: '銀座線' },
    ]);
    expect(firstLineOf.get('s1')).toEqual({ lineId: 'L2', lineName: '丸ノ内線' });
    expect(firstLineOf.get('s2')).toEqual({ lineId: 'L3', lineName: '新宿線' });
    expect(firstLineOf.get('s3')).toBeUndefined();
  });

  it('駅 ID の大文字小文字に依らず引ける', () => {
    const firstLineOf = firstLineByStation([{ stationId: 'ab-cd', lineId: 'L1', lineName: '銀座線' }]);
    expect(firstLineOf.get('AB-CD')).toEqual({ lineId: 'L1', lineName: '銀座線' });
  });
});

describe('resolveStationDirectionLabels', () => {
  const firstLineOf = new Map([['s1', { lineId: 'L1' }]]);
  const platform = (over: Partial<PlatformDirectionRow>): PlatformDirectionRow => ({ stationId: 's1', lineId: 'L1', platformNumber: '1', inboundName: null, outboundName: null, ...over });

  it('駅の最初の路線のホームだけを、ホーム番号の数値順に並べる', () => {
    expect(
      resolveStationDirectionLabels({
        stationId: 's1',
        firstLineOf,
        platformRows: [
          platform({ platformNumber: '10', inboundName: '十番線方面' }),
          platform({ platformNumber: '2', inboundName: '二番線方面' }),
          // 別の駅・別の路線のホームは混ぜない
          platform({ stationId: 's2', inboundName: '別の駅方面' }),
          platform({ lineId: 'L9', inboundName: '別の路線方面' }),
        ],
        defaultRows: [],
      }),
    ).toEqual({ inbound: '二番線方面／十番線方面', outbound: '下り' });
  });

  it('ホームの文言が null の走行方向は、路線の既定行へ進む', () => {
    expect(
      resolveStationDirectionLabels({
        stationId: 's1',
        firstLineOf,
        platformRows: [platform({ inboundName: '池袋方面', outboundName: null })],
        defaultRows: [
          { lineId: 'L1', directionType: 'outbound', displayName: '荻窪方面' },
          { lineId: 'L9', directionType: 'inbound', displayName: '別の路線の既定' },
        ],
      }),
    ).toEqual({ inbound: '池袋方面', outbound: '荻窪方面' });
  });

  it('既定行が別の路線にしか無ければ、フォールバックする', () => {
    expect(
      resolveStationDirectionLabels({
        stationId: 's1',
        firstLineOf,
        platformRows: [],
        defaultRows: [{ lineId: 'L9', directionType: 'inbound', displayName: '別の路線の既定' }],
      }),
    ).toEqual({ inbound: '上り', outbound: '下り' });
  });

  it('駅が路線を持たなければ、その駅のホームや既定行があってもフォールバックする', () => {
    expect(
      resolveStationDirectionLabels({
        stationId: 's2',
        firstLineOf,
        platformRows: [platform({ stationId: 's2', inboundName: '池袋方面' })],
        defaultRows: [{ lineId: 'L1', directionType: 'outbound', displayName: '荻窪方面' }],
      }),
    ).toEqual({ inbound: '上り', outbound: '下り' });
  });

  it('駅 ID の大文字小文字がホームの行や路線の引き先と違っても、同じ駅として解決する', () => {
    expect(
      resolveStationDirectionLabels({
        stationId: 'S1',
        firstLineOf: firstLineByStation([{ stationId: 's1', lineId: 'L1', lineName: '丸ノ内線' }]),
        platformRows: [platform({ stationId: 's1', inboundName: '池袋方面' })],
        defaultRows: [{ lineId: 'L1', directionType: 'outbound', displayName: '荻窪方面' }],
      }),
    ).toEqual({ inbound: '池袋方面', outbound: '荻窪方面' });
  });
});
