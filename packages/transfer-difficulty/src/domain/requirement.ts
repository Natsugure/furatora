// 乗換ルートの設備（種類の集合）から、ペルソナごとの「必要な行為」を導出する純粋関数。
// ペルソナ別の可否・必要な行為はデータとして保存せず、表示層でここから導出する
// （docs/domain/station-master-model.md「乗換難易度」）。Admin のプレビューと Web が同じ関数を使う。

// facility_types の code と一致させること（キャメルケース）。DB とこの定数の一致は
// 自動テストでは守れない（CI に DB が無い）ため、設備の種類を足すときは両方を直す
export const FACILITY_TYPE_CODES = [
  'sameFloor',
  'elevator',
  'ramp',
  'wheelchairEscalator',
  'escalator',
  'stairLift',
  'stairs',
] as const;

export type FacilityTypeCode = (typeof FACILITY_TYPE_CODES)[number];

export type Persona = 'stroller' | 'wheelchair';

export type Requirement =
  | 'as_is' // そのまま通れる
  | 'call_staff' // 係員を呼ぶ
  | 'fold_and_carry' // 畳んで抱える
  | 'lift' // 持ち上げる
  | 'assisted_by_staff' // 駅員複数名の介助
  | 'impossible'; // 通れない

export const PERSONA_LABEL: Record<Persona, string> = {
  stroller: 'ベビーカー',
  wheelchair: '車いす',
};

export const REQUIREMENT_LABEL: Record<Requirement, string> = {
  as_is: 'そのまま通れる',
  call_staff: '係員を呼ぶ',
  fold_and_carry: '畳んで抱える',
  lift: '持ち上げる',
  assisted_by_staff: '駅員複数名の介助',
  impossible: '通れない',
};

// 「重さ」の順序はペルソナごとに違う（畳んで抱える と 係員を呼ぶ は別軸）。
// この順序はこの関数の中だけに存在する。表示側で並べ替えに使わないこと
const WEIGHT: Record<Persona, readonly Requirement[]> = {
  stroller: ['as_is', 'fold_and_carry', 'lift', 'impossible'],
  wheelchair: ['as_is', 'call_staff', 'assisted_by_staff', 'impossible'],
};

const REQUIREMENT_BY_FACILITY: Record<FacilityTypeCode, Record<Persona, Requirement>> = {
  sameFloor: { stroller: 'as_is', wheelchair: 'as_is' },
  elevator: { stroller: 'as_is', wheelchair: 'as_is' },
  ramp: { stroller: 'as_is', wheelchair: 'as_is' },
  wheelchairEscalator: { stroller: 'fold_and_carry', wheelchair: 'call_staff' },
  escalator: { stroller: 'fold_and_carry', wheelchair: 'impossible' },
  stairLift: { stroller: 'impossible', wheelchair: 'call_staff' },
  stairs: { stroller: 'lift', wheelchair: 'assisted_by_staff' },
};

// ルート上の設備すべてを見て、そのペルソナにとって最も重い行為を返す。設備は集合なので順序に依存しない。
//
// 【空集合は null を返す】設備0件のルートは「設備未入力」を表す（ADR-0012）。
// 空集合に「最も重いものを選ぶ」を素直に適用すると「そのまま通れる」と読めるため、
// 導出せず null を返し、呼び出し側が「設備が未入力」と表示する。as_is に丸めないこと
export function requirementFor(
  persona: Persona,
  facilities: readonly FacilityTypeCode[],
): Requirement | null {
  if (facilities.length === 0) return null;
  const order = WEIGHT[persona];
  let heaviest: Requirement = 'as_is';
  for (const code of facilities) {
    const requirement = REQUIREMENT_BY_FACILITY[code][persona];
    if (order.indexOf(requirement) > order.indexOf(heaviest)) heaviest = requirement;
  }
  return heaviest;
}

// バリアフリールート = 必要な行為が「そのまま通れる」または「係員を呼ぶ」。
// null（設備未入力）はバリアフリールートに数えない（ADR-0012）
export function isBarrierFree(requirement: Requirement | null): boolean {
  return requirement === 'as_is' || requirement === 'call_staff';
}
