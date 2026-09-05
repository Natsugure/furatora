import { parseCsv, missingColumns, columnReader, CsvFormatError, type CsvTable } from './csv';
import type {
  EkidataCsvFiles,
  EkidataCsvSource,
  CsvFileKey,
  CsvParseError,
  ParseResult,
} from '@/features/master-import/ports';
import type {
  ImportedAdjacency,
  ImportedLine,
  ImportedOperator,
  ImportedRecords,
  ImportedStation,
  ImportedStationGroup,
  ImportWarning,
  ImportWarningCode,
} from '@/features/master-import/domain/importedRecords';
import { SAMPLE_LIMIT } from '@/features/master-import/domain/importedRecords';
import {
  emptyToNull,
  toDateOrNull,
  toDecimal6,
  toHexColor,
} from '@/features/master-import/domain/values';

/**
 * ekidata CSV の形式知識を閉じ込める層（docs/spec/design.md）。
 * DB には触れないため、テストは domain と同様に単体で書ける。
 *
 * 【e_status の意味】0 = 現役 / 1 = 未開業 / 2 = 廃止。
 * 取り込むのは 0 のみである。1 は「まだ存在しない」ので取り込まず、
 * かといって廃止でもないため abolishedAt も設定しない（件数だけ警告に出す）。
 */
const ACTIVE = '0';
const NOT_YET_OPENED = '1';
const ABOLISHED = '2';

const FILE_ORDER = ['company', 'line', 'station', 'join'] as const;

const REQUIRED_COLUMNS: Record<CsvFileKey, readonly string[]> = {
  company: ['company_cd', 'company_name', 'e_status'],
  line: ['line_cd', 'company_cd', 'line_name', 'line_name_k', 'line_color_c', 'e_status'],
  station: [
    'station_cd',
    'station_g_cd',
    'station_name',
    'station_name_k',
    'line_cd',
    'pref_cd',
    'lon',
    'lat',
    'close_ymd',
    'e_status',
  ],
  join: ['line_cd', 'station_cd1', 'station_cd2'],
};

/** 警告を件数と手がかりに畳み込む。1万件の警告を1件ずつ返しても読めない */
class WarningCollector {
  private readonly buckets = new Map<ImportWarningCode, { count: number; samples: string[] }>();

  add(code: ImportWarningCode, sample: string): void {
    const bucket = this.buckets.get(code) ?? { count: 0, samples: [] };
    bucket.count += 1;
    if (bucket.samples.length < SAMPLE_LIMIT) bucket.samples.push(sample);
    this.buckets.set(code, bucket);
  }

  toArray(): ImportWarning[] {
    return [...this.buckets].map(([code, bucket]) => ({ code, ...bucket }));
  }
}

function requireInt(raw: string, file: CsvFileKey, column: string, lineNo: number): number {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(n)) {
    throw new CsvFormatError(`${file} CSV の ${lineNo} 行目、${column} が整数でない: ${raw}`);
  }
  return n;
}

function optionalInt(raw: string): number | null {
  const value = emptyToNull(raw);
  if (value === null) return null;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
}

