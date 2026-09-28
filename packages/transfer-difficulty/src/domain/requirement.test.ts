import { describe, expect, it } from 'vitest';
import {
  FACILITY_TYPE_CODES,
  isBarrierFree,
  requirementFor,
  type FacilityTypeCode,
  type Persona,
  type Requirement,
} from './index';

describe('requirementFor: 設備1種ごとの導出表', () => {
  const table: Record<FacilityTypeCode, Record<Persona, Requirement>> = {
    sameFloor: { stroller: 'as_is', wheelchair: 'as_is' },
    elevator: { stroller: 'as_is', wheelchair: 'as_is' },
    ramp: { stroller: 'as_is', wheelchair: 'as_is' },
    wheelchairEscalator: { stroller: 'fold_and_carry', wheelchair: 'call_staff' },
    escalator: { stroller: 'fold_and_carry', wheelchair: 'impossible' },
    stairLift: { stroller: 'impossible', wheelchair: 'call_staff' },
    stairs: { stroller: 'lift', wheelchair: 'assisted_by_staff' },
  };

  it('7種すべてを表で網羅している', () => {
    expect(Object.keys(table).sort()).toEqual([...FACILITY_TYPE_CODES].sort());
  });

  for (const code of FACILITY_TYPE_CODES) {
    for (const persona of ['stroller', 'wheelchair'] as const) {
      it(`${code} / ${persona} は ${table[code][persona]}`, () => {
        expect(requirementFor(persona, [code])).toBe(table[code][persona]);
      });
    }
  }
});

describe('requirementFor: 最も重い行為を選ぶ', () => {
  it('ベビーカー: エレベーターと階段なら持ち上げる', () => {
    expect(requirementFor('stroller', ['elevator', 'stairs'])).toBe('lift');
  });

  it('ベビーカー: 階段昇降機が1つでもあれば通れない（階段より重い）', () => {
    expect(requirementFor('stroller', ['stairs', 'stairLift'])).toBe('impossible');
  });

  it('ベビーカー: 車いす対応エスカレーターは畳んで抱える（エレベーターより重い）', () => {
    expect(requirementFor('stroller', ['elevator', 'wheelchairEscalator'])).toBe('fold_and_carry');
  });

  it('車いす: 階段昇降機と車いす対応エスカレーターは係員を呼ぶ', () => {
    expect(requirementFor('wheelchair', ['stairLift', 'wheelchairEscalator'])).toBe('call_staff');
  });

  it('車いす: 階段があれば駅員複数名の介助（係員を呼ぶより重い）', () => {
    expect(requirementFor('wheelchair', ['stairLift', 'stairs'])).toBe('assisted_by_staff');
  });

  it('車いす: エスカレーターがあれば通れない', () => {
    expect(requirementFor('wheelchair', ['stairs', 'escalator'])).toBe('impossible');
  });

  it('順序に依存しない', () => {
    expect(requirementFor('stroller', ['stairs', 'elevator'])).toBe(
      requirementFor('stroller', ['elevator', 'stairs']),
    );
  });

  it('#123 の淡路町↔新御茶ノ水の階段昇降機経由（elevator, ramp, stairLift）: ベビーカーは通れず、車いすは係員を呼ぶ', () => {
    const facilities: FacilityTypeCode[] = ['elevator', 'ramp', 'stairLift'];
    expect(requirementFor('stroller', facilities)).toBe('impossible');
    expect(requirementFor('wheelchair', facilities)).toBe('call_staff');
  });
});

describe('requirementFor: 設備0件は「未入力」（ADR-0012）', () => {
  it('空集合はそのまま通れる（as_is）と読まず null を返す', () => {
    expect(requirementFor('stroller', [])).toBeNull();
    expect(requirementFor('wheelchair', [])).toBeNull();
  });
});

describe('isBarrierFree', () => {
  it('as_is と call_staff はバリアフリールート', () => {
    expect(isBarrierFree('as_is')).toBe(true);
    expect(isBarrierFree('call_staff')).toBe(true);
  });

  it('畳んで抱える・持ち上げる・駅員複数名の介助・通れないはバリアフリールートではない', () => {
    expect(isBarrierFree('fold_and_carry')).toBe(false);
    expect(isBarrierFree('lift')).toBe(false);
    expect(isBarrierFree('assisted_by_staff')).toBe(false);
    expect(isBarrierFree('impossible')).toBe(false);
  });

  it('null（設備未入力）はバリアフリールートに数えない', () => {
    expect(isBarrierFree(null)).toBe(false);
  });
});
