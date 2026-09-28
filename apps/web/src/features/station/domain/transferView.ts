import { requirementFor, type DirectionType, type Persona } from '@furatora/transfer-difficulty/domain';
import type { TransferComboDTO, TransferPartnerDTO, TransferRouteDTO } from './types';

// 乗換セクションの表示の組み立て（純関数・DB非依存）。
// 必要な行為・状態の分類は @furatora/transfer-difficulty/domain の規則を使い、ここでは書き直さない。

/** 同じルートの組・同じ接続の備考を持つ方面の組み合わせのまとまり */
export type ComboGroup = {
  /** 全組み合わせが1グループのときは null（方面を出さない） */
  heading: string | null;
  /** 空 = 未評価の組み合わせのまとまり */
  routes: TransferRouteDTO[];
  notes: string | null;
};

const DIRECTIONS: readonly DirectionType[] = ['inbound', 'outbound'];
const ALL_COMBOS = DIRECTIONS.flatMap((s) => DIRECTIONS.map((t) => [s, t] as const));

// ルートはルート本体だけでなく label・isBaseline（紐付けの属性）も含めて比べる。
// ルートの並び順は意味を持たないので、routeId で並べてから比べる
function signatureOf(combo: TransferComboDTO): string {
  const routes = [...combo.routes]
    .sort((x, y) => x.routeId.localeCompare(y.routeId))
    .map((r) => [r.routeId, r.label, r.isBaseline]);
  return JSON.stringify([routes, combo.notes]);
}

function headingOf(partner: TransferPartnerDTO, keys: readonly (readonly [DirectionType, DirectionType])[]): string {
  const stationLabel = (d: DirectionType) => `${partner.stationLineName} ${partner.directionLabels.station[d]}`;
  const connectedLabel = (d: DirectionType) => `${partner.lineName} ${partner.directionLabels.connected[d]}`;
  const stationDirections = new Set(keys.map(([s]) => s));
  const connectedDirections = new Set(keys.map(([, t]) => t));
  // 自駅の方面1つで決まる（相手駅の両方面を含む）→ 自駅の方面だけを出す
  if (stationDirections.size === 1 && connectedDirections.size === 2) return stationLabel(keys[0]![0]);
  if (connectedDirections.size === 1 && stationDirections.size === 2) return connectedLabel(keys[0]![1]);
  return keys.map(([s, t]) => `${stationLabel(s)} → ${connectedLabel(t)}`).join('、');
}

export function groupCombos(partner: TransferPartnerDTO): ComboGroup[] {
  if (partner.combos.length === 0) return [{ heading: null, routes: [], notes: null }];

  // ルートの組と備考は同じシグネチャ内で等しいので、最初の組み合わせのものを持つ
  const groups: { keys: (readonly [DirectionType, DirectionType])[]; combo: TransferComboDTO }[] = [];
  const bySignature = new Map<string, (typeof groups)[number]>();
  const missing: (readonly [DirectionType, DirectionType])[] = [];
  for (const key of ALL_COMBOS) {
    const combo = partner.combos.find((c) => c.stationDirection === key[0] && c.connectedDirection === key[1]);
    if (!combo) {
      missing.push(key);
      continue;
    }
    const signature = signatureOf(combo);
    const group = bySignature.get(signature);
    if (group) {
      group.keys.push(key);
    } else {
      const created = { keys: [key], combo };
      groups.push(created);
      bySignature.set(signature, created);
    }
  }

  const showHeading = groups.length > 1 || missing.length > 0;
  const result: ComboGroup[] = groups.map((g) => ({
    heading: showHeading ? headingOf(partner, g.keys) : null,
    routes: g.combo.routes,
    notes: g.combo.notes,
  }));
  if (missing.length > 0) {
    result.push({ heading: headingOf(partner, missing), routes: [], notes: null });
  }
  return result;
}

export type RouteField =
  | 'minutes'
  | 'requirement'
  | 'isOutdoor'
  | 'requiresExitGate'
  | 'requiresStaff'
  | 'isOfficiallyGuided';

/** バリアフリールートを並記するとき、ルートの間で値が異なる項目（強調表示の対象） */
export function differingFields(persona: Persona, routes: readonly TransferRouteDTO[]): Set<RouteField> {
  const valueOf: Record<RouteField, (r: TransferRouteDTO) => unknown> = {
    minutes: (r) => r.minutes,
    requirement: (r) => requirementFor(persona, r.facilities),
    isOutdoor: (r) => r.isOutdoor,
    requiresExitGate: (r) => r.requiresExitGate,
    requiresStaff: (r) => r.requiresStaff,
    isOfficiallyGuided: (r) => r.isOfficiallyGuided,
  };
  const fields = Object.keys(valueOf) as RouteField[];
  return new Set(fields.filter((field) => new Set(routes.map(valueOf[field])).size > 1));
}
