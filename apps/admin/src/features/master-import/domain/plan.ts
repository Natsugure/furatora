import type {
  AbolishMark,
  ExistingStation,
  ImportBlocker,
  ImportBlockerCode,
  ImportChanges,
  ImportedAdjacency,
  ImportedLine,
  ImportedOperator,
  ImportedStation,
  ImportedStationGroup,
  ImportedRecords,
  ImportPlan,
  MasterSnapshot,
  TableDiff,
} from './importedRecords';
import { SAMPLE_LIMIT } from './importedRecords';
import { toDecimal6, toHexColor } from './values';

/**
 * インポートの差分計画。CSV の内容と DB の現在の姿から、
 * 何を書き・何を廃止するかを決める純粋関数。
 *
 * ここが守るのは furatora のポリシーであり、供給元が ekidata でなくなっても残る。
 * したがって domain に置く（docs/spec/design.md）。
 *
 * 【空値では上書きしない】CSV の値が空・null なら既存値を保つ（REQ-2.2）。
 * 無料版CSVはカナが全件空であり、素朴に上書きすると現行DBのカナが消える。
 * この関数は「その規則を適用してもなお値が変わるか」で書き込みの要否を決め、
 * 実際の保持は upsert の SET 句（COALESCE）が行う。両者は同じ規則を実装している。
 *
 * 【触らない列】slug / nameEn / code / notes / publishedAt / displayOrder /
 * displayPriority / lineCode / operatorId は比較にも書き込みにも含めない（REQ-2.1）。
 * この分離が手編集保護の主機構である。
 */

/** 空値では上書きしない。取り込んだ値が null なら現在の値を残す */
function keep<T>(incoming: T | null, current: T | null): T | null {
  return incoming === null ? current : incoming;
}

/** name は notNull だが空文字はありうる。空なら既存を残す（SET 句の NULLIF と同じ規則） */
function keepName(incoming: string, current: string): string {
  return incoming === '' ? current : incoming;
}

/** 路線色は表記ゆれ（`#` の有無・大文字小文字）を吸収してから比較する */
function sameColor(a: string | null, b: string | null): boolean {
  return (toHexColor(a) ?? a) === (toHexColor(b) ?? b);
}

/**
 * lat / lon は取り込み側・DB側の双方を小数6桁へ揃えてから比べる。
 * CSV は `139.74044`、DB から読み戻すと `139.740440` になるため、
 * 揃えないと値が同じでも毎回「更新あり」になり冪等性が成立しない。
 */
function sameDecimal(a: string | null, b: string | null): boolean {
  return toDecimal6(a) === toDecimal6(b);
}

class BlockerCollector {
  private readonly buckets = new Map<ImportBlockerCode, { count: number; samples: string[] }>();

  add(code: ImportBlockerCode, sample: string): void {
    const bucket = this.buckets.get(code) ?? { count: 0, samples: [] };
    bucket.count += 1;
    if (bucket.samples.length < SAMPLE_LIMIT) bucket.samples.push(sample);
    this.buckets.set(code, bucket);
  }

  toArray(): ImportBlocker[] {
    return [...this.buckets].map(([code, bucket]) => ({ code, ...bucket }));
  }
}

function emptyDiff(): TableDiff {
  return { created: 0, updated: 0, unchanged: 0, abolished: 0 };
}

export function computeImportPlan(
  records: ImportedRecords,
  snapshot: MasterSnapshot,
  /** 廃止日が CSV から得られない場合に使う実行日（YYYY-MM-DD） */
  runDate: string,
): ImportPlan {
  const blockers = new BlockerCollector();

  const operators = planOperators(records.operators, snapshot, blockers);
  const lines = planLines(records, snapshot, runDate);
  const stationGroups = planStationGroups(records.stationGroups, snapshot);
  const stations = planStations(records, snapshot, runDate);

  const lineIdByCd = idByCode(snapshot.lines, (l) => l.ekidataLineCd);
  const stationIdByCd = idByCode(snapshot.stations, (s) => s.ekidataStationCd);

  const stationLines = planStationLines(records.stations, snapshot, lineIdByCd, stationIdByCd);
  const adjacencies = planAdjacencies(records.adjacencies, snapshot, lineIdByCd, stationIdByCd);

  return {
    summary: {
      operators: operators.diff,
      lines: lines.diff,
      stationGroups: stationGroups.diff,
      stations: stations.diff,
      stationLines: { created: stationLines.length },
      stationAdjacencies: { created: adjacencies.length },
      stationConnections: { upperBound: countTransferPairs(records.stations) },
    },
    changes: {
      operators: { write: operators.write },
      lines: { write: lines.write, abolish: lines.abolish },
      stationGroups: { write: stationGroups.write },
      stations: { write: stations.write, abolish: stations.abolish },
      stationLines,
      adjacencies,
    },
    warnings: records.warnings,
    blockers: blockers.toArray(),
  };
}

