export type Operator = {
  id: string;
  name: string;
  odptOperatorId: string | null;
  createdAt: Date | null;
};

export type Line = {
  id: string;
  slug: string | null;
  name: string;
  nameEn: string | null;
  lineCode: string | null;
  color: string | null;
  displayOrder: number | null;
  operatorId: string;
};

export type OperatorWithLines = Operator & {
  lines: Line[];
};

export type Station = {
  id: string;
  // 公開駅は CHECK 制約（published_requires_slug）により必ず slug を持つ。
  // ここに現れる Station は可視性述語（publishedStation()）を通った行のみであるため
  // null を許さない（TASK-5.1: `slug ?? id` フォールバックの整理）。
  slug: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  lat: string | null;
  lon: string | null;
};

export type StationWithOrder = Station & {
  stationOrder: number | null;
};

export type StationInGroup = {
  id: string;
  // Station.slug と同じ理由で null を許さない
  slug: string;
  code: string | null;
  lineId: string | null;
  lineName: string | null;
  lineCode: string | null;
  lineColor: string | null;
  lineSlug: string | null;
};

export type StationGroup = {
  name: string;
  nameEn: string | null;
  stations: StationInGroup[];
};

export type StationSearchApiResponse = {
  stationGroups: StationGroup[];
  total: number;
};

export type OperatorsApiResponse = {
  operators: OperatorWithLines[];
};

export type LineStationsApiResponse = {
  line: Line;
  stations: StationWithOrder[];
};
