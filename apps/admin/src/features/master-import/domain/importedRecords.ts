// ekidata CSV から取り込む内容を、furatora 側の語彙で表した型。
// ekidata の列名（station_name_k / e_status 等）はここに現れない。
// 供給元を替えても残るのはこの形であり、CSV 形式の知識は external/ekidata/ に閉じる
// （docs/spec/design.md「domain に何を置くかの基準」）。

/** decimal(9,6) 列に書く値。DB から読んだ値と比較できるよう常に小数6桁へ揃える */
export type Decimal6 = string;

export type ImportedOperator = {
  ekidataCompanyCd: number;
  name: string;
};

export type ImportedLine = {
  ekidataLineCd: number;
  ekidataCompanyCd: number;
  name: string;
  nameKana: string | null;
  /** '#RRGGBB'。CSV が空なら null（空値では上書きしない） */
  color: string | null;
};

export type ImportedStationGroup = {
  ekidataStationGroupCd: number;
  name: string;
  nameKana: string | null;
  prefCode: number | null;
  lat: Decimal6 | null;
  lon: Decimal6 | null;
};

export type ImportedStation = {
  ekidataStationCd: number;
  ekidataLineCd: number;
  ekidataStationGroupCd: number;
  name: string;
  nameKana: string | null;
  lat: Decimal6 | null;
  lon: Decimal6 | null;
  prefCode: number | null;
};

export type ImportedAdjacency = {
  ekidataLineCd: number;
  ekidataStationCdA: number;
  ekidataStationCdB: number;
};

/**
 * 廃止（e_status = 2）として CSV に載っていた行の廃止日。
 * DB に該当コードの行があれば abolishedAt へ写す。値が無い行は実行日で埋める。
 */
export type Closures = {
  lines: ReadonlyMap<number, string | null>;
  stations: ReadonlyMap<number, string | null>;
};

export type ImportWarningCode =
  /** 路線行の company_cd が現役事業者に無い。その路線は取り込まない */
  | 'line_with_unknown_company'
  /** 駅行の line_cd が現役路線に無い。その駅は取り込まない */
  | 'station_with_unknown_line'
  /** join 行の line_cd が現役路線に無い。FK を張れないため取り込まない */
  | 'adjacency_unknown_line'
  /** join 行の端点が現役駅でない。FK を張れないため取り込まない */
  | 'adjacency_endpoint_missing'
  /** station_g_cd が現役の station_cd を指していない。代表値を所属駅から決めた */
  | 'dangling_station_group'
  /** e_status = 1（未開業）。取り込まないが廃止扱いにもしない */
  | 'not_yet_opened_line'
  | 'not_yet_opened_station';

/** 適用は妨げないが、人が把握しておくべき事象。件数と手がかりだけを持つ */
export type ImportWarning = {
  code: ImportWarningCode;
  count: number;
  /** 最大 SAMPLE_LIMIT 件。全件を並べても読めないため手がかりに留める */
  samples: string[];
};

export type ImportBlockerCode =
  /**
   * ekidata の事業者名が、別の既存事業者の name と衝突する。
   * operators.name は一意制約付きであり、適用すればトランザクション全体が
   * 23505 で落ちる。ekidata*Cd の突合（Phase 3）が済んでいれば解消する
   */
  | 'operator_name_conflict';

/** 適用すれば必ず失敗する事象。plan の時点で提示し、apply を受け付けない */
export type ImportBlocker = {
  code: ImportBlockerCode;
  count: number;
  samples: string[];
};

export const SAMPLE_LIMIT = 5;

export type ImportedRecords = {
  operators: ImportedOperator[];
  lines: ImportedLine[];
  stationGroups: ImportedStationGroup[];
  stations: ImportedStation[];
  adjacencies: ImportedAdjacency[];
  closures: Closures;
  /**
   * CSV に現れた line_cd / station_cd の全体。e_status や取り込み可否は問わない。
   *
   * 廃止判定が「CSV から完全に消えた行」と「CSV にはあるが取り込まなかった行」
   * （未開業、現役でない事業者・路線に紐づく等）を区別するために使う。
   * 後者を廃止扱いにすると、供給元の一時的な不備（古い company.csv など）で
   * 公開中の路線・駅がサイトから消える。
   */
  seen: {
    lines: ReadonlySet<number>;
    stations: ReadonlySet<number>;
  };
  warnings: ImportWarning[];
};

