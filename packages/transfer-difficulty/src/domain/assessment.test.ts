import { describe, expect, it } from 'vitest';
import {
  assessRoutes,
  lightestRequirement,
  type FacilityTypeCode,
  type Persona,
  type RouteFacts,
} from './index';

const route = (
  id: string,
  facilities: FacilityTypeCode[],
  options: { minutes?: number | null; isBaseline?: boolean } = {},
): RouteFacts & { id: string } => ({
  id,
  facilities,
  minutes: options.minutes ?? null,
  isBaseline: options.isBaseline ?? false,
});

describe('lightestRequirement: 通行可能な行為のうち最も軽いもの', () => {
  it('ベビーカー: 畳んで抱える と 持ち上げる なら 畳んで抱える', () => {
    expect(lightestRequirement('stroller', ['lift', 'fold_and_carry'])).toBe('fold_and_carry');
  });

  it('車いす: 駅員複数名の介助 と 係員を呼ぶ なら 係員を呼ぶ', () => {
    expect(lightestRequirement('wheelchair', ['assisted_by_staff', 'call_staff'])).toBe('call_staff');
  });

  it('通れない と 設備未入力（null）は候補にしない', () => {
    expect(lightestRequirement('stroller', ['impossible', null, 'lift'])).toBe('lift');
  });

  it('候補が無ければ null', () => {
    expect(lightestRequirement('wheelchair', ['impossible', null])).toBeNull();
    expect(lightestRequirement('wheelchair', [])).toBeNull();
  });
});

describe('assessRoutes: 状態の分類', () => {
  it('ルート0本は未評価', () => {
    expect(assessRoutes('stroller', [])).toEqual({ kind: 'unevaluated' });
  });

  it('バリアフリールートが1本以上なら barrierFree（設備未入力のルートは含めない）', () => {
    const result = assessRoutes('wheelchair', [
      route('ev', ['elevator']),
      route('general', [], { isBaseline: true }),
    ]);
    expect(result.kind).toBe('barrierFree');
    if (result.kind !== 'barrierFree') return;
    expect(result.routes.map((r) => r.id)).toEqual(['ev']);
  });

  it('係員を呼ぶ ルートは車いすのバリアフリールートに数える', () => {
    const result = assessRoutes('wheelchair', [route('lift', ['stairLift'])]);
    expect(result.kind).toBe('barrierFree');
  });

  it('設備0件のルートはバリアフリールートに数えない（ADR-0012）', () => {
    const result = assessRoutes('stroller', [route('general', [])]);
    expect(result).toEqual({ kind: 'undetermined', lightest: null });
  });

  it('BF 0本で未入力があれば undetermined。入力済みの通行可能なルートの最も軽い行為を返す', () => {
    // 淡路町↔新御茶ノ水のベビーカー: 階段昇降機経由は通れない、一般経路は設備未入力
    const result = assessRoutes('stroller', [
      route('stairLift', ['elevator', 'ramp', 'stairLift']),
      route('general', [], { isBaseline: true }),
      route('stairs', ['stairs']),
    ]);
    expect(result).toEqual({ kind: 'undetermined', lightest: 'lift' });
  });

  it('霞ケ関型: 階段を持ち上げれば通れるが BF は無い → none＋持ち上げる', () => {
    expect(assessRoutes('stroller', [route('stairs', ['elevator', 'stairs'])]))
      .toEqual({ kind: 'none', lightest: 'lift' });
  });

  it('全ルートが通れない → none＋null', () => {
    expect(assessRoutes('wheelchair', [route('esc', ['escalator'])]))
      .toEqual({ kind: 'none', lightest: null });
  });

  it('BF ルートは所要時分の昇順で、未入力は末尾（必要な行為では並べない）', () => {
    const result = assessRoutes('wheelchair', [
      route('unknown', ['elevator']),
      route('slowAsIs', ['elevator'], { minutes: 9 }),
      route('fastStaff', ['stairLift'], { minutes: 4 }),
    ]);
    if (result.kind !== 'barrierFree') throw new Error(result.kind);
    expect(result.routes.map((r) => r.id)).toEqual(['fastStaff', 'slowAsIs', 'unknown']);
  });

  it('所要時分が同じなら元の順序を保つ', () => {
    const result = assessRoutes('stroller', [
      route('b', ['elevator'], { minutes: 3 }),
      route('a', ['sameFloor'], { minutes: 3 }),
    ]);
    if (result.kind !== 'barrierFree') throw new Error(result.kind);
    expect(result.routes.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('assessRoutes の detour: BF ルートの最短 − 基準ルート', () => {
  const detourMinutes = (persona: Persona, routes: RouteFacts[]) => {
    const result = assessRoutes(persona, routes);
    return result.kind === 'barrierFree' ? result.detour : null;
  };

  it('両方の所要時分があれば差を返す', () => {
    expect(detourMinutes('stroller', [
      route('general', ['stairs'], { minutes: 3, isBaseline: true }),
      route('ev', ['elevator'], { minutes: 7 }),
      route('ev2', ['elevator'], { minutes: 5 }),
    ])).toBe(2);
  });

  it('基準ルートがバリアフリーなら 0 になりうる', () => {
    expect(detourMinutes('stroller', [route('ev', ['elevator'], { minutes: 4, isBaseline: true })])).toBe(0);
  });

  it('基準ルートの所要時分が無ければ null', () => {
    expect(detourMinutes('stroller', [
      route('general', ['stairs'], { isBaseline: true }),
      route('ev', ['elevator'], { minutes: 7 }),
    ])).toBeNull();
  });

  it('基準ルートが無ければ null', () => {
    expect(detourMinutes('stroller', [route('ev', ['elevator'], { minutes: 7 })])).toBeNull();
  });

  it('所要時分のある BF ルートが無ければ null（設備未入力のルートは BF に数えない）', () => {
    expect(detourMinutes('stroller', [
      route('general', [], { minutes: 3, isBaseline: true }),
      route('ev', ['elevator']),
    ])).toBeNull();
  });
});
