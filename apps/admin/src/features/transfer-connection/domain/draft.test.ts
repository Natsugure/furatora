import { describe, expect, it } from 'vitest';
import type { CandidateRoute, PairRouteRecord, TransferPairEditContext } from '../ports';
import {
  addRoute,
  detachFromSharedRoute,
  draftFromContext,
  duplicateRoute,
  hasDivergentLinks,
  mergeCards,
  mergeIntoCandidate,
  removeRoute,
  toSaveInput,
  toggleCombo,
  toggleFacility,
  updateRoute,
} from './draft';
import { COMBO_KEYS, type PairDraft, type RouteDraft } from './types';

const S = '22222222-2222-4222-8222-222222222222';
const T = '11111111-1111-4111-8111-111111111111';

function record(over: Partial<PairRouteRecord> = {}): PairRouteRecord {
  return {
    routeId: 'r1',
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: false,
    notes: null,
    facilities: ['elevator'],
    links: COMBO_KEYS.map((combo) => ({ combo, label: 'エレベーター経由', isBaseline: true })),
    sharedWith: [],
    ...over,
  };
}

function context(over: Partial<TransferPairEditContext> = {}): TransferPairEditContext {
  return {
    stationId: S,
    connectedStationId: T,
    stationName: '淡路町',
    connectedStationName: '小川町',
    lineName: '丸ノ内線',
    connectedLineName: '新宿線',
    directionHints: {
      station: { inbound: [], outbound: [] },
      connected: { inbound: [], outbound: [] },
    },
    facilityTypes: [],
    connections: [],
    routes: [],
    candidates: [],
    ...over,
  };
}

function card(over: Partial<RouteDraft> = {}): RouteDraft {
  return {
    key: 'k1',
    routeId: null,
    label: '',
    isBaseline: false,
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: false,
    notes: '',
    facilities: [],
    combos: [...COMBO_KEYS],
    ...over,
  };
}

const emptyNotes = () => Object.fromEntries(COMBO_KEYS.map((c) => [c, ''])) as PairDraft['connectionNotes'];

describe('draftFromContext', () => {
  it('御茶ノ水型: 4通り全部に結ばれた1本のルートは、組み合わせ4つの1枚のカードになる', () => {
    const draft = draftFromContext(context({ routes: [record({ sharedWith: [{ stationName: 'a', connectedStationName: 'b' }] })] }));
    expect(draft.routes).toHaveLength(1);
    expect(draft.routes[0]).toMatchObject({
      routeId: 'r1',
      label: 'エレベーター経由',
      isBaseline: true,
      facilities: ['elevator'],
      combos: [...COMBO_KEYS],
    });
  });

  it('淡路町型: 組み合わせが2つずつに分かれた2本のルートは、2枚のカードになる', () => {
    const a = record({
      routeId: 'ra',
      links: [
        { combo: 'outbound:inbound', label: '車いす対応エスカレーター経由', isBaseline: true },
        { combo: 'outbound:outbound', label: '車いす対応エスカレーター経由', isBaseline: true },
      ],
    });
    const b = record({
      routeId: 'rb',
      links: [
        { combo: 'inbound:inbound', label: 'エレベーターのみ', isBaseline: true },
        { combo: 'inbound:outbound', label: 'エレベーターのみ', isBaseline: true },
      ],
    });
    const draft = draftFromContext(context({ routes: [a, b] }));
    expect(draft.routes.map((r) => [r.routeId, r.combos])).toEqual([
      ['rb', ['inbound:inbound', 'inbound:outbound']],
      ['ra', ['outbound:inbound', 'outbound:outbound']],
    ]);
  });

  it('同じ組み合わせに結ばれたルートは、基準ルートを先頭に並べる（名前順より優先）', () => {
    const base = record({
      routeId: 'rbase',
      links: COMBO_KEYS.map((combo) => ({ combo, label: '一般経路', isBaseline: true })),
    });
    const bf = record({
      routeId: 'rbf',
      links: COMBO_KEYS.map((combo) => ({ combo, label: 'エレベーター経由', isBaseline: false })),
    });
    const draft = draftFromContext(context({ routes: [bf, base] }));
    expect(draft.routes.map((r) => r.routeId)).toEqual(['rbase', 'rbf']);
  });

  it('接続の備考は組み合わせごとに読み込む（無ければ空文字）', () => {
    const draft = draftFromContext(
      context({
        connections: [{ combo: 'inbound:inbound', notes: '一長一短です' }],
      }),
    );
    expect(draft.connectionNotes['inbound:inbound']).toBe('一長一短です');
    expect(draft.connectionNotes['outbound:outbound']).toBe('');
  });

  it('ルートが0本なら空のドラフトになる（未評価）', () => {
    expect(draftFromContext(context()).routes).toEqual([]);
  });

  it('カードの key は互いに異なる', () => {
    const draft = draftFromContext(context({ routes: [record({ routeId: 'r1' }), record({ routeId: 'r2' })] }));
    expect(new Set(draft.routes.map((r) => r.key)).size).toBe(2);
  });
});

