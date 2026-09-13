import type { PlatformLocationInput } from './schema';

export type PlatformLocationRecord = {
  id: string;
  platformId: string;
  exits: string | null;
  notes: string | null;
};

/**
 * すべてのメソッドが stationId を受け取り、対象の platformLocations が当該駅の
 * ホームに属することを検証する（platformRepository/stopPatternRepository と同じ所有権スコープ）。
 */
export interface PlatformLocationRepository {
  // input.platformId が stationId に属さなければ null
  create(stationId: string, input: PlatformLocationInput): Promise<PlatformLocationRecord | null>;
  update(id: string, stationId: string, input: PlatformLocationInput): Promise<PlatformLocationRecord | null>;
  delete(id: string, stationId: string): Promise<boolean>;
}

// 読み取り: Query Service（ADR-0003）。stationLayoutPageQuery が選択肢データ
// （設備種別・乗換候補駅）を組み立てる際に再利用する型。

export type FacilityTypeOption = { code: string; name: string };

export type ConnectedStationOption = {
  id: string;
  name: string;
  code: string | null;
  // 1駅が複数路線を持ち得るため配列。stationLines に unique(stationId) を付けない
  // 理由は packages/database/src/schema.ts の stationLines 直前のコメントを参照。
  // 単数で持つと駅が路線ごとに重複行になり、同じ駅を二重にチェックできてしまう
  // （facility_connections の unique(platformLocationId, connectedStationId) に抵触する）
  lines: { id: string; name: string; color: string | null }[];
  platforms: { id: string; platformNumber: string }[];
  directions: { id: string; displayName: string }[];
};