function idByCode<T extends { id: string }>(
  rows: readonly T[],
  code: (row: T) => number | null,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of rows) {
    const cd = code(row);
    if (cd !== null) map.set(cd, row.id);
  }
  return map;
}

// --- 事業者 ---

function planOperators(
  imported: readonly ImportedOperator[],
  snapshot: MasterSnapshot,
  blockers: BlockerCollector,
) {
  const byCd = new Map(
    snapshot.operators
      .filter((o) => o.ekidataCompanyCd !== null)
      .map((o) => [o.ekidataCompanyCd!, o] as const),
  );
  // operators.name は一意制約付きである。どの行がその名前を持っているかを追う
  const ownerOfName = new Map(snapshot.operators.map((o) => [o.name, o.id] as const));

  const write: ImportedOperator[] = [];
  const diff = emptyDiff();

  for (const row of imported) {
    const existing = byCd.get(row.ekidataCompanyCd);

    const name = keepName(row.name, existing?.name ?? '');
    const owner = ownerOfName.get(name);
    if (owner !== undefined && owner !== existing?.id) {
      // 【Phase 3 の突合前に流すと必ずここに落ちる】現行DBの17事業者の name は
      // ekidata の company_name と全件一致するが、ekidataCompanyCd がまだ NULL のため
      // 別行として INSERT され、operators_name_unique に衝突して
      // トランザクション全体が 23505 で失敗する
      blockers.add('operator_name_conflict', `company_cd=${row.ekidataCompanyCd} name=${name}`);
      continue;
    }

    if (!existing) {
      write.push(row);
      ownerOfName.set(name, `pending:${row.ekidataCompanyCd}`);
      diff.created += 1;
      continue;
    }

    if (existing.name === name) {
      diff.unchanged += 1;
      continue;
    }
    ownerOfName.delete(existing.name);
    ownerOfName.set(name, existing.id);
    write.push(row);
    diff.updated += 1;
  }

  // operators に abolishedAt 列は無いため、廃止は記録しない
  return { diff, write };
}

// --- 路線 ---

function planLines(records: ImportedRecords, snapshot: MasterSnapshot, runDate: string) {
  const byCd = new Map(
    snapshot.lines
      .filter((l) => l.ekidataLineCd !== null)
      .map((l) => [l.ekidataLineCd!, l] as const),
  );

  const write: ImportedLine[] = [];
  const diff = emptyDiff();
  const activeCds = new Set<number>();

  for (const row of records.lines) {
    activeCds.add(row.ekidataLineCd);
    const existing = byCd.get(row.ekidataLineCd);
    if (!existing) {
      write.push(row);
      diff.created += 1;
      continue;
    }

    const unchanged =
      keepName(row.name, existing.name) === existing.name &&
      keep(row.nameKana, existing.nameKana) === existing.nameKana &&
      sameColor(keep(row.color, existing.color), existing.color) &&
      existing.abolishedAt === null;

    if (unchanged) diff.unchanged += 1;
    else {
      write.push(row);
      diff.updated += 1;
    }
  }

  const abolish = markAbolished(
    snapshot.lines,
    (l) => l.ekidataLineCd,
    activeCds,
    records.seen.lines,
    records.closures.lines,
    runDate,
  );
  diff.abolished = abolish.length;

  return { diff, write, abolish };
}

// --- 乗換単位の駅 ---