export const ekidataCsvSource: EkidataCsvSource = {
  parse(files: EkidataCsvFiles): ParseResult {
    const errors: CsvParseError[] = [];
    const tables = new Map<CsvFileKey, CsvTable>();

    // 先に4ファイルすべてを検査する。1つ目で打ち切ると、管理者が
    // 「直しては弾かれる」を4回繰り返すことになる
    for (const file of FILE_ORDER) {
      try {
        const table = parseCsv(files[file]);
        const missing = missingColumns(table.header, REQUIRED_COLUMNS[file]);
        if (missing.length > 0) {
          errors.push({ kind: 'missing_columns', file, columns: missing });
          continue;
        }
        tables.set(file, table);
      } catch (error) {
        errors.push({
          kind: 'malformed',
          file,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    try {
      return {
        ok: true,
        records: buildRecords({
          company: tables.get('company')!,
          line: tables.get('line')!,
          station: tables.get('station')!,
          join: tables.get('join')!,
        }),
      };
    } catch (error) {
      if (error instanceof CsvFormatError) {
        return {
          ok: false,
          errors: [{ kind: 'malformed', file: fileOf(error.message), message: error.message }],
        };
      }
      throw error;
    }
  },

  async digest(files: EkidataCsvFiles): Promise<string> {
    // 4ファイルの本文を固定順で連結する。各ブロックの頭にファイル名と長さを置くのは、
    // 一方の末尾ともう一方の先頭が入れ替わっただけの入力を同一視しないため。
    // 長さが前置されているので、区切り文字自体は改行で足りる
    const payload = FILE_ORDER.map((key) => `${key}:${files[key].length}\n${files[key]}`).join('\n');
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },
};

/** buildRecords が投げる CsvFormatError は先頭にファイル名を書いている */
function fileOf(message: string): CsvFileKey {
  return FILE_ORDER.find((key) => message.startsWith(`${key} CSV`)) ?? 'station';
}

function buildRecords(tables: Record<CsvFileKey, CsvTable>): ImportedRecords {
  const warnings = new WarningCollector();

  // --- 事業者 ---
  const readCompany = columnReader(tables.company.header);
  const operators: ImportedOperator[] = [];
  const activeCompanyCds = new Set<number>();
  tables.company.rows.forEach((row, i) => {
    if (readCompany(row, 'e_status') !== ACTIVE) return;
    const cd = requireInt(readCompany(row, 'company_cd'), 'company', 'company_cd', i + 2);
    activeCompanyCds.add(cd);
    operators.push({ ekidataCompanyCd: cd, name: readCompany(row, 'company_name').trim() });
  });

  // --- 路線 ---
  const readLine = columnReader(tables.line.header);
  const lines: ImportedLine[] = [];
  const activeLineCds = new Set<number>();
  const seenLineCds = new Set<number>();
  const lineClosures = new Map<number, string | null>();
  tables.line.rows.forEach((row, i) => {
    const status = readLine(row, 'e_status');
    const cd = requireInt(readLine(row, 'line_cd'), 'line', 'line_cd', i + 2);
    // e_status や取り込み可否を問わず、CSV に載っていた line_cd をすべて記録する。
    // 廃止判定が「消えた」と「取り込まなかった」を取り違えないため
    seenLineCds.add(cd);

    if (status === ABOLISHED) {
      // line CSV に廃止日の列は無い。日付は適用時の実行日で埋める
      lineClosures.set(cd, null);
      return;
    }
    if (status === NOT_YET_OPENED) {
      warnings.add('not_yet_opened_line', `line_cd=${cd} ${readLine(row, 'line_name')}`);
      return;
    }
    if (status !== ACTIVE) return;

    const companyCd = requireInt(readLine(row, 'company_cd'), 'line', 'company_cd', i + 2);
    if (!activeCompanyCds.has(companyCd)) {
      warnings.add('line_with_unknown_company', `line_cd=${cd} company_cd=${companyCd}`);
      return;
    }

    activeLineCds.add(cd);
    lines.push({
      ekidataLineCd: cd,
      ekidataCompanyCd: companyCd,
      name: readLine(row, 'line_name').trim(),
      nameKana: emptyToNull(readLine(row, 'line_name_k')),
      color: toHexColor(readLine(row, 'line_color_c')),
    });
  });

  // --- 駅 ---
  const readStation = columnReader(tables.station.header);
  const stations: ImportedStation[] = [];
  const activeStationCds = new Set<number>();
  const seenStationCds = new Set<number>();
  const stationClosures = new Map<number, string | null>();
  tables.station.rows.forEach((row, i) => {
    const status = readStation(row, 'e_status');
    const cd = requireInt(readStation(row, 'station_cd'), 'station', 'station_cd', i + 2);
    seenStationCds.add(cd);

    if (status === ABOLISHED) {
      stationClosures.set(cd, toDateOrNull(readStation(row, 'close_ymd')));
      return;
    }
    if (status === NOT_YET_OPENED) {
      warnings.add('not_yet_opened_station', `station_cd=${cd} ${readStation(row, 'station_name')}`);
      return;
    }
    if (status !== ACTIVE) return;

    // 【station_cd の上位桁から line_cd を導出しないこと】137件の例外がある。
    // 路線は必ず line_cd 列から読む
    const lineCd = requireInt(readStation(row, 'line_cd'), 'station', 'line_cd', i + 2);
    if (!activeLineCds.has(lineCd)) {
      warnings.add('station_with_unknown_line', `station_cd=${cd} line_cd=${lineCd}`);
      return;
    }

    activeStationCds.add(cd);
    stations.push({
      ekidataStationCd: cd,
      ekidataLineCd: lineCd,
      ekidataStationGroupCd: requireInt(
        readStation(row, 'station_g_cd'),
        'station',
        'station_g_cd',
        i + 2,
      ),
      name: readStation(row, 'station_name').trim(),
      nameKana: emptyToNull(readStation(row, 'station_name_k')),
      lat: toDecimal6(readStation(row, 'lat')),
      lon: toDecimal6(readStation(row, 'lon')),
      prefCode: optionalInt(readStation(row, 'pref_cd')),
    });
  });

  const stationGroups = buildStationGroups(stations, warnings);

  // --- 隣接（join） ---
  const readJoin = columnReader(tables.join.header);
  const adjacencies: ImportedAdjacency[] = [];
  tables.join.rows.forEach((row, i) => {
    const lineCd = requireInt(readJoin(row, 'line_cd'), 'join', 'line_cd', i + 2);
    const a = requireInt(readJoin(row, 'station_cd1'), 'join', 'station_cd1', i + 2);
    const b = requireInt(readJoin(row, 'station_cd2'), 'join', 'station_cd2', i + 2);

    if (!activeLineCds.has(lineCd)) {
      warnings.add('adjacency_unknown_line', `line_cd=${lineCd} (${a}-${b})`);
      return;
    }
    // 端点が現役でない行は FK を張れないため取り込めない。
    // stationAdjacencies は無向辺を1行で持つ。逆向きの重複は 2026-08 実データで0件だが、
    // それに依存せず plan.ts / masterImportRepository.ts が端点順を正規化して弾く
    if (!activeStationCds.has(a) || !activeStationCds.has(b)) {
      warnings.add('adjacency_endpoint_missing', `line_cd=${lineCd} ${a}-${b}`);
      return;
    }

    adjacencies.push({ ekidataLineCd: lineCd, ekidataStationCdA: a, ekidataStationCdB: b });
  });

  return {
    operators,
    lines,
    stationGroups,
    stations,
    adjacencies,
    closures: { lines: lineClosures, stations: stationClosures },
    seen: { lines: seenLineCds, stations: seenStationCds },
    warnings: warnings.toArray(),
  };
}

/**
 * station_g_cd ごとに代表値を決める。
 *
 * 通常は `station_cd === station_g_cd` の駅が代表である。実データでは
 * その駅が廃止済み、あるいはどの station_cd にも存在しないグループが59件あり、
 * その場合も**グループを破棄しない**（REQ-8.2）。所属する現役駅のうち
 * 最小の station_cd を代表として扱う。
 */
function buildStationGroups(
  stations: readonly ImportedStation[],
  warnings: WarningCollector,
): ImportedStationGroup[] {
  const members = new Map<number, ImportedStation[]>();
  for (const station of stations) {
    const list = members.get(station.ekidataStationGroupCd);
    if (list) list.push(station);
    else members.set(station.ekidataStationGroupCd, [station]);
  }

  const groups: ImportedStationGroup[] = [];
  for (const [groupCd, list] of members) {
    const exact = list.find((s) => s.ekidataStationCd === groupCd);
    const representative =
      exact ?? list.reduce((min, s) => (s.ekidataStationCd < min.ekidataStationCd ? s : min));
    if (!exact) {
      warnings.add(
        'dangling_station_group',
        `station_g_cd=${groupCd} → station_cd=${representative.ekidataStationCd}`,
      );
    }
    groups.push({
      ekidataStationGroupCd: groupCd,
      name: representative.name,
      nameKana: representative.nameKana,
      prefCode: representative.prefCode,
      lat: representative.lat,
      lon: representative.lon,
    });
  }

  return groups.sort((a, b) => a.ekidataStationGroupCd - b.ekidataStationGroupCd);
}
