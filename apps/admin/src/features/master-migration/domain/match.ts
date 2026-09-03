import type {
  ImportedLine,
  ImportedRecords,
  ImportedStation,
} from '@/features/master-import/domain/importedRecords';
import { normalizeStationName } from '@/features/master-import/domain/normalize';
import {
  MANUAL_LINE_CD,
  MANUAL_STATION_CD,
  OPERATOR_COMPANY_CD,
  operatorKey,
} from './manualMappings';
import {
  BLOCKER_SAMPLE_LIMIT,
  CANDIDATE_LIMIT,
  type Assignment,
  type ExistingStationRow,
  type MigrationBlocker,
  type MigrationBlockerCode,
  type MigrationPlan,
  type MigrationSnapshot,
  type TableMatch,
  type Unmatched,
  type UnmatchedReason,
} from './migrationPlan';

/**
 * ODPT 由来の既存行に ekidata のコードを割り当てる（docs/spec/design.md「移行アルゴリズム」）。
 *
 * **事業者 → 路線 → 駅の順に確定させる。** 路線を主役にすると n:m を解くことになる。
 * ODPT の路線は運行系統粒度で作られており、ekidata の線路名称粒度と対応しない
 * （ODPT「京浜東北線・根岸線」1件 ↔ ekidata 11332 + 11307 の2件）。
 * 事業者が決まれば路線の候補が数十件に絞れ、路線が決まれば駅の候補は
 * その路線の駅だけになる。
 *
 * 純粋関数である。同じ入力からは同じ計画が出る。
 * apply はこれをトランザクションの内側で呼び直してから書き込む。
 */
export function computeMigrationPlan(
  records: ImportedRecords,
  snapshot: MigrationSnapshot,
): MigrationPlan {
  const operators = matchOperators(records, snapshot);
  const companyCdByOperatorId = codeByRowId(snapshot.operators, operators.assigned, (o) => o.ekidataCompanyCd);

  const lines = matchLines(records, snapshot, companyCdByOperatorId);
  const lineCdByLineId = codeByRowId(snapshot.lines, lines.assigned, (l) => l.ekidataLineCd);

  const stations = matchStations(records, snapshot, lineCdByLineId);

  const blockers = collectBlockers(snapshot, { operators, lines, stations });

  return { operators, lines, stations, connections: snapshot.connections, blockers };
}

// --- 1. 事業者（TASK-3.1） ---

function matchOperators(records: ImportedRecords, snapshot: MigrationSnapshot): TableMatch {
  const collector = new MatchCollector(snapshot.operators.length);
  const availableCompanyCds = new Set(records.operators.map((o) => o.ekidataCompanyCd));

  for (const operator of snapshot.operators) {
    if (operator.ekidataCompanyCd !== null) {
      collector.skipAlreadySet();
      continue;
    }

    const key = operatorKey(operator.odptOperatorId);
    const cd = key === null ? undefined : OPERATOR_COMPANY_CD[key];

    if (cd === undefined) {
      collector.miss(operator.id, operator.name, 'operator_not_in_table', `odptOperatorId=${operator.odptOperatorId ?? '（無し）'}`);
      continue;
    }
    // 対応表の値が現役の事業者を指していることを確かめる。ekidata 側で廃止された
    // 事業者のコードを書き込むと、以後どのインポートでも更新されない行が生まれる
    if (!availableCompanyCds.has(cd)) {
      collector.miss(operator.id, operator.name, 'company_not_in_csv', `company_cd=${cd}`);
      continue;
    }
    collector.hit(operator.id, cd, 'manual');
  }

  return collector.build();
}

// --- 2. 路線（TASK-3.2） ---