// --- DB 側の現在の姿（差分算出の入力） ---

export type ExistingOperator = {
  id: string;
  name: string;
  ekidataCompanyCd: number | null;
};

export type ExistingLine = {
  id: string;
  ekidataLineCd: number | null;
  name: string;
  nameKana: string | null;
  color: string | null;
  abolishedAt: string | null;
};

export type ExistingStationGroup = {
  id: string;
  ekidataStationGroupCd: number;
  name: string;
  nameKana: string | null;
  prefCode: number | null;
  lat: string | null;
  lon: string | null;
};

export type ExistingStation = {
  id: string;
  ekidataStationCd: number | null;
  name: string;
  nameKana: string | null;
  lat: string | null;
  lon: string | null;
  prefCode: number | null;
  stationGroupId: string | null;
  abolishedAt: string | null;
};

export type MasterSnapshot = {
  operators: ExistingOperator[];
  lines: ExistingLine[];
  stationGroups: ExistingStationGroup[];
  stations: ExistingStation[];
  /** 既に張られている (stationId, lineId) の組 */
  stationLinePairs: Array<{ stationId: string; lineId: string }>;
  /** 既にある隣接。再インポートで差分0を報告できるようにするため読む */
  stationAdjacencyKeys: Array<{ lineId: string; stationAId: string; stationBId: string }>;
};

// --- 差分計画 ---

export type TableDiff = {
  created: number;
  updated: number;
  unchanged: number;
  abolished: number;
};

export type ImportSummary = {
  operators: TableDiff;
  lines: TableDiff;
  stationGroups: TableDiff;
  stations: TableDiff;
  stationLines: { created: number };
  stationAdjacencies: { created: number };
  /**
   * 乗換接続は stations の自己結合で生成するため、実際の挿入数は適用時にしか
   * 確定しない。ここに出すのは CSV から見た上限である
   */
  stationConnections: { upperBound: number };
};

export type AbolishMark = { id: string; abolishedAt: string };

/**
 * 適用すべき変更。
 *
 * **更新は「変更のある行を upsert し直す」形で表す。** 行ごとに UPDATE 文を
 * 投げる形にすると、Phase 3 の突合直後のように既存481行がまとめて変わる場面で
 * 481往復（1文あたり約140ms）になり、8秒で済むはずの適用が1分を超える。
 * どの列を書き替えるか（＝触らない列がどれか）は、upsert の SET 句が担う。
 *
 * FK（operatorId / lineId / stationGroupId）は UUID がトランザクション内でしか
 * 確定しないため、ここでは ekidata コードのまま持つ。
 * 解決は external/repository/masterImportRepository.ts が行う。
 */
export type ImportChanges = {
  /** 新規、または ekidata 由来の列に変化がある行だけを含む */
  operators: { write: ImportedOperator[] };
  lines: { write: ImportedLine[]; abolish: AbolishMark[] };
  stationGroups: { write: ImportedStationGroup[] };
  stations: { write: ImportedStation[]; abolish: AbolishMark[] };
  /** 新たに張る (station_cd, line_cd) の組 */
  stationLines: Array<{ ekidataStationCd: number; ekidataLineCd: number }>;
  /** DB にまだ無い隣接 */
  adjacencies: ImportedAdjacency[];
};

export type ImportPlan = {
  summary: ImportSummary;
  changes: ImportChanges;
  warnings: ImportWarning[];
  blockers: ImportBlocker[];
};

export type ApplyResult = {
  operators: { created: number; updated: number };
  lines: { created: number; updated: number; abolished: number };
  stationGroups: { created: number; updated: number };
  stations: { created: number; updated: number; abolished: number };
  stationLines: { created: number };
  stationAdjacencies: { created: number };
  stationConnections: { created: number };
};
