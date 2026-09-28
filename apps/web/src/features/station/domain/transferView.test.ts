import { describe, expect, it } from 'vitest';
import type { DirectionType } from '@furatora/transfer-difficulty/domain';
import { differingFields, groupCombos } from './transferView';
import type { TransferComboDTO, TransferPartnerDTO, TransferRouteDTO } from './types';

function route(overrides: Partial<TransferRouteDTO> & { routeId: string }): TransferRouteDTO {
  return {
    label: overrides.routeId,
    isBaseline: false,
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: true,
    notes: null,
    facilities: ['elevator'],
    ...overrides,
  };
}

function combo(
  stationDirection: DirectionType,
  connectedDirection: DirectionType,
  routes: TransferRouteDTO[],
  notes: string | null = null,
): TransferComboDTO {
  return { stationDirection, connectedDirection, notes, routes };
}

function partner(combos: TransferComboDTO[]): TransferPartnerDTO {
  return {
    connectedStationId: 't',
    connectedStationName: '小川町',
    lineName: '都営新宿線',
    lineColor: null,
    stationLineName: '東京メトロ丸ノ内線',
    directionLabels: {
      station: { inbound: '荻窪方面', outbound: '池袋方面' },
      connected: { inbound: '新宿方面', outbound: '本八幡方面' },
    },
    combos,
  };
}

const ev = route({ routeId: 'ev', label: 'エレベーター経由' });
const esc = route({ routeId: 'esc', label: '車いす対応エスカレーター経由', facilities: ['wheelchairEscalator'] });
const all = (routes: TransferRouteDTO[], notes: string | null = null) => [
  combo('inbound', 'inbound', routes, notes),
  combo('inbound', 'outbound', routes, notes),
  combo('outbound', 'inbound', routes, notes),
  combo('outbound', 'outbound', routes, notes),
];

describe('groupCombos', () => {
  it('未評価（接続0行）は見出しなしの空グループ1つ', () => {
    expect(groupCombos(partner([]))).toEqual([{ heading: null, combos: [], routes: [], notes: null }]);
  });

  it('4組み合わせが同じルート・備考なら、見出しなしの1グループ', () => {
    const groups = groupCombos(partner(all([ev], '共通の備考')));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ heading: null, routes: [ev], notes: '共通の備考' });
  });

  it('ルートの並び順が違うだけなら同じグループ', () => {
    const groups = groupCombos(partner([
      combo('inbound', 'inbound', [ev, esc]),
      combo('inbound', 'outbound', [esc, ev]),
      combo('outbound', 'inbound', [ev, esc]),
      combo('outbound', 'outbound', [ev, esc]),
    ]));
    expect(groups).toHaveLength(1);
  });

  it('淡路町↔小川町型: 自駅の方面でルートが分かれる → 自駅の路線と方面の見出し', () => {
    const groups = groupCombos(partner([
      combo('inbound', 'inbound', [ev]),
      combo('inbound', 'outbound', [ev]),
      combo('outbound', 'inbound', [esc]),
      combo('outbound', 'outbound', [esc]),
    ]));
    expect(groups.map((g) => g.heading)).toEqual(['東京メトロ丸ノ内線 荻窪方面', '東京メトロ丸ノ内線 池袋方面']);
    expect(groups.map((g) => g.routes)).toEqual([[ev], [esc]]);
  });

  it('相手駅の方面でルートが分かれる → 相手駅の路線と方面の見出し', () => {
    const groups = groupCombos(partner([
      combo('inbound', 'inbound', [ev]),
      combo('outbound', 'inbound', [ev]),
      combo('inbound', 'outbound', [esc]),
      combo('outbound', 'outbound', [esc]),
    ]));
    expect(groups.map((g) => g.heading)).toEqual(['都営新宿線 新宿方面', '都営新宿線 本八幡方面']);
  });

  it('片側の方面で決まらないグループは、組み合わせごとの見出しを並べる', () => {
    const groups = groupCombos(partner([
      combo('inbound', 'inbound', [ev]),
      combo('inbound', 'outbound', [esc]),
      combo('outbound', 'inbound', [esc]),
      combo('outbound', 'outbound', [ev]),
    ]));
    expect(groups.map((g) => g.heading)).toEqual([
      '東京メトロ丸ノ内線 荻窪方面 → 都営新宿線 新宿方面、東京メトロ丸ノ内線 池袋方面 → 都営新宿線 本八幡方面',
      '東京メトロ丸ノ内線 荻窪方面 → 都営新宿線 本八幡方面、東京メトロ丸ノ内線 池袋方面 → 都営新宿線 新宿方面',
    ]);
  });

  it('接続の備考が違えば別グループ', () => {
    const groups = groupCombos(partner([
      combo('inbound', 'inbound', [ev], 'A'),
      combo('inbound', 'outbound', [ev], 'A'),
      combo('outbound', 'inbound', [ev], 'B'),
      combo('outbound', 'outbound', [ev], 'B'),
    ]));
    expect(groups.map((g) => g.notes)).toEqual(['A', 'B']);
  });

  it('ラベルや基準ルートの印が違えば別グループ', () => {
    const groups = groupCombos(partner([
      combo('inbound', 'inbound', [ev]),
      combo('inbound', 'outbound', [ev]),
      combo('outbound', 'inbound', [{ ...ev, isBaseline: true }]),
      combo('outbound', 'outbound', [{ ...ev, isBaseline: true }]),
    ]));
    expect(groups).toHaveLength(2);
  });

  it('評価済みの組み合わせが一部だけなら、残りは未評価のグループになる', () => {
    const groups = groupCombos(partner([
      combo('inbound', 'inbound', [ev]),
      combo('inbound', 'outbound', [ev]),
    ]));
    expect(groups).toEqual([
      { heading: '東京メトロ丸ノ内線 荻窪方面', combos: expect.any(Array), routes: [ev], notes: null },
      { heading: '東京メトロ丸ノ内線 池袋方面', combos: [], routes: [], notes: null },
    ]);
  });
});

describe('differingFields', () => {
  it('ルートが1本なら何も異ならない', () => {
    expect(differingFields('stroller', [ev])).toEqual(new Set());
  });

  it('所要時分・必要な行為・フラグのうち、値が違うものだけを返す', () => {
    const a = route({ routeId: 'a', minutes: 3, facilities: ['elevator'] });
    const b = route({ routeId: 'b', minutes: 5, facilities: ['stairLift'], requiresStaff: true });
    expect(differingFields('wheelchair', [a, b])).toEqual(new Set(['minutes', 'requirement', 'requiresStaff']));
  });

  it('必要な行為はペルソナごとに比べる', () => {
    const a = route({ routeId: 'a', facilities: ['elevator'] });
    const b = route({ routeId: 'b', facilities: ['sameFloor'] });
    expect(differingFields('wheelchair', [a, b])).toEqual(new Set());
  });
});
