// ODPT 由来の既存行を ekidata のコードへ突合するための型
// （Issue #56 Phase 3 / docs/spec/design.md「移行アルゴリズム」）。
//
// この feature は一度きりの移行のためにある。定常運用の取り込みは
// features/master-import が担い、こちらは「取り込みを始められる状態を作る」だけである。
// 突合が済むまで master-import は operator_name_conflict を出して apply を拒否する。

/** どの手段で突合したか。ドライランの結果を読むときに、自動と手動を区別するために持つ */
export type MatchMethod =
  /** manualMappings.ts に人が書いた対応 */
  | 'manual'
  /** 正規化した名前の完全一致 */
  | 'name'
  /** 既存路線の全駅が、候補路線の駅集合に含まれる */
  | 'station_containment';

export type Assignment = {
  id: string;
  code: number;
  method: MatchMethod;
};

export type UnmatchedReason =
  /** odptOperatorId が手動対応表に無い */
  | 'operator_not_in_table'
  /** 対応表の company_cd が現役の ekidata 事業者に存在しない */
  | 'company_not_in_csv'
  /** 上位の事業者が未突合のため、候補を絞れない */
  | 'operator_unresolved'
  /** 上位の路線が未突合のため、候補を絞れない */
  | 'line_unresolved'
  /** 駅が1路線にも属していない（stationLines が無い） */
  | 'line_unknown'
  /** 候補が0件 */
  | 'no_candidate'
  /** 候補が複数あり、一意に決められない */
  | 'ambiguous';

/** 未突合行を人に見せるための1件。REQ-3.2 により削除せず一覧に出す */
export type Unmatched = {
  id: string;
  name: string;
  reason: UnmatchedReason;
  /** どの事業者・路線の行かを示す手がかり */
  context: string;
  /**
   * manualMappings.ts に書くときの手がかり。
   * 突合できなかった行に対して、同じ事業者・路線の中で名前が近い ekidata の候補を出す。
   * 対応表の値は docs に無く、CSV から人が特定するしかないため
   * （docs/spec/tasks.md TASK-3.2 / 3.3）
   */
  candidates: Array<{ code: number; name: string }>;
};

export type MatchBreakdown = {
  manual: number;
  name: number;
  stationContainment: number;
};

export type TableMatch = {
  /** DB の総行数 */
  total: number;
  /** 今回コードを埋める行 */
  assigned: Assignment[];
  /** 既に ekidata*Cd が入っており、触らない行。再実行時にここへ移る */
  alreadySet: number;
  unmatched: Unmatched[];
  byMethod: MatchBreakdown;
};

export type ConnectionCounts = {
  total: number;
  /**
   * 全置換で消せる行。source が NULL（= ODPT 時代に作られた）で、
   * 難易度もメモも入っていないもの
   */
  replaceable: number;
  /**
   * source が NULL なのに入力済みの行。1件でもあれば
   * 「全546件が難易度未入力」という TASK-3.5 の前提が崩れているため停止する
   */
  withInput: number;
};

export type MigrationBlockerCode =
  /**
   * 2つ以上の既存行が同じ ekidata コードに突合した。
   * ekidata*Cd はいずれも unique であり、適用すれば 23505 で
   * トランザクション全体が落ちる。ODPT の路線は運行系統粒度で作られており、
   * 複数の既存路線が同じ line_cd へ寄りうるため実際に起こりうる
   */
  | 'duplicate_ekidata_code'
  /** 割り当てようとしたコードを、既に別の行が持っている（再実行時に起こる） */
  | 'code_taken_by_other_row'
  /** 難易度・メモが入力済みの乗換接続がある。全置換してよい前提が崩れている */
  | 'connection_has_input';

/** 適用すれば必ず失敗する、または前提が崩れている事象。plan の時点で提示する */
export type MigrationBlocker = {
  code: MigrationBlockerCode;
  count: number;
  samples: string[];
};

// --- DB 側の現在の姿（突合の入力） ---

export type ExistingOperatorRow = {
  id: string;
  name: string;
  odptOperatorId: string | null;
  ekidataCompanyCd: number | null;
};

export type ExistingLineRow = {
  id: string;
  name: string;
  operatorId: string;
  ekidataLineCd: number | null;
};

export type ExistingStationRow = {
  id: string;
  name: string;
  ekidataStationCd: number | null;
  /**
   * stationLines から解決した所属路線。
   * 実測では全481駅が1路線だが、それは ekidata が路線ごとに駅を割った結果であって
   * ドメインの不変条件ではない（schema.ts の stationLines のコメント）。
   * 1件に固定せず配列で持つ
   */
  lineIds: string[];
};

export type MigrationSnapshot = {
  operators: ExistingOperatorRow[];
  lines: ExistingLineRow[];
  stations: ExistingStationRow[];
  connections: ConnectionCounts;
};

// --- 突合の結果 ---

export type MigrationPlan = {
  operators: TableMatch;
  lines: TableMatch;
  stations: TableMatch;
  connections: ConnectionCounts;
  blockers: MigrationBlocker[];
};

export type MigrationResult = {
  operators: { assigned: number };
  lines: { assigned: number };
  stations: { assigned: number };
  stationConnections: { deleted: number };
};

/** 未突合一覧に添える候補の上限。全件並べても読めない */
export const CANDIDATE_LIMIT = 5;
/** blocker のサンプル件数。master-import の SAMPLE_LIMIT と揃える */
export const BLOCKER_SAMPLE_LIMIT = 5;