describe('hasDivergentLinks', () => {
  it('紐付けごとに label が違えば true', () => {
    const r = record({
      links: [
        { combo: 'inbound:inbound', label: 'A', isBaseline: true },
        { combo: 'inbound:outbound', label: 'B', isBaseline: true },
      ],
    });
    expect(hasDivergentLinks(r)).toBe(true);
  });

  it('紐付けごとに isBaseline が違えば true', () => {
    const r = record({
      links: [
        { combo: 'inbound:inbound', label: 'A', isBaseline: true },
        { combo: 'inbound:outbound', label: 'A', isBaseline: false },
      ],
    });
    expect(hasDivergentLinks(r)).toBe(true);
  });

  it('そろっていれば false', () => {
    expect(hasDivergentLinks(record())).toBe(false);
  });
});

describe('toSaveInput', () => {
  it('label を trim し、空の備考は null にし、設備は種類の定義順に重複なく並べる', () => {
    const draft: PairDraft = {
      routes: [
        card({
          label: '  地上経由 ',
          notes: '  ',
          facilities: ['stairs', 'elevator', 'stairs'],
          combos: ['outbound:outbound', 'inbound:inbound'],
        }),
      ],
      connectionNotes: emptyNotes(),
    };
    const input = toSaveInput(draft);
    expect(input.routes[0]).toMatchObject({
      label: '地上経由',
      notes: null,
      facilities: ['elevator', 'stairs'],
      combos: ['inbound:inbound', 'outbound:outbound'],
    });
  });

  it('接続の備考は、ルートが適用されている組み合わせだけを送り、空は null にする', () => {
    const draft: PairDraft = {
      routes: [card({ combos: ['inbound:inbound', 'inbound:outbound'] })],
      connectionNotes: {
        ...emptyNotes(),
        'inbound:inbound': '備考あり',
        'outbound:outbound': '適用先が無いので捨てる',
      },
    };
    expect(toSaveInput(draft).connectionNotes).toEqual({
      'inbound:inbound': '備考あり',
      'inbound:outbound': null,
    });
  });

  it('ルートの順序を保つ（検証エラーの routeIndex とカードの対応のため）', () => {
    const draft: PairDraft = {
      routes: [card({ key: 'a', label: 'A' }), card({ key: 'b', label: 'B' })],
      connectionNotes: emptyNotes(),
    };
    expect(toSaveInput(draft).routes.map((r) => r.label)).toEqual(['A', 'B']);
  });

  it('読み込んだ下書きをそのまま保存入力にしても内容が変わらない', () => {
    const draft = draftFromContext(context({ routes: [record({ notes: 'n', minutes: 3 })] }));
    const input = toSaveInput(draft);
    expect(input.routes[0]).toMatchObject({ routeId: 'r1', minutes: 3, notes: 'n', isBaseline: true });
  });
});

