import type { PlatformInput } from './schema';

export type PlatformRecord = {
  id: string;
  stationId: string;
  platformNumber: string;
  lineId: string;
  inboundDirectionId: string | null;
  outboundDirectionId: string | null;
  physicalLength: string;
  platformSide: string | null;
  notes: string | null;
};

export interface PlatformRepository {
  create(stationId: string, input: PlatformInput): Promise<PlatformRecord>;
  update(id: string, stationId: string, input: PlatformInput): Promise<PlatformRecord | null>;
  delete(id: string, stationId: string): Promise<boolean>;
}

// 読み取り: Query Service（ADR-0003）。stationLayoutPageQuery が新規ホーム追加
// フォームの路線候補（方面ネスト済み）を組み立てる際に再利用する型。

// 方面は路線にネストして渡す。これにより PlatformInspector 側の
// inbound/outboundDirections が「選択中路線からの純粋な派生値」になり、
// 路線切替時の fetch とレースが消える（#49 / #32）。
export type LineWithDirections = {
  id: string;
  name: string;
  inboundDirections: { id: string; displayName: string }[];
  outboundDirections: { id: string; displayName: string }[];
};