function matchLines(
  records: ImportedRecords,
  snapshot: MigrationSnapshot,
  companyCdByOperatorId: ReadonlyMap<string, number>,
): TableMatch {
  const collector = new MatchCollector(snapshot.lines.length);
  const linesByCompany = groupBy(records.lines, (line) => line.ekidataCompanyCd);
  const stationsByLine = groupBy(records.stations, (station) => station.ekidataLineCd);
  const operatorKeyById = new Map(snapshot.operators.map((o) => [o.id, operatorKey(o.odptOperatorId)]));
  const existingStationsByLine = groupExistingStationsByLine(snapshot.stations);

  for (const line of snapshot.lines) {
    if (line.ekidataLineCd !== null) {
      collector.skipAlreadySet();
      continue;
    }

    const opKey = operatorKeyById.get(line.operatorId) ?? null;
    const context = `事業者=${opKey ?? '不明'}`;

    // (a) 手動対応表。自動突合より先に引く（名前一致より確かな根拠であるため）
    const manual = opKey === null ? undefined : MANUAL_LINE_CD[`${opKey}/${line.name}`];
    if (manual !== undefined) {
      collector.hit(line.id, manual, 'manual');
      continue;
    }

    const companyCd = companyCdByOperatorId.get(line.operatorId);
    if (companyCd === undefined) {
      collector.miss(line.id, line.name, 'operator_unresolved', context);
      continue;
    }

    const candidates = linesByCompany.get(companyCd) ?? [];

    // (b) 正規化した路線名の完全一致。normalizeStationName は駅名のために書かれたが、
    // 実体は「日本語の鉄道名の同一性」であり、括弧除去（東武スカイツリーライン(支線)）と
    // ヶ/ケ の吸収はそのまま路線名にも効く
    const byName = candidates.filter((c) => normalizeStationName(c.name) === normalizeStationName(line.name));
    if (byName.length === 1) {
      collector.hit(line.id, byName[0]!.ekidataLineCd, 'name');
      continue;
    }
    if (byName.length > 1) {
      collector.miss(line.id, line.name, 'ambiguous', context, toCandidates(byName));
      continue;
    }

    // (c) 全駅包含判定。既存路線の駅がすべて収まる ekidata 路線を探す。
    // ODPT の運行系統（例: 常磐線快速）が ekidata の線路名称（常磐線）の
    // 部分集合になっている場合に効く
    const owned = existingStationsByLine.get(line.id) ?? [];
    if (owned.length === 0) {
      collector.miss(line.id, line.name, 'no_candidate', `${context} / 所属駅0件`, toCandidates(nearest(candidates, line.name)));
      continue;
    }
    const ownedNames = new Set(owned.map((s) => normalizeStationName(s.name)));
    const containing = candidates.filter((c) => {
      const names = new Set((stationsByLine.get(c.ekidataLineCd) ?? []).map((s) => normalizeStationName(s.name)));
      return isSubsetOf(ownedNames, names);
    });
    if (containing.length === 1) {
      collector.hit(line.id, containing[0]!.ekidataLineCd, 'station_containment');
      continue;
    }

    // 絞れなかった場合は候補を添えて人に渡す。ここで機械的に1件へ倒すと
    // （駅数が最少のものを採る等）根拠の無い対応が黙って本番に入る
    const reason: UnmatchedReason = containing.length > 1 ? 'ambiguous' : 'no_candidate';
    const hints = containing.length > 1 ? containing : nearest(candidates, line.name);
    collector.miss(line.id, line.name, reason, context, toCandidates(hints));
  }

  return collector.build();
}

// --- 3. 駅（TASK-3.3 / 3.4） ---

