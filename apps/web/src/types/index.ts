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
  slug: string | null;
  code: string | null;
  name: string;
  nameEn: string | null;
  lat: string | null;
  lon: string | null;
};

export type StationWithOrder = Station & {
  stationOrder: number | null;
};

export type OperatorsApiResponse = {
  operators: OperatorWithLines[];
};

export type LineStationsApiResponse = {
  line: Line;
  stations: StationWithOrder[];
};
