import type { DirectionType, StationConnectionSource } from '@furatora/database/enums';
import type { FacilityTypeCode } from '@furatora/transfer-difficulty/domain';
import type { ComboKey, PairSaveInput } from './domain/types';

// 乗換難易度の駅対編集（Issue #124）。読み取りは Query Service、書き込みは Repository（ADR-0003）。
// usecases 層は作らない（route が Repository を直接呼ぶ。station-publishing と同じ）。

export type PairRouteLink = {
  combo: ComboKey;
  label: string;
  isBaseline: boolean;
};

/** この駅対の接続に結ばれたルート */
export type PairRouteRecord = {
  routeId: string;
  minutes: number | null;
  isOutdoor: boolean;
  requiresExitGate: boolean;
  requiresStaff: boolean;
  isOfficiallyGuided: boolean;
  notes: string | null;
  facilities: FacilityTypeCode[];
  links: PairRouteLink[];
  /** 駅対の外の接続からも参照されている場合の共有先（編集が共有先にも反映される） */
  sharedWith: { stationName: string; connectedStationName: string }[];
};

/** 重複検出の比較対象。S か T を端点に持つ接続のルートのうち、この駅対に結ばれていないもの */
export type CandidateRoute = {
  routeId: string;
  label: string;
  minutes: number | null;
  isOutdoor: boolean;
  requiresExitGate: boolean;
  requiresStaff: boolean;
  isOfficiallyGuided: boolean;
  notes: string | null;
  facilities: FacilityTypeCode[];
  /** 「池袋（丸ノ内線）↔ 池袋（副都心線）」のような表示用の文字列 */
  usedBy: string;
};

export type TransferPairConnection = {
  combo: ComboKey;
  connectionId: string;
  notes: string | null;
  source: StationConnectionSource | null;
};

export type TransferPairEditContext = {
  stationId: string;
  connectedStationId: string;
  stationName: string;
  connectedStationName: string;
  lineName: string | null;
  connectedLineName: string | null;
  /** 入力の補助表示。同一 (路線, 方面) に同義行があるため一覧で持つ（解決規則は #130） */
  directionHints: {
    station: Record<DirectionType, string[]>;
    connected: Record<DirectionType, string[]>;
  };
  facilityTypes: { code: FacilityTypeCode; name: string }[];
  connections: TransferPairConnection[];
  routes: PairRouteRecord[];
  candidates: CandidateRoute[];
};

export interface TransferPairEditPageQuery {
  /** 駅対（station_connections の S→T）が無ければ null */
  getContext(stationId: string, connectedStationId: string): Promise<TransferPairEditContext | null>;
}

export interface TransferConnectionRepository {
  /** 駅対の最終状態を1トランザクションで書き込む。駅対が無ければ null */
  savePair(
    stationId: string,
    connectedStationId: string,
    input: PairSaveInput,
  ): Promise<{ ok: true } | null>;
}

/** routeId が、この駅対に結ばれておらず候補の範囲（S か T を端点に持つ接続のルート）にも無い */
export class RouteOutOfScopeError extends Error {
  constructor() {
    super('この駅対から参照できないルートが指定されています。画面を読み込み直してください');
    this.name = 'RouteOutOfScopeError';
  }
}

/** unique_connection_route_label 違反（同時保存の競合などで発生） */
export class RouteLabelTakenError extends Error {
  constructor() {
    super('同じ名前のルートがあります');
    this.name = 'RouteLabelTakenError';
  }
}
