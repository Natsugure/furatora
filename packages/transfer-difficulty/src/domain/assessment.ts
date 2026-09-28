// 1つの接続（方面の組み合わせ）のルート群を、ペルソナごとの表示の状態に分類する純粋関数。
// 規則は docs/domain/station-master-model.md「乗換難易度」の表示の規則。Web の駅詳細（#125）が使う。
import {
  isBarrierFree,
  lightestRequirement,
  requirementFor,
  type FacilityTypeCode,
  type Persona,
  type Requirement,
} from './requirement';

export type RouteFacts = {
  minutes: number | null;
  isBaseline: boolean;
  facilities: readonly FacilityTypeCode[];
};

/** 設備が入力済みのルートと、そのペルソナにとっての必要な行為（設備が入力済みなので null にならない） */
export type AssessedRoute<R extends RouteFacts> = { route: R; requirement: Requirement };

export type Assessment<R extends RouteFacts> =
  // ルートが0本（接続行が無い）
  | { kind: 'unevaluated' }
  // バリアフリールートが1本以上。所要時分の昇順・未入力は末尾。
  // 設備未入力のルートがあっても利用者には出さない（補完は管理者の作業。Admin で一覧する: #135）。
  // detour（迂回度）= routes の先頭（最短）の所要時分 − 基準ルートの所要時分。どちらかが無ければ null。
  // 差には距離の差と移動速度の差が混ざるので、表示では必要な行為と並べること
  | { kind: 'barrierFree'; routes: AssessedRoute<R>[]; detour: number | null }
  // バリアフリールートは0本だが、設備未入力のルートがあるので「無い」とは言えない。
  // lightest は設備が入力済みのルートだけから選ぶ（未入力のルートの方が軽い可能性がある）
  | { kind: 'undetermined'; lightest: Requirement | null }
  // 全ルートの設備が入力済みで、バリアフリールートが0本
  | { kind: 'none'; lightest: Requirement | null };

// 【所要時分以外で並べ替えないこと】「畳んで抱える」と「係員を呼ぶ」のどちらが軽いかは利用者によって逆転する。
// Array.prototype.sort は安定なので、所要時分が同じルートは入力の順序を保つ
function byMinutes<R extends RouteFacts>(routes: readonly AssessedRoute<R>[]): AssessedRoute<R>[] {
  return [...routes].sort(({ route: x }, { route: y }) => {
    if (x.minutes === y.minutes) return 0;
    if (x.minutes === null) return 1;
    if (y.minutes === null) return -1;
    return x.minutes - y.minutes;
  });
}

export function assessRoutes<R extends RouteFacts>(persona: Persona, routes: readonly R[]): Assessment<R> {
  if (routes.length === 0) return { kind: 'unevaluated' };

  // 設備0件のルートは導出せず（requirementFor が null を返す）、バリアフリールートにも数えない（ADR-0012）
  const assessed = routes.flatMap((route): AssessedRoute<R>[] => {
    const requirement = requirementFor(persona, route.facilities);
    return requirement === null ? [] : [{ route, requirement }];
  });
  const hasNotEntered = assessed.length < routes.length;
  const barrierFree = assessed.filter(({ requirement }) => isBarrierFree(requirement));

  if (barrierFree.length > 0) {
    const sorted = byMinutes(barrierFree);
    return { kind: 'barrierFree', routes: sorted, detour: detourOf(sorted[0]!.route, routes) };
  }
  const lightest = lightestRequirement(persona, assessed.map(({ requirement }) => requirement));
  if (hasNotEntered) return { kind: 'undetermined', lightest };
  return { kind: 'none', lightest };
}

function detourOf(shortest: RouteFacts, routes: readonly RouteFacts[]): number | null {
  const baseline = routes.find((route) => route.isBaseline);
  if (!baseline || baseline.minutes === null || shortest.minutes === null) return null;
  return shortest.minutes - baseline.minutes;
}