function matchStations(
  records: ImportedRecords,
  snapshot: MigrationSnapshot,
  lineCdByLineId: ReadonlyMap<string, number>,
): TableMatch {
  const collector = new MatchCollector(snapshot.stations.length);
  const stationsByLine = groupBy(records.stations, (station) => station.ekidataLineCd);
  const operatorKeyById = new Map(snapshot.operators.map((o) => [o.id, operatorKey(o.odptOperatorId)]));
  const lineById = new Map(snapshot.lines.map((l) => [l.id, l]));

  for (const station of snapshot.stations) {
    if (station.ekidataStationCd !== null) {
      collector.skipAlreadySet();
      continue;
    }
    if (station.lineIds.length === 0) {
      collector.miss(station.id, station.name, 'line_unknown', '所属路線が無い');
      continue;
    }

    // 1駅が複数路線を持つことを禁じていないため、路線ごとに試して最初に決まったものを採る
    const attempts = station.lineIds.map((lineId) => attemptStation(station, lineId));
    const hit = attempts.find((a) => a.code !== undefined);
    if (hit?.code !== undefined) {
      collector.hit(station.id, hit.code, hit.method);
      continue;
    }
    const first = attempts[0]!;
    collector.miss(station.id, station.name, first.reason, first.context, first.candidates);
  }

  return collector.build();

  function attemptStation(station: ExistingStationRow, lineId: string) {
    const line = lineById.get(lineId);
    const opKey = line ? operatorKeyById.get(line.operatorId) ?? null : null;
    const context = `路線=${line?.name ?? '不明'} / 事業者=${opKey ?? '不明'}`;

    const manual =
      line && opKey ? MANUAL_STATION_CD[`${opKey}/${line.name}/${station.name}`] : undefined;
    if (manual !== undefined) {
      return { code: manual, method: 'manual' as const, reason: 'no_candidate' as const, context, candidates: [] };
    }

    const lineCd = lineCdByLineId.get(lineId);
    if (lineCd === undefined) {
      return { code: undefined, method: 'name' as const, reason: 'line_unresolved' as const, context, candidates: [] };
    }

    const candidates = stationsByLine.get(lineCd) ?? [];
    const byName = candidates.filter(
      (c) => normalizeStationName(c.name) === normalizeStationName(station.name),
    );
    if (byName.length === 1) {
      return { code: byName[0]!.ekidataStationCd, method: 'name' as const, reason: 'no_candidate' as const, context, candidates: [] };
    }
    const reason: UnmatchedReason = byName.length > 1 ? 'ambiguous' : 'no_candidate';
    const hints = byName.length > 1 ? byName : nearest(candidates, station.name);
    return { code: undefined, method: 'name' as const, reason, context, candidates: toCandidates(hints) };
  }
}

// --- 適用不能の検出 ---

function collectBlockers(
  snapshot: MigrationSnapshot,
  matches: { operators: TableMatch; lines: TableMatch; stations: TableMatch },
): MigrationBlocker[] {
  const collector = new BlockerCollector();

  check('事業者', matches.operators, nameById(snapshot.operators), takenCodes(snapshot.operators, (o) => o.ekidataCompanyCd));
  check('路線', matches.lines, nameById(snapshot.lines), takenCodes(snapshot.lines, (l) => l.ekidataLineCd));
  check('駅', matches.stations, nameById(snapshot.stations), takenCodes(snapshot.stations, (s) => s.ekidataStationCd));

  if (snapshot.connections.withInput > 0) {
    collector.add(
      'connection_has_input',
      snapshot.connections.withInput,
      `難易度またはメモが入力済みの乗換接続が ${snapshot.connections.withInput} 件ある`,
    );
  }

  return collector.build();

  function check(
    label: string,
    match: TableMatch,
    names: ReadonlyMap<string, string>,
    taken: ReadonlyMap<number, string>,
  ) {
    const byCode = new Map<number, string[]>();
    for (const assignment of match.assigned) {
      const holders = byCode.get(assignment.code) ?? [];
      holders.push(names.get(assignment.id) ?? assignment.id);
      byCode.set(assignment.code, holders);

      const owner = taken.get(assignment.code);
      if (owner !== undefined) {
        collector.add(
          'code_taken_by_other_row',
          1,
          `${label} ${assignment.code} は既に「${owner}」が持っている（割り当て先: ${names.get(assignment.id) ?? assignment.id}）`,
        );
      }
    }
    for (const [code, holders] of byCode) {
      if (holders.length > 1) {
        collector.add('duplicate_ekidata_code', 1, `${label} ${code} に ${holders.length}行: ${holders.join(' / ')}`);
      }
    }
  }
}

// --- 小道具 ---

class MatchCollector {
  private readonly assigned: Assignment[] = [];
  private readonly unmatched: Unmatched[] = [];
  private alreadySet = 0;
  private readonly byMethod = { manual: 0, name: 0, stationContainment: 0 };

  constructor(private readonly total: number) {}

