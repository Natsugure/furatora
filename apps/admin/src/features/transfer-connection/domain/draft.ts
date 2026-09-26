import { FACILITY_TYPE_CODES, type FacilityTypeCode } from '@furatora/transfer-difficulty/domain';
import type { CandidateRoute, PairRouteRecord, TransferPairEditContext } from '../ports';
import {
  COMBO_KEYS,
  type ComboKey,
  type PairDraft,
  type PairSaveInput,
  type RouteDraft,
} from './types';

// 駅対の編集画面（TransferPairEditor）が保持する未保存 state の純関数。
// Next.js・DB 非依存なので node 環境でテストできる。操作はすべてイミュータブル。

const comboIndex = (combo: ComboKey) => COMBO_KEYS.indexOf(combo);
const sortCombos = (combos: readonly ComboKey[]): ComboKey[] =>
  [...new Set(combos)].sort((x, y) => comboIndex(x) - comboIndex(y));

const facilityIndex = (code: FacilityTypeCode) => FACILITY_TYPE_CODES.indexOf(code);
const sortFacilities = (facilities: readonly FacilityTypeCode[]): FacilityTypeCode[] =>
  [...new Set(facilities)].sort((x, y) => facilityIndex(x) - facilityIndex(y));

// 同じルートの紐付けで label / isBaseline が組み合わせごとに違うか（docs/domain「Admin の書き込み規約」）。
// 画面はこれが true のとき警告を出す
export function hasDivergentLinks(record: PairRouteRecord): boolean {
  const first = record.links[0];
  if (!first) return false;
  return record.links.some((l) => l.label !== first.label || l.isBaseline !== first.isBaseline);
}

export function draftFromContext(context: TransferPairEditContext): PairDraft {
  const routes = context.routes.map((record): RouteDraft => {
    const links = [...record.links].sort((x, y) => comboIndex(x.combo) - comboIndex(y.combo));
    const first = links[0];
    return {
      key: `existing-${record.routeId}`,
      routeId: record.routeId,
      label: first?.label ?? '',
      isBaseline: first?.isBaseline ?? false,
      minutes: record.minutes,
      isOutdoor: record.isOutdoor,
      requiresExitGate: record.requiresExitGate,
      requiresStaff: record.requiresStaff,
      isOfficiallyGuided: record.isOfficiallyGuided,
      notes: record.notes ?? '',
      facilities: sortFacilities(record.facilities),
      combos: links.map((l) => l.combo),
    };
  });
  routes.sort((x, y) => {
    // 先頭の組み合わせ → 基準ルート → 名前の順。基準ルート（一般利用者が案内される経路）を、
    // 名前順に埋もれさせず先頭に置く
    const byCombo = comboIndex(x.combos[0] ?? COMBO_KEYS[0]!) - comboIndex(y.combos[0] ?? COMBO_KEYS[0]!);
    if (byCombo !== 0) return byCombo;
    if (x.isBaseline !== y.isBaseline) return x.isBaseline ? -1 : 1;
    return x.label.localeCompare(y.label, 'ja');
  });

  const connectionNotes = Object.fromEntries(COMBO_KEYS.map((c) => [c, ''])) as PairDraft['connectionNotes'];
  for (const connection of context.connections) {
    connectionNotes[connection.combo] = connection.notes ?? '';
  }
  return { routes, connectionNotes };
}

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

export function toSaveInput(draft: PairDraft): PairSaveInput {
  const covered = new Set<ComboKey>();
  const routes = draft.routes.map((r) => {
    const combos = sortCombos(r.combos);
    for (const c of combos) covered.add(c);
    return {
      routeId: r.routeId,
      label: r.label.trim(),
      isBaseline: r.isBaseline,
      minutes: r.minutes,
      isOutdoor: r.isOutdoor,
      requiresExitGate: r.requiresExitGate,
      requiresStaff: r.requiresStaff,
      isOfficiallyGuided: r.isOfficiallyGuided,
      notes: blankToNull(r.notes),
      facilities: sortFacilities(r.facilities),
      combos,
    };
  });
  // ルートが適用されていない組み合わせは接続行を作らない（未評価）ので、備考も送らない
  const connectionNotes: PairSaveInput['connectionNotes'] = {};
  for (const combo of COMBO_KEYS) {
    if (covered.has(combo)) connectionNotes[combo] = blankToNull(draft.connectionNotes[combo]);
  }
  return { routes, connectionNotes };
}

// ---- 操作 ----

