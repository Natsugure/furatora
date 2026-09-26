import { describe, expect, it } from 'vitest';
import type { CandidateRoute, PairRouteRecord } from '../ports';
import { applyDuplicateChoices, findDuplicates, matchKey } from './duplicates';
import { COMBO_KEYS, type PairDraft, type RouteDraft } from './types';

function card(over: Partial<RouteDraft> = {}): RouteDraft {
  return {
    key: 'k1',
    routeId: null,
    label: 'A',
    isBaseline: false,
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: false,
    notes: '',
    facilities: ['elevator'],
    combos: [...COMBO_KEYS],
    ...over,
  };
}

function candidate(over: Partial<CandidateRoute> = {}): CandidateRoute {
  return {
    routeId: 'rc',
    label: '他の駅対のルート',
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: false,
    notes: null,
    facilities: ['elevator'],
    usedBy: '池袋 ↔ 池袋',
    ...over,
  };
}

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
    links: [],
    sharedWith: [],
    ...over,
  };
}

const draftOf = (...routes: RouteDraft[]): PairDraft => ({
  routes,
  connectionNotes: Object.fromEntries(COMBO_KEYS.map((c) => [c, ''])) as PairDraft['connectionNotes'],
});

describe('findDuplicates: 候補ルートとの一致', () => {
  it('新規カードが、設備の集合と4フラグの一致する候補を持つと検出する', () => {
    const matches = findDuplicates(draftOf(card()), [], [candidate()]);
    expect(matches).toEqual([
      expect.objectContaining({ kind: 'candidate', key: 'k1', candidate: expect.objectContaining({ routeId: 'rc' }) }),
    ]);
  });

  it('設備の集合が違えば検出しない', () => {
    expect(findDuplicates(draftOf(card({ facilities: ['elevator', 'ramp'] })), [], [candidate()])).toEqual([]);
  });

  it('設備の並び順が違っても、集合が同じなら検出する', () => {
    const matches = findDuplicates(
      draftOf(card({ facilities: ['stairs', 'elevator'] })),
      [],
      [candidate({ facilities: ['elevator', 'stairs'] })],
    );
    expect(matches).toHaveLength(1);
  });

  it('4フラグのどれかが違えば検出しない', () => {
    for (const flag of ['isOutdoor', 'requiresExitGate', 'requiresStaff', 'isOfficiallyGuided'] as const) {
      expect(findDuplicates(draftOf(card({ [flag]: true })), [], [candidate()])).toEqual([]);
    }
  });

  it('所要時分・備考・label が違っても、設備とフラグが同じなら検出する', () => {
    const matches = findDuplicates(
      draftOf(card({ label: '別の名前', minutes: 5, notes: 'メモ' })),
      [],
      [candidate({ minutes: 3, notes: '別のメモ' })],
    );
    expect(matches).toHaveLength(1);
  });

  it('設備0件（設備未入力）は検出の対象外（ADR-0012）', () => {
    expect(findDuplicates(draftOf(card({ facilities: [] })), [], [candidate({ facilities: [] })])).toEqual([]);
  });

  it('候補の設備が0件なら、設備のあるカードとは一致しない', () => {
    expect(findDuplicates(draftOf(card()), [], [candidate({ facilities: [] })])).toEqual([]);
  });

  it('自分自身と同じ routeId の候補は除外する', () => {
    const drafts = draftOf(card({ routeId: 'rc', facilities: ['ramp'] }));
    expect(findDuplicates(drafts, [record({ routeId: 'rc' })], [candidate({ routeId: 'rc', facilities: ['ramp'] })])).toEqual([]);
  });
});

describe('findDuplicates: 既存カードは内容が変わったときだけ検査する', () => {
  it('変更の無い既存ルートは、候補と同じ内容でも検出しない', () => {
    const drafts = draftOf(card({ routeId: 'r1' }));
    expect(findDuplicates(drafts, [record({ routeId: 'r1' })], [candidate()])).toEqual([]);
  });

  it('設備を変えて候補と一致したら検出する', () => {
    const drafts = draftOf(card({ routeId: 'r1', facilities: ['elevator'] }));
    const matches = findDuplicates(drafts, [record({ routeId: 'r1', facilities: ['stairs'] })], [candidate()]);
    expect(matches).toHaveLength(1);
  });

  it('フラグを変えて候補と一致したら検出する', () => {
    const drafts = draftOf(card({ routeId: 'r1', isOutdoor: true }));
    const matches = findDuplicates(
      drafts,
      [record({ routeId: 'r1', isOutdoor: false })],
      [candidate({ isOutdoor: true })],
    );
    expect(matches).toHaveLength(1);
  });

  it('所要時分や備考だけの変更は「内容の変更」に数えない', () => {
    const drafts = draftOf(card({ routeId: 'r1', minutes: 9, notes: 'x' }));
    expect(findDuplicates(drafts, [record({ routeId: 'r1' })], [candidate()])).toEqual([]);
  });
});

