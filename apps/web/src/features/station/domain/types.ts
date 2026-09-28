import type { DirectionType, FacilityTypeCode } from '@furatora/transfer-difficulty/domain';
import type { DirectionTabDTO, PlatformDTO } from '@furatora/platform-diagram/domain';

// 駅詳細画面用のDTO定義。Drizzle非依存（ADR-0003）。
// decimal → number の変換は external/query/ の中で行う。
// station は platform に依存してよい（ADR-0001 feature間依存ルール）。

// 乗換難易度は、ルートと設備をそのまま運ぶ。ペルソナで絞らず、必要な行為も含めない
// （導出は表示層。@furatora/transfer-difficulty/domain。docs/domain/station-master-model.md「乗換難易度」）
export type TransferRouteDTO = {
  routeId: string;
  label: string;
  isBaseline: boolean;
  minutes: number | null;
  isOutdoor: boolean;
  requiresExitGate: boolean;
  requiresStaff: boolean;
  isOfficiallyGuided: boolean;
  notes: string | null;
  /** 0件は「設備未入力」（ADR-0012） */
  facilities: FacilityTypeCode[];
};

/** 方面の組み合わせ1つ（接続1行）。方面は自駅 S・相手駅 T から見た向きに直してある */
export type TransferComboDTO = {
  stationDirection: DirectionType;
  connectedDirection: DirectionType;
  notes: string | null;
  routes: TransferRouteDTO[];
};

/** 乗換先の駅（接続一覧 station_connections の相手駅）1つ */
export type TransferPartnerDTO = {
  connectedStationId: string;
  connectedStationName: string;
  lineName: string;
  lineColor: string | null;
  /** 自駅の路線名（方面の見出しに使う） */
  stationLineName: string;
  directionLabels: {
    station: Record<DirectionType, string>;
    connected: Record<DirectionType, string>;
  };
  /** 接続行がある組み合わせだけ。空 = 未評価 */
  combos: TransferComboDTO[];
};

export type StationDetailDTO = {
  station: {
    id: string;
    name: string;
    nameEn: string | null;
    code: string | null;
    notes: string | null;
  };
  headerLineColor: string | null; // StationBadge 用
  platforms: PlatformDTO[];
  transferPartners: TransferPartnerDTO[];
};

// usecase の戻り値。方面タブ構築済み
export type StationDetailView = StationDetailDTO & { tabs: DirectionTabDTO[] };