describe('操作', () => {
  const base = (): PairDraft => ({ routes: [], connectionNotes: emptyNotes() });

  it('addRoute: 適用先は全方面、基準は未指定で追加する', () => {
    const next = addRoute(base(), 'n1');
    expect(next.routes).toHaveLength(1);
    expect(next.routes[0]).toMatchObject({ key: 'n1', routeId: null, combos: [...COMBO_KEYS], facilities: [] });
  });

  it('addRoute: 最初の1本は基準ルートにする', () => {
    expect(addRoute(base(), 'n1').routes[0]?.isBaseline).toBe(true);
    const second = addRoute(addRoute(base(), 'n1'), 'n2');
    expect(second.routes[1]?.isBaseline).toBe(false);
  });

  it('duplicateRoute: routeId は null、適用先は空、label は空にして複製する', () => {
    const draft: PairDraft = {
      routes: [card({ key: 'a', routeId: 'r1', label: 'X', isBaseline: true, facilities: ['elevator'], minutes: 3 })],
      connectionNotes: emptyNotes(),
    };
    const next = duplicateRoute(draft, 'a', 'b');
    expect(next.routes[1]).toMatchObject({
      key: 'b',
      routeId: null,
      label: '',
      isBaseline: false,
      facilities: ['elevator'],
      minutes: 3,
      combos: [],
    });
    expect(next.routes[0]?.routeId).toBe('r1');
  });

  it('removeRoute: 指定したカードだけ消す', () => {
    const draft: PairDraft = { routes: [card({ key: 'a' }), card({ key: 'b' })], connectionNotes: emptyNotes() };
    expect(removeRoute(draft, 'a').routes.map((r) => r.key)).toEqual(['b']);
  });

  it('updateRoute: 指定した項目だけ書き換える', () => {
    const draft: PairDraft = { routes: [card({ key: 'a' })], connectionNotes: emptyNotes() };
    expect(updateRoute(draft, 'a', { label: '北改札経由', minutes: 4 }).routes[0]).toMatchObject({
      label: '北改札経由',
      minutes: 4,
    });
  });

  it('toggleCombo: 適用先のチェックを付け外しする（COMBO_KEYS の順で保つ）', () => {
    const draft: PairDraft = { routes: [card({ key: 'a', combos: ['outbound:outbound'] })], connectionNotes: emptyNotes() };
    const on = toggleCombo(draft, 'a', 'inbound:inbound');
    expect(on.routes[0]?.combos).toEqual(['inbound:inbound', 'outbound:outbound']);
    expect(toggleCombo(on, 'a', 'outbound:outbound').routes[0]?.combos).toEqual(['inbound:inbound']);
  });

  it('toggleFacility: 設備を付け外しする（集合なので重複しない）', () => {
    const draft: PairDraft = { routes: [card({ key: 'a', facilities: ['elevator'] })], connectionNotes: emptyNotes() };
    const on = toggleFacility(draft, 'a', 'ramp');
    expect(on.routes[0]?.facilities).toEqual(['elevator', 'ramp']);
    expect(toggleFacility(on, 'a', 'elevator').routes[0]?.facilities).toEqual(['ramp']);
  });

  it('detachFromSharedRoute: routeId を null にする（共有先のルートは変わらない）', () => {
    const draft: PairDraft = { routes: [card({ key: 'a', routeId: 'r1' })], connectionNotes: emptyNotes() };
    expect(detachFromSharedRoute(draft, 'a').routes[0]?.routeId).toBeNull();
  });

  it('mergeIntoCandidate: routeId と中身を候補に付け替え、label と適用先は入力のまま', () => {
    const candidate: CandidateRoute = {
      routeId: 'rc',
      label: '候補の名前',
      minutes: 5,
      isOutdoor: false,
      requiresExitGate: false,
      requiresStaff: false,
      isOfficiallyGuided: false,
      notes: '候補の備考',
      facilities: ['elevator'],
      usedBy: 'x',
    };
    const draft: PairDraft = {
      routes: [card({ key: 'a', label: '自分の名前', facilities: ['elevator'], combos: ['inbound:inbound'] })],
      connectionNotes: emptyNotes(),
    };
    expect(mergeIntoCandidate(draft, 'a', candidate).routes[0]).toMatchObject({
      routeId: 'rc',
      label: '自分の名前',
      minutes: 5,
      notes: '候補の備考',
      facilities: ['elevator'],
      combos: ['inbound:inbound'],
    });
  });

  it('mergeCards: 2枚を1枚に統合し、適用先は和集合、統合元は消える', () => {
    const draft: PairDraft = {
      routes: [
        card({ key: 'a', combos: ['inbound:inbound'] }),
        card({ key: 'b', combos: ['outbound:outbound', 'inbound:inbound'] }),
      ],
      connectionNotes: emptyNotes(),
    };
    const next = mergeCards(draft, 'a', 'b');
    expect(next.routes.map((r) => r.key)).toEqual(['a']);
    expect(next.routes[0]?.combos).toEqual(['inbound:inbound', 'outbound:outbound']);
  });

  it('mergeCards: 保持側が routeId を持たず統合元が持つとき、統合元の routeId を引き継ぐ', () => {
    const draft: PairDraft = {
      routes: [card({ key: 'a', routeId: null }), card({ key: 'b', routeId: 'r9' })],
      connectionNotes: emptyNotes(),
    };
    expect(mergeCards(draft, 'a', 'b').routes[0]?.routeId).toBe('r9');
  });

  it('mergeCards: どちらかが基準ルートなら統合後も基準ルート', () => {
    const draft: PairDraft = {
      routes: [card({ key: 'a', isBaseline: false }), card({ key: 'b', isBaseline: true })],
      connectionNotes: emptyNotes(),
    };
    expect(mergeCards(draft, 'a', 'b').routes[0]?.isBaseline).toBe(true);
  });
});
