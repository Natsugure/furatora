import type { DirectionType } from '@furatora/database/enums';
import type { FacilityTypeCode } from '@furatora/transfer-difficulty/domain';

// 方面の2値。画面（components）は @furatora/database/enums を直接 import できないため、ここから参照する
export const DIRECTIONS = ['inbound', 'outbound'] as const satisfies readonly DirectionType[];
export type Direction = (typeof DIRECTIONS)[number];

// 駅対（自駅 S・相手駅 T）の方面の組み合わせ。`${S の方面}:${T の方面}` の4通り。
// DB の transfer_connections は端点を昇順に正規化して持つため、S/T の向きとの変換は
// normalize.ts の comboOfConnection / endpointsOfCombo に閉じる。
export type ComboKey = `${DirectionType}:${DirectionType}`;

// zod の z.enum に渡せるよう tuple（as const）で持つ。並びは表示・保存の順序の唯一の定義
export const COMBO_KEYS = [
  'inbound:inbound',
  'inbound:outbound',
  'outbound:inbound',
  'outbound:outbound',
] as const satisfies readonly ComboKey[];

// ルート本体（transfer_routes と設備）の値。保存済みルート・候補ルート・保存本文で共通
export type RouteBody = {
  minutes: number | null;
  isOutdoor: boolean;
  requiresExitGate: boolean;
  requiresStaff: boolean;
  isOfficiallyGuided: boolean;
  notes: string | null;
  /** 設備の種類の集合（順序・回数は持たない。ADR-0011）。0件は「設備未入力」（ADR-0012） */
  facilities: FacilityTypeCode[];
};

// 編集画面のルートカード1枚ぶんの未保存 state。
// 【label と isBaseline は本来 connection_routes（接続×ルート）の属性】だが、Admin は1つの駅対の中では
// 同じルートの全紐付けに同じ値を書く（docs/domain「Admin の書き込み規約」）。そのためカードは1つの値だけ持つ。
export type RouteDraft = Omit<RouteBody, 'notes'> & {
  /** カードの安定キー（React key。保存後は破棄） */
  key: string;
  /** null = 新規ルート */
  routeId: string | null;
  label: string;
  isBaseline: boolean;
  notes: string;
  /** 適用先の方面の組み合わせ */
  combos: ComboKey[];
};

export type PairDraft = {
  routes: RouteDraft[];
  /** ルートが1本も適用されていない組み合わせの備考は保存しない */
  connectionNotes: Record<ComboKey, string>;
};

// PUT …/transfer の本文。駅対の最終状態を1回で送る
export type RouteInput = RouteBody & {
  routeId: string | null;
  label: string;
  isBaseline: boolean;
  combos: ComboKey[];
};

export type PairSaveInput = {
  routes: RouteInput[];
  connectionNotes: Partial<Record<ComboKey, string | null>>;
};
