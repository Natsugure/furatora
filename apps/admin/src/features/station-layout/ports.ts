import type {
  PlatformDTO, TrainStopPatternDTO, FacilityDTO, ConcourseCellDTO, FacilityConnectionDTO, ConcourseDTO,
} from '@furatora/platform-diagram/domain';
import type { LineWithDirections } from '@/features/platform/ports';
import type { FacilityTypeOption, ConnectedStationOption } from '@/features/facility/ports';
import type { TrainOptionDTO } from '@/features/stop-pattern/domain/types';

// 読み取り: Query Service（ADR-0003）。

/** ホームタブ用の軽量情報 */
export type LayoutPlatformDTO = {
  id: string;
  platformNumber: string;
};

export type LayoutStopPatternDTO = TrainStopPatternDTO & {
  /** trainStopPatterns.id。URL の ?patternId= に使う（パッケージのDTOは表示用のため持たない） */
  patternId: string;
};

// 編集専用フィールド。PUT platform-locations がコンコース全体を
// delete→insertする全置換のため、往復に必要な値をパッケージのDTOより広く持たせる。
// packages/platform-diagram の types.ts には足さない（web への供給義務が生じ、
// パッケージが編集用フィールドを抱え込むことになる。ADR-0010「レビュー」節参照）。

/** stationFacilities.notes を追加した設備DTO */
export type LayoutFacilityDTO = FacilityDTO & { notes: string | null };

/** platformLocationCells.id を追加したアクセス点DTO（draftのキー・React keyに使う） */
export type LayoutCellDTO = Omit<ConcourseCellDTO, 'facilities'> & {
  id: string;
  facilities: LayoutFacilityDTO[];
};

/** facilityConnections の connectedStationId/connectedPlatformId/directionId を追加した乗換DTO */
export type LayoutConnectionDTO = FacilityConnectionDTO & {
  connectedStationId: string;
  connectedPlatformId: string | null;
  directionId: string | null;
};

/** platformLocations.notes を追加したコンコースDTO */
export type LayoutConcourseDTO = Omit<ConcourseDTO, 'cells' | 'connections'> & {
  notes: string | null;
  cells: LayoutCellDTO[];
  connections: LayoutConnectionDTO[];
};

export type LayoutPlatformDetailDTO = Omit<PlatformDTO, 'stopPatterns' | 'concourses'> & {
  stopPatterns: LayoutStopPatternDTO[];
  concourses: LayoutConcourseDTO[];
  /** 図に重ねるパターン。停車位置パターンが1件も無ければ null */
  selectedPatternId: string | null;
};

export type StationLayoutContext = {
  stationName: string;
  platforms: LayoutPlatformDTO[];
  /** 選択中ホームの全データ。駅にホームが1件も無ければ null */
  platform: LayoutPlatformDetailDTO | null;
  // 以下はインスペクタの選択肢データ。取得は facilityEditPageQuery/platformEditPageQuery/
  // stopPatternPageQuery の既存ロジックを再利用する。
  /** 当該駅の stationLines に載る路線（方面ネスト済み）。新規ホーム追加フォーム用 */
  lines: LineWithDirections[];
  /** 設備種別一覧（全件） */
  facilityTypes: FacilityTypeOption[];
  /** 乗換先候補駅（ホーム・方面ネスト済み） */
  connectedStations: ConnectedStationOption[];
  /** 列車一覧（号車構成付き）。停車パターン新規作成のプレビュー用 */
  trains: TrainOptionDTO[];
};

export interface StationLayoutPageQuery {
  /** 駅が無ければ null。駅に属さない platformId / patternId は先頭にフォールバックする */
  getContext(
    stationId: string,
    selection: { platformId?: string; patternId?: string },
  ): Promise<StationLayoutContext | null>;
}