  skipAlreadySet() {
    this.alreadySet += 1;
  }

  hit(id: string, code: number, method: Assignment['method']) {
    this.assigned.push({ id, code, method });
    if (method === 'manual') this.byMethod.manual += 1;
    else if (method === 'name') this.byMethod.name += 1;
    else this.byMethod.stationContainment += 1;
  }

  miss(
    id: string,
    name: string,
    reason: UnmatchedReason,
    context: string,
    candidates: Unmatched['candidates'] = [],
  ) {
    this.unmatched.push({ id, name, reason, context, candidates });
  }

  build(): TableMatch {
    return {
      total: this.total,
      assigned: this.assigned,
      alreadySet: this.alreadySet,
      unmatched: this.unmatched,
      byMethod: this.byMethod,
    };
  }
}

class BlockerCollector {
  private readonly counts = new Map<MigrationBlockerCode, { count: number; samples: string[] }>();

  add(code: MigrationBlockerCode, count: number, sample: string) {
    const entry = this.counts.get(code) ?? { count: 0, samples: [] };
    entry.count += count;
    if (entry.samples.length < BLOCKER_SAMPLE_LIMIT) entry.samples.push(sample);
    this.counts.set(code, entry);
  }

  build(): MigrationBlocker[] {
    return [...this.counts].map(([code, entry]) => ({ code, count: entry.count, samples: entry.samples }));
  }
}

/** 既に入っているコードと、今回割り当てるコードを1つの表にまとめる */
function codeByRowId<T extends { id: string }>(
  rows: readonly T[],
  assigned: readonly Assignment[],
  existing: (row: T) => number | null,
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const code = existing(row);
    if (code !== null) map.set(row.id, code);
  }
  for (const assignment of assigned) map.set(assignment.id, assignment.code);
  return map;
}

function takenCodes<T extends { id: string; name: string }>(
  rows: readonly T[],
  code: (row: T) => number | null,
): ReadonlyMap<number, string> {
  const map = new Map<number, string>();
  for (const row of rows) {
    const value = code(row);
    if (value !== null) map.set(value, row.name);
  }
  return map;
}

function nameById<T extends { id: string; name: string }>(rows: readonly T[]): ReadonlyMap<string, string> {
  return new Map(rows.map((row) => [row.id, row.name]));
}

function groupBy<T>(items: readonly T[], key: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const group = map.get(key(item));
    if (group) group.push(item);
    else map.set(key(item), [item]);
  }
  return map;
}

function groupExistingStationsByLine(
  stations: readonly ExistingStationRow[],
): Map<string, ExistingStationRow[]> {
  const map = new Map<string, ExistingStationRow[]>();
  for (const station of stations) {
    for (const lineId of station.lineIds) {
      const group = map.get(lineId);
      if (group) group.push(station);
      else map.set(lineId, [station]);
    }
  }
  return map;
}

function isSubsetOf(subset: ReadonlySet<string>, superset: ReadonlySet<string>): boolean {
  for (const value of subset) {
    if (!superset.has(value)) return false;
  }
  return true;
}

type Named = ImportedLine | ImportedStation;

function toCandidates(items: readonly Named[]): Unmatched['candidates'] {
  return items.slice(0, CANDIDATE_LIMIT).map((item) => ({ code: codeOf(item), name: item.name }));
}

function codeOf(item: Named): number {
  return 'ekidataStationCd' in item ? item.ekidataStationCd : item.ekidataLineCd;
}

/**
 * 名前が近い順に候補を返す。突合そのものには使わない（採用は完全一致か人の判断に限る）。
 * 未突合一覧から manualMappings.ts を埋める作業を、CSV の grep 無しで終わらせるためだけの補助である
 */
function nearest(items: readonly Named[], name: string): Named[] {
  const target = normalizeStationName(name);
  return [...items]
    .map((item) => ({ item, score: similarity(normalizeStationName(item.name), target) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_LIMIT)
    .map((entry) => entry.item);
}

function similarity(a: string, b: string): number {
  if (a.includes(b) || b.includes(a)) return 1000 + Math.min(a.length, b.length);
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) common += 1;
  return common;
}
