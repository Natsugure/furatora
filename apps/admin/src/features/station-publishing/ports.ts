// 駅の公開操作（公開状態の切り替えと slug の確定）を担う feature。
// 設計・経緯: docs/domain/station-visibility.md / ADR-0007（Issue #56）。
//
// 読み取りは PageQuery、書き込みは Repository（ADR-0003）。
// この feature は単一駅を対象にした操作であり、複数ファイルの調停ロジックが無いため
// usecases/ 層は置かない（stop-pattern / platform / facility の各 feature と同じ構成。
//  route.ts が `@/di` 経由でこの2ポートを直接呼ぶ）。

export type PublishingLineDTO = {
  id: string;
  name: string;
  slug: string | null;
};

export type PublishingStationDTO = {
  id: string;
  name: string;
  nameKana: string | null;
  nameEn: string | null;
  slug: string | null;
  publishedAt: Date | null;
};

/**
 * 公開操作画面が必要とする確認材料。
 * 正しさの担保（可視性の判定）は apps/web 側の述語が単独で担う。
 * ここでの表示は付け忘れ・入力漏れを人に気づかせるためのものであり、
 * 公開条件そのものにはしない（nameEn・設備充足度のいずれも必須にしない）。
 */
export type PublishingContextDTO = {
  station: PublishingStationDTO;
  /** 駅が属する路線。stationLines に行が無い場合は null（ekidata 由来では原則発生しない） */
  line: PublishingLineDTO | null;
  /** 設備の入力状況（公開条件にはしない。確認材料のみ） */
  facilityInputCount: number;
  facilityTypeCount: number;
};

/**
 * 「公開駅を持つのに slug が無い路線」一覧（データ健全性の警告）。
 * 正しさの担保ではなく、`lines.slug` の付け忘れを人に気づかせるための一覧
 * （docs/domain/station-visibility.md）。
 */
export type LineMissingSlugDTO = {
  lineId: string;
  lineName: string;
  publishedStationCount: number;
};

export interface StationPublishingPageQuery {
  getContext(stationId: string): Promise<PublishingContextDTO | null>;
  listLinesMissingSlug(): Promise<LineMissingSlugDTO[]>;
}

/** 所属路線に slug が設定されていない駅を公開しようとした（route.ts が 422 に写像する） */
export class LineSlugMissingError extends Error {
  constructor() {
    super('所属路線に slug が設定されていない。先に路線の slug を設定すること');
    this.name = 'LineSlugMissingError';
  }
}

/** 確定しようとした slug が他の駅と衝突した（route.ts が 409 に写像する） */
export class SlugTakenError extends Error {
  constructor() {
    super('この slug は既に使われている');
    this.name = 'SlugTakenError';
  }
}

export interface StationPublishingRepository {
  /**
   * slug を確定して publishedAt を設定する。戻り値 false は「該当駅が無い」
   * （route.ts が 404 に写像する）。
   *
   * slug の生成自体はドメイン関数（domain/slugCandidate.ts）が担い、
   * ここでは確定値を受け取って書き込むだけである。slug の確定は自動投入せず、
   * 公開の可否とあわせて必ず管理者の操作を通す
   * （docs/domain/station-master-model.md「slug の導出規則」）。
   */
  publish(stationId: string, slug: string): Promise<boolean>;
  /** publishedAt を NULL に戻す。slug は消さない（再公開時に同じ URL を維持するため） */
  unpublish(stationId: string): Promise<boolean>;
}