describe('findDuplicates: 同じ画面のカードどうし', () => {
  it('新規カード2枚が同じ内容なら、後ろのカードを前のカードへ統合する検出になる', () => {
    const matches = findDuplicates(draftOf(card({ key: 'a' }), card({ key: 'b', label: 'B' })), [], []);
    expect(matches).toEqual([expect.objectContaining({ kind: 'card', key: 'b', otherKey: 'a' })]);
  });

  it('新規カードと変更の無い既存カードが同じ内容なら、既存カード（routeId あり）を残す側にする', () => {
    const drafts = draftOf(card({ key: 'new' }), card({ key: 'old', routeId: 'r1' }));
    const matches = findDuplicates(drafts, [record({ routeId: 'r1' })], []);
    expect(matches).toEqual([expect.objectContaining({ kind: 'card', key: 'new', otherKey: 'old' })]);
  });

  it('どちらも変更の無い既存カードどうしは検出しない（既に別ルートとして存在している）', () => {
    const drafts = draftOf(card({ key: 'a', routeId: 'r1' }), card({ key: 'b', routeId: 'r2' }));
    expect(findDuplicates(drafts, [record({ routeId: 'r1' }), record({ routeId: 'r2' })], [])).toEqual([]);
  });

  it('設備0件のカードどうしは検出しない', () => {
    expect(findDuplicates(draftOf(card({ key: 'a', facilities: [] }), card({ key: 'b', facilities: [] })), [], [])).toEqual([]);
  });

  it('内容が違えば検出しない', () => {
    expect(findDuplicates(draftOf(card({ key: 'a' }), card({ key: 'b', facilities: ['ramp'] })), [], [])).toEqual([]);
  });
});

describe('matchKey', () => {
  it('同じ検出は同じキー、別の検出は別のキーになる', () => {
    const [m1] = findDuplicates(draftOf(card()), [], [candidate({ routeId: 'r-a' })]);
    const [m2] = findDuplicates(draftOf(card()), [], [candidate({ routeId: 'r-b' })]);
    expect(m1 && m2 && matchKey(m1)).not.toBe(m1 && m2 && matchKey(m2));
    const [again] = findDuplicates(draftOf(card()), [], [candidate({ routeId: 'r-a' })]);
    expect(m1 && again && matchKey(m1)).toBe(m1 && again && matchKey(again));
  });
});

describe('applyDuplicateChoices', () => {
  it('候補を「共有する」と、カードの routeId が候補に付け替わり、中身も候補のものになる', () => {
    const draft = draftOf(card({ minutes: 9 }));
    const matches = findDuplicates(draft, [], [candidate({ minutes: 3, notes: '候補の備考' })]);
    const next = applyDuplicateChoices(draft, matches, { [matchKey(matches[0]!)]: 'share' });
    expect(next.routes[0]).toMatchObject({ routeId: 'rc', minutes: 3, notes: '候補の備考' });
  });

  it('「別ルートとして作る」を選んだ検出は、下書きを変えない', () => {
    const draft = draftOf(card());
    const matches = findDuplicates(draft, [], [candidate()]);
    expect(applyDuplicateChoices(draft, matches, { [matchKey(matches[0]!)]: 'separate' })).toEqual(draft);
  });

  it('選択が無い検出は、下書きを変えない', () => {
    const draft = draftOf(card());
    expect(applyDuplicateChoices(draft, findDuplicates(draft, [], [candidate()]), {})).toEqual(draft);
  });

  it('カードどうしを「共有する」と、2枚が1枚になり、適用先は和集合、routeId は残す側のもの', () => {
    const draft = draftOf(
      card({ key: 'new', combos: ['inbound:inbound'] }),
      card({ key: 'old', routeId: 'r1', combos: ['outbound:outbound'] }),
    );
    const matches = findDuplicates(draft, [record({ routeId: 'r1' })], []);
    const next = applyDuplicateChoices(draft, matches, { [matchKey(matches[0]!)]: 'share' });
    expect(next.routes).toHaveLength(1);
    expect(next.routes[0]).toMatchObject({ key: 'old', routeId: 'r1', combos: ['inbound:inbound', 'outbound:outbound'] });
  });

  it('すでに統合で消えたカードを含む検出は、無視して壊さない', () => {
    // a・b・c が同一内容: 検出は (b→a) と (c→a)。両方を「共有する」にしても、3枚が1枚になるだけ
    const draft = draftOf(card({ key: 'a' }), card({ key: 'b', label: 'B' }), card({ key: 'c', label: 'C' }));
    const matches = findDuplicates(draft, [], []);
    const choices = Object.fromEntries(matches.map((m) => [matchKey(m), 'share' as const]));
    const next = applyDuplicateChoices(draft, matches, choices);
    expect(next.routes.map((r) => r.key)).toEqual(['a']);
  });
});