function planStationGroups(imported: readonly ImportedStationGroup[], snapshot: MasterSnapshot) {
  const byCd = new Map(
    snapshot.stationGroups.map((g) => [g.ekidataStationGroupCd, g] as const),
  );

  const write: ImportedStationGroup[] = [];
  const diff = emptyDiff();

  for (const row of imported) {
    const existing = byCd.get(row.ekidataStationGroupCd);
    if (!existing) {
      write.push(row);
      diff.created += 1;
      continue;
    }

    const unchanged =
      keepName(row.name, existing.name) === existing.name &&
      keep(row.nameKana, existing.nameKana) === existing.nameKana &&
      keep(row.prefCode, existing.prefCode) === existing.prefCode &&
      sameDecimal(keep(row.lat, existing.lat), existing.lat) &&
      sameDecimal(keep(row.lon, existing.lon), existing.lon);

    if (unchanged) diff.unchanged += 1;
    else {
      write.push(row);
      diff.updated += 1;
    }
  }

  // station_g_cd は乗換の単位でしかなく、廃止という状態を持たない
  return { diff, write };
}

// --- 駅 ---

function planStations(records: ImportedRecords, snapshot: MasterSnapshot, runDate: string) {
  const byCd = new Map(
    snapshot.stations
      .filter((s) => s.ekidataStationCd !== null)
      .map((s) => [s.ekidataStationCd!, s] as const),
  );
  // 既存駅がどの station_g_cd に属しているかは、UUID を経由しないと分からない
  const groupCdById = new Map(
    snapshot.stationGroups.map((g) => [g.id, g.ekidataStationGroupCd] as const),
  );
  const currentGroupCd = (station: ExistingStation) =>
    station.stationGroupId === null ? null : (groupCdById.get(station.stationGroupId) ?? null);

  const write: ImportedStation[] = [];
  const diff = emptyDiff();
  const activeCds = new Set<number>();

  for (const row of records.stations) {
    activeCds.add(row.ekidataStationCd);
    const existing = byCd.get(row.ekidataStationCd);
    if (!existing) {
      write.push(row);
      diff.created += 1;
      continue;
    }

    const unchanged =
      keepName(row.name, existing.name) === existing.name &&
      keep(row.nameKana, existing.nameKana) === existing.nameKana &&
      sameDecimal(keep(row.lat, existing.lat), existing.lat) &&
      sameDecimal(keep(row.lon, existing.lon), existing.lon) &&
      keep(row.prefCode, existing.prefCode) === existing.prefCode &&
      row.ekidataStationGroupCd === currentGroupCd(existing) &&
      existing.abolishedAt === null;

    if (unchanged) diff.unchanged += 1;
    else {
      write.push(row);
      diff.updated += 1;
    }
  }

  const abolish = markAbolished(
    snapshot.stations,
    (s) => s.ekidataStationCd,
    activeCds,
    records.seen.stations,
    records.closures.stations,
    runDate,
  );
  diff.abolished = abolish.length;

  return { diff, write, abolish };
}

/**
 * DB にあるが ekidata から消えた行に廃止日を立てる。**行は削除しない**（REQ-8.3）。
 * platforms / lineDirections からの参照を切らないためである。
 *
 * 廃止と見なすのは次の2つだけである:
 *   1. CSV に `e_status = 2` として載っていた（`closures` に入る）。日付は CSV の値、
 *      無ければ実行日
 *   2. CSV のどのファイルにも現れなかった（`seenCds` に無い）。日付は実行日
 *
 * `seenCds` にはあるが現役として取り込まれなかった行（未開業、現役でない事業者・
 * 路線に紐づく行）は**廃止しない**。まだ存在する駅・路線であり、供給元の一時的な
 * 不備で公開データを消さないためである。取り込まれない旨は別途 warning に出る。
 */
