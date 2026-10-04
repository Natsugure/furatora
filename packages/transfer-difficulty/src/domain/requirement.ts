// 乗換ルートの設備（種類の集合）から、ペルソナごとの「必要な行為」を導出する純粋関数。
// ペルソナ別の可否・必要な行為はデータとして保存せず、表示層でここから導出する
// （docs/domain/station-master-model.md「乗換難易度」）。Admin のプレビューと Web が同じ関数を使う。

import { FACILITY_TYPE_CODES, type FacilityTypeCode } from '@furatora/database/enums';

// 設備コードの一覧の正は @furatora/database/enums の FACILITY_TYPE_CODES で、facility_types は CHECK 制約で
// それに従う（ADR-0016）。利用側の import を変えないため再 export する（ADR-0015）
export { FACILITY_TYPE_CODES, type FacilityTypeCode };

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
// この順序はこのファイルの中だけに存在する（requirementFor / lightestRequirement）。export して表示側の並べ替えに使わないこと
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
// 【空集合は null を返す。as_is に丸めないこと】設備0件は「設備未入力」で、呼び出し側が未入力と表示する（ADR-0012）
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

// 通行可能な行為（「通れない」と null＝設備未入力を除く）のうち、そのペルソナにとって最も軽いものを返す。無ければ null。
// バリアフリールートが無いときに「最も軽い方法」として示す（docs/domain「乗換難易度」の表示の規則）
export function lightestRequirement(
  persona: Persona,
  requirements: readonly (Requirement | null)[],
): Requirement | null {
  const order = WEIGHT[persona];
  let lightest: Requirement | null = null;
  for (const requirement of requirements) {
    if (requirement === null || requirement === 'impossible') continue;
    if (lightest === null || order.indexOf(requirement) < order.indexOf(lightest)) lightest = requirement;
  }
  return lightest;
}