const mapRoute = (draft: PairDraft, key: string, fn: (route: RouteDraft) => RouteDraft): PairDraft => ({
  ...draft,
  routes: draft.routes.map((r) => (r.key === key ? fn(r) : r)),
});

// 新規カードの適用先は全方面（「全方面共通」）。方面差の駅は入力者がチェックを外して別のカードに割り振る。
// 最初の1本は基準ルート（一般利用者が案内される経路）にする
export function addRoute(draft: PairDraft, key: string): PairDraft {
  const route: RouteDraft = {
    key,
    routeId: null,
    label: '',
    isBaseline: draft.routes.length === 0,
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: false,
    notes: '',
    facilities: [],
    combos: [...COMBO_KEYS],
  };
  return { ...draft, routes: [...draft.routes, route] };
}

// 複製は「方面ごとに分ける」ための操作。新ルート（routeId なし）にし、label と適用先は空にして、
// 入力者が割り振る。label を空にするのは、同じ組み合わせに同名が並ぶ事故を避けるため
export function duplicateRoute(draft: PairDraft, sourceKey: string, newKey: string): PairDraft {
  const source = draft.routes.find((r) => r.key === sourceKey);
  if (!source) return draft;
  const copy: RouteDraft = {
    ...source,
    key: newKey,
    routeId: null,
    label: '',
    isBaseline: false,
    facilities: [...source.facilities],
    combos: [],
  };
  return { ...draft, routes: [...draft.routes, copy] };
}

export function removeRoute(draft: PairDraft, key: string): PairDraft {
  return { ...draft, routes: draft.routes.filter((r) => r.key !== key) };
}

export function updateRoute(
  draft: PairDraft,
  key: string,
  patch: Partial<Omit<RouteDraft, 'key'>>,
): PairDraft {
  return mapRoute(draft, key, (r) => ({ ...r, ...patch }));
}

export function toggleCombo(draft: PairDraft, key: string, combo: ComboKey): PairDraft {
  return mapRoute(draft, key, (r) => ({
    ...r,
    combos: r.combos.includes(combo) ? r.combos.filter((c) => c !== combo) : sortCombos([...r.combos, combo]),
  }));
}

export function toggleFacility(draft: PairDraft, key: string, code: FacilityTypeCode): PairDraft {
  return mapRoute(draft, key, (r) => ({
    ...r,
    facilities: r.facilities.includes(code)
      ? r.facilities.filter((c) => c !== code)
      : sortFacilities([...r.facilities, code]),
  }));
}

// 共有中のルートを、この駅対だけの新ルートにする。共有先のルート行は変わらない
export function detachFromSharedRoute(draft: PairDraft, key: string): PairDraft {
  return mapRoute(draft, key, (r) => ({ ...r, routeId: null }));
}

// 「既存ルートを共有する」: 候補のルートに付け替える。ルート本体の値は候補のものを採る
// （保存でそのルートを UPDATE するため、食い違ったまま送ると共有先の値を上書きしてしまう）。
// label と適用先は、この駅対での役割なので入力のまま
export function mergeIntoCandidate(draft: PairDraft, key: string, candidate: CandidateRoute): PairDraft {
  return mapRoute(draft, key, (r) => ({
    ...r,
    routeId: candidate.routeId,
    minutes: candidate.minutes,
    isOutdoor: candidate.isOutdoor,
    requiresExitGate: candidate.requiresExitGate,
    requiresStaff: candidate.requiresStaff,
    isOfficiallyGuided: candidate.isOfficiallyGuided,
    notes: candidate.notes ?? '',
    facilities: sortFacilities(candidate.facilities),
  }));
}

// 同じ画面の2枚が同一の経路だと分かったときの統合。適用先は和集合、基準ルートはどちらかが真なら真。
// 統合の結果、同じ組み合わせに基準ルートが2本になる等の違反は、保存時の検証が拒否する
export function mergeCards(draft: PairDraft, keepKey: string, dropKey: string): PairDraft {
  const drop = draft.routes.find((r) => r.key === dropKey);
  if (!drop || keepKey === dropKey) return draft;
  return {
    ...draft,
    routes: draft.routes
      .filter((r) => r.key !== dropKey)
      .map((r) =>
        r.key === keepKey
          ? {
              ...r,
              routeId: r.routeId ?? drop.routeId,
              isBaseline: r.isBaseline || drop.isBaseline,
              combos: sortCombos([...r.combos, ...drop.combos]),
            }
          : r,
      ),
  };
}