function markAbolished<T extends { id: string; abolishedAt: string | null }>(
  existing: readonly T[],
  code: (row: T) => number | null,
  activeCds: ReadonlySet<number>,
  seenCds: ReadonlySet<number>,
  closures: ReadonlyMap<number, string | null>,
  runDate: string,
): AbolishMark[] {
  const marks: AbolishMark[] = [];
  for (const row of existing) {
    const cd = code(row);
    if (cd === null) continue; // 未突合の行は ekidata の関知するところではない
    if (activeCds.has(cd)) continue; // 現役として取り込んだ
    if (row.abolishedAt !== null) continue; // 既に廃止済み。上書きしない

    if (closures.has(cd)) {
      // e_status = 2。CSV が廃止を明示した
      marks.push({ id: row.id, abolishedAt: closures.get(cd) ?? runDate });
      continue;
    }
    // CSV にコードはあるが取り込まなかった（未開業・現役でない事業者/路線）。消えたのではない
    if (seenCds.has(cd)) continue;

    // どのファイルにも現れなかった。ekidata から消えたとみなす
    marks.push({ id: row.id, abolishedAt: runDate });
  }
  return marks;
}

// --- 駅と路線の関連 ---

function planStationLines(
  imported: readonly ImportedStation[],
  snapshot: MasterSnapshot,
  lineIdByCd: ReadonlyMap<number, string>,
  stationIdByCd: ReadonlyMap<number, string>,
): ImportChanges['stationLines'] {
  const existingPairs = new Set(snapshot.stationLinePairs.map((p) => `${p.stationId}:${p.lineId}`));

  const created: ImportChanges['stationLines'] = [];
  for (const station of imported) {
    const stationId = stationIdByCd.get(station.ekidataStationCd);
    const lineId = lineIdByCd.get(station.ekidataLineCd);
    // どちらかが新規なら、その組は必ず存在しない
    if (stationId && lineId && existingPairs.has(`${stationId}:${lineId}`)) continue;
    created.push({
      ekidataStationCd: station.ekidataStationCd,
      ekidataLineCd: station.ekidataLineCd,
    });
  }
  return created;
}

/**
 * 無向辺のキー。端点を昇順に並べ、(A,B) と (B,A) を同一の辺として扱う。
 * unique_station_adjacency は端点の順序に依存するため、DB への挿入時にも
 * masterImportRepository が UUID を同じ規則で昇順へ正規化する。
 */
function undirectedKey(lineId: string, end1: string, end2: string): string {
  const [lo, hi] = end1 <= end2 ? [end1, end2] : [end2, end1];
  return `${lineId}:${lo}:${hi}`;
}

function planAdjacencies(
  imported: readonly ImportedAdjacency[],
  snapshot: MasterSnapshot,
  lineIdByCd: ReadonlyMap<number, string>,
  stationIdByCd: ReadonlyMap<number, string>,
): ImportedAdjacency[] {
  const existingKeys = new Set(
    snapshot.stationAdjacencyKeys.map((a) => undirectedKey(a.lineId, a.stationAId, a.stationBId)),
  );

  // CSV 内に同じ辺が両向きで入っていても片方だけ残す。ekidata コードでキーを作るので
  // 初回投入（駅がまだ DB に無く UUID を解決できない）でも効く
  const planned = new Set<string>();
  const result: ImportedAdjacency[] = [];
  for (const row of imported) {
    const codeKey = undirectedKey(
      `${row.ekidataLineCd}`,
      `${row.ekidataStationCdA}`,
      `${row.ekidataStationCdB}`,
    );
    if (planned.has(codeKey)) continue;
    planned.add(codeKey);

    const lineId = lineIdByCd.get(row.ekidataLineCd);
    const a = stationIdByCd.get(row.ekidataStationCdA);
    const b = stationIdByCd.get(row.ekidataStationCdB);
    if (lineId && a && b && existingKeys.has(undirectedKey(lineId, a, b))) continue;

    result.push(row);
  }
  return result;
}

/**
 * 同一 station_g_cd に属する現役駅の全順序対の数（REQ-4.1）。
 * 実際に何行挿入されるかは DB の状態に依存するため、これは上限である。
 */
function countTransferPairs(stations: readonly ImportedStation[]): number {
  const sizes = new Map<number, number>();
  for (const station of stations) {
    sizes.set(station.ekidataStationGroupCd, (sizes.get(station.ekidataStationGroupCd) ?? 0) + 1);
  }
  let pairs = 0;
  for (const n of sizes.values()) pairs += n * (n - 1);
  return pairs;
}
