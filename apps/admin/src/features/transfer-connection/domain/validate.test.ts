import { describe, expect, it } from 'vitest';
import { collectWarnings, validateSaveInput } from './validate';
import { COMBO_KEYS, type PairSaveInput, type RouteInput } from './types';

function route(over: Partial<RouteInput> = {}): RouteInput {
  return {
    routeId: null,
    label: '地上経由',
    isBaseline: true,
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: false,
    notes: null,
    facilities: ['elevator'],
    combos: [...COMBO_KEYS],
    ...over,
  };
}

const input = (...routes: RouteInput[]): PairSaveInput => ({ routes, connectionNotes: {} });
const codes = (i: PairSaveInput) => validateSaveInput(i).map((e) => e.code);

describe('validateSaveInput（エラー。保存を拒否する）', () => {
  it('正常な入力（全方面共通の1本）はエラーなし', () => {
    expect(validateSaveInput(input(route()))).toEqual([]);
  });

  it('ルート0本（未評価）はエラーではない', () => {
    expect(validateSaveInput(input())).toEqual([]);
  });

  it('label が空（空白のみ）はエラー', () => {
    expect(codes(input(route({ label: '   ' })))).toContain('label_required');
  });

  it('label が100字を超えるとエラー', () => {
    expect(codes(input(route({ label: 'あ'.repeat(101) })))).toContain('label_too_long');
    expect(codes(input(route({ label: 'あ'.repeat(100) })))).not.toContain('label_too_long');
  });

  it('適用先の方面の組み合わせが無いとエラー', () => {
    expect(codes(input(route({ combos: [] })))).toContain('combo_required');
  });

  it('所要時分は0以上の整数のみ（負・小数・smallint 超過はエラー、null は可）', () => {
    expect(codes(input(route({ minutes: -1 })))).toContain('minutes_invalid');
    expect(codes(input(route({ minutes: 1.5 })))).toContain('minutes_invalid');
    expect(codes(input(route({ minutes: 32768 })))).toContain('minutes_invalid');
    expect(codes(input(route({ minutes: 0 })))).not.toContain('minutes_invalid');
    expect(codes(input(route({ minutes: null })))).not.toContain('minutes_invalid');
  });

  it('同じ組み合わせの中で label が重複するとエラー（どのカードかを指す）', () => {
    const issues = validateSaveInput(
      input(route({ label: 'A', isBaseline: true }), route({ label: 'A', isBaseline: false })),
    );
    const dup = issues.filter((e) => e.code === 'label_duplicate');
    expect(dup.length).toBeGreaterThan(0);
    expect(dup.map((e) => e.routeIndex)).toContain(1);
  });

  it('label が同じでも組み合わせが重ならなければ重複ではない（淡路町型）', () => {
    const a = route({ label: 'A', combos: ['inbound:inbound', 'inbound:outbound'] });
    const b = route({ label: 'A', combos: ['outbound:inbound', 'outbound:outbound'] });
    expect(codes(input(a, b))).not.toContain('label_duplicate');
  });

  it('label の重複は前後の空白を無視して判定する', () => {
    const issues = codes(input(route({ label: 'A ' , isBaseline: true }), route({ label: ' A', isBaseline: false })));
    expect(issues).toContain('label_duplicate');
  });

  it('同じ組み合わせに基準ルートが2本あるとエラー', () => {
    const issues = codes(input(route({ label: 'A', isBaseline: true }), route({ label: 'B', isBaseline: true })));
    expect(issues).toContain('baseline_duplicate');
  });

  it('基準ルートが2本でも組み合わせが重ならなければエラーではない', () => {
    const a = route({ label: 'A', combos: ['inbound:inbound'] });
    const b = route({ label: 'B', combos: ['outbound:outbound'] });
    expect(codes(input(a, b))).not.toContain('baseline_duplicate');
  });

  it('同じ routeId のカードが2枚あるとエラー（統合し忘れ）', () => {
    const a = route({ routeId: 'r1', label: 'A', combos: ['inbound:inbound'], isBaseline: false });
    const b = route({ routeId: 'r1', label: 'B', combos: ['outbound:outbound'], isBaseline: false });
    expect(codes(input(a, b))).toContain('route_id_duplicate');
  });

  it('複数の違反を同時に返す', () => {
    const list = codes(input(route({ label: '', combos: [] })));
    expect(list).toEqual(expect.arrayContaining(['label_required', 'combo_required']));
  });
});

describe('collectWarnings（警告。保存は止めない）', () => {
  it('ルートがあるのに基準ルートが無い組み合わせを警告する', () => {
    const w = collectWarnings(input(route({ isBaseline: false, combos: ['inbound:inbound'] })));
    expect(w).toEqual([expect.objectContaining({ code: 'no_baseline', combo: 'inbound:inbound' })]);
  });

  it('基準ルートがあれば警告しない', () => {
    expect(collectWarnings(input(route()))).toEqual([]);
  });

  it('ルートが無い組み合わせ（未評価）は警告しない', () => {
    expect(collectWarnings(input())).toEqual([]);
  });

  it('階段と階段昇降機が同じルートにあると、代替手段の同居を警告する', () => {
    const w = collectWarnings(input(route({ facilities: ['stairs', 'stairLift'] })));
    expect(w).toEqual([expect.objectContaining({ code: 'alternative_facilities', routeIndex: 0 })]);
  });

  it('階段と車いす対応エスカレーターの同居は警告しない（重い方の記録の省略として許容）', () => {
    expect(collectWarnings(input(route({ facilities: ['stairs', 'wheelchairEscalator'] })))).toEqual([]);
  });
});
