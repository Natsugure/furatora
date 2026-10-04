import { describe, expect, it } from 'vitest';
import { assembleTransferPartners, facilitiesByRoute, type PartnerLine } from './transferPartners';

describe('facilitiesByRoute', () => {
  it('ルートごとに設備をまとめる', () => {
    const result = facilitiesByRoute([
      { routeId: 'r1', typeCode: 'elevator' },
      { routeId: 'r1', typeCode: 'stairs' },
      { routeId: 'r2', typeCode: 'sameFloor' },
    ]);

    expect(result.get('r1')).toEqual(['elevator', 'stairs']);
    expect(result.get('r2')).toEqual(['sameFloor']);
  });

  it('稼働中のコードが知らない設備コードを含むルートは、既知の設備があっても設備を空（未入力）にする', () => {
    // 未知のコードの前後どちらに既知の設備があっても空になる
    const result = facilitiesByRoute([
      { routeId: 'r1', typeCode: 'elevator' },
      { routeId: 'r1', typeCode: 'unknownStep' },
      { routeId: 'r2', typeCode: 'unknownStep' },
      { routeId: 'r2', typeCode: 'elevator' },
      { routeId: 'r3', typeCode: 'elevator' },
    ]);

    expect(result.get('r1')).toEqual([]);
    expect(result.get('r2')).toEqual([]);
    expect(result.get('r3')).toEqual(['elevator']);
  });

  it('知らない設備コードだけのルートも設備を空（未入力）にする', () => {
    const result = facilitiesByRoute([{ routeId: 'r1', typeCode: 'unknownStep' }]);

    expect(result.get('r1')).toEqual([]);
  });
});

describe('assembleTransferPartners', () => {
  // S（自駅）は T より大きい uuid なので、接続行では B 側になる
  const S = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const T = '00000000-0000-0000-0000-00000000000a';
  const U = '00000000-0000-0000-0000-00000000000b';

  const partner = (connectedStationId: string, connectedStationName: string): PartnerLine => ({
    connectedStationId,
    connectedStationName,
    lineName: '新宿線',
    lineColor: '#6CBB5A',
  });
  const route = (connectionId: string, routeId: string, label: string) => ({
    connectionId,
    routeId,
    label,
    isBaseline: false,
    minutes: 3,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: true,
    notes: null,
  });
  const base = {
    stationId: S,
    partnerLines: [partner(T, '小川町'), partner(U, '未評価の駅')],
    connectionRows: [
      { id: 'c1', stationAId: T, directionA: 'outbound', stationBId: S, directionB: 'inbound', notes: '備考' },
    ] as const,
    routeRows: [route('c1', 'r-a', 'A'), route('c1', 'r-b', 'B')],
    facilityRows: [
      { routeId: 'r-a', typeCode: 'elevator' },
      { routeId: 'r-b', typeCode: 'unknownStep' },
    ],
    stationLineRows: [
      { stationId: S, lineId: 'L-marunouchi', lineName: '丸ノ内線' },
      { stationId: T, lineId: 'L-shinjuku', lineName: '新宿線' },
    ],
    platformRows: [
      { stationId: S, lineId: 'L-marunouchi', platformNumber: '1', inboundName: '池袋方面', outboundName: null },
    ],
    defaultDirectionRows: [{ lineId: 'L-shinjuku', directionType: 'outbound', displayName: '本八幡方面' }] as const,
  };

  // 相手駅の並びは partnerLines のまま
  const assemble = (input: Parameters<typeof assembleTransferPartners>[0] = base) => {
    const [toT, toU] = assembleTransferPartners(input);
    if (!toT) throw new Error('相手駅が返らない');
    return { toT, toU };
  };

  it('接続行を自駅から見た向きに直し、相手駅に紐づける', () => {
    const { toT } = assemble();

    expect(toT.connectedStationId).toBe(T);
    expect(toT.combos).toHaveLength(1);
    expect(toT.combos[0]).toMatchObject({ stationDirection: 'inbound', connectedDirection: 'outbound', notes: '備考' });
  });

  it('相手駅の uuid の大文字小文字が接続行と違っても、組み合わせを紐づける', () => {
    const { toT } = assemble({ ...base, partnerLines: [partner(T.toUpperCase(), '小川町')] });

    expect(toT.connectedStationId).toBe(T.toUpperCase());
    expect(toT.combos).toHaveLength(1);
  });

  it('接続行の無い相手駅は、組み合わせが空（未評価）になる', () => {
    const { toU } = assemble();

    expect(toU?.combos).toEqual([]);
  });

  it('ルートは渡された並び（label 順）のまま運び、知らない設備コードのルートは設備を空にする', () => {
    const { toT } = assemble();

    expect(toT.combos[0]?.routes.map((r) => [r.label, r.facilities])).toEqual([
      ['A', ['elevator']],
      ['B', []],
    ]);
  });

  it('自駅・相手駅それぞれの最初の路線で方面ラベルを解決する', () => {
    const { toT, toU } = assemble();

    expect(toT.stationLineName).toBe('丸ノ内線');
    expect(toT.directionLabels).toEqual({
      station: { inbound: '池袋方面', outbound: '下り' },
      connected: { inbound: '上り', outbound: '本八幡方面' },
    });
    // 路線の無い相手駅はフォールバック
    expect(toU?.directionLabels.connected).toEqual({ inbound: '上り', outbound: '下り' });
  });
});
