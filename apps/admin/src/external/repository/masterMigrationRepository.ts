import { db } from '@furatora/database/client';
import { withTransaction, type Tx } from '@furatora/database/tx';
import { lines, operators, stationConnections, stationLines, stations } from '@furatora/database/schema';
import { sql } from 'drizzle-orm';
import { computeMigrationPlan } from '@/features/master-migration/domain/match';
import type {
  Assignment,
  ConnectionCounts,
  MigrationResult,
  MigrationSnapshot,
} from '@/features/master-migration/domain/migrationPlan';
import { MigrationBlockedError, type MasterMigrationRepository } from '@/features/master-migration/ports';
import type { ImportedRecords } from '@/features/master-import/domain/importedRecords';

/**
 * ODPT 由来の既存行に ekidata コードを突合して書き込む（Issue #56 Phase 3）。
 *
 * 【id を変えない】既存の stations / lines は platforms・lineDirections から
 * 参照されている。行を作り直すと設備データが孤児になるため UPDATE で埋める
 * （ADR-0007「影響」/ REQ-3.4）。
 *
 * 【規模】書き込むのは 事業者17 + 路線62 + 駅481 + 乗換接続546 の 1,100行程度で、
 * 取り込み（約47,800行 / 7〜8秒）とは桁が2つ違う。バッチ分割は要らない。
 *
 * 【スナップショットはトランザクションの内側で取り直す】masterImportRepository と
 * 同じ理由による。試算を見せてから承認するまでの間に DB が変わっていても、
 * 書き込みが古い前提に基づかないようにする。
 */

/** 差分算出に必要な読み取りだけを行う。db（neon-http）と tx のどちらからでも呼べる */
type SnapshotReader = Pick<Tx, 'select'>;

/**
 * 全置換で消してよい乗換接続の条件（TASK-3.5）。
 *
 * source が NULL の行は ODPT 同期が作ったものであり、station_g_cd から作り直せる。
 * source='manual' は人が足した乗換（新宿 ⇔ 新宿西口 のように g_cd が捉えないもの）、
 * 'ekidata_group' は既にインポートが作ったものであり、どちらも消さない。
 *
 * 難易度・メモが入っている行を条件から外しているのは、**守るべき行に
 * 構造的に触れないようにする**ためである。0件であることは実測済みだが
 * （main: 546件すべて未入力）、実測に依存せず条件で守る。
 * 0件でない場合は blocker が先に停止させる
 */
const REPLACEABLE_CONNECTION = sql`
  source IS NULL
  AND stroller_difficulty IS NULL
  AND wheelchair_difficulty IS NULL
  AND notes_about_stroller IS NULL
  AND notes_about_wheelchair IS NULL
`;

async function readSnapshot(reader: SnapshotReader): Promise<MigrationSnapshot> {
  const operatorRows = await reader
    .select({
      id: operators.id,
      name: operators.name,
      odptOperatorId: operators.odptOperatorId,
      ekidataCompanyCd: operators.ekidataCompanyCd,
    })
    .from(operators);

  const lineRows = await reader
    .select({
      id: lines.id,
      name: lines.name,
      operatorId: lines.operatorId,
      ekidataLineCd: lines.ekidataLineCd,
    })
    .from(lines);

  const stationRows = await reader
    .select({
      id: stations.id,
      name: stations.name,
      ekidataStationCd: stations.ekidataStationCd,
    })
    .from(stations);

  const pairs = await reader
    .select({ stationId: stationLines.stationId, lineId: stationLines.lineId })
    .from(stationLines);

  const connections = await readConnectionCounts(reader);

  // 1駅が複数路線を持つことを禁じていないため、路線は配列で束ねる
  const lineIdsByStation = new Map<string, string[]>();
  for (const pair of pairs) {
    const owned = lineIdsByStation.get(pair.stationId);
    if (owned) owned.push(pair.lineId);
    else lineIdsByStation.set(pair.stationId, [pair.lineId]);
  }

  return {
    operators: operatorRows,
    lines: lineRows,
    stations: stationRows.map((station) => ({
      ...station,
      lineIds: lineIdsByStation.get(station.id) ?? [],
    })),
    connections,
  };
}

async function readConnectionCounts(reader: SnapshotReader): Promise<ConnectionCounts> {
  const [row] = await reader
    .select({
      total: sql<number>`count(*)::int`,
      replaceable: sql<number>`count(*) FILTER (WHERE ${REPLACEABLE_CONNECTION})::int`,
      withInput: sql<number>`count(*) FILTER (WHERE source IS NULL AND NOT (${REPLACEABLE_CONNECTION}))::int`,
    })
    .from(stationConnections);

  return row ?? { total: 0, replaceable: 0, withInput: 0 };
}

export const dbMasterMigrationRepository: MasterMigrationRepository = {
  async loadSnapshot() {
    return readSnapshot(db);
  },

  async apply(records: ImportedRecords): Promise<MigrationResult> {
    return withTransaction(async (tx) => {
      const snapshot = await readSnapshot(tx);
      const plan = computeMigrationPlan(records, snapshot);

      // 試算で提示済みの事象。ここに来るのは、提示から承認までの間に
      // DB が変わった場合か、UI を経由せず叩かれた場合である
      if (plan.blockers.length > 0) throw new MigrationBlockedError();

      await assignCodes(tx, 'operators', 'ekidata_company_cd', plan.operators.assigned);
      await assignCodes(tx, 'lines', 'ekidata_line_cd', plan.lines.assigned);
      await assignCodes(tx, 'stations', 'ekidata_station_cd', plan.stations.assigned);

      // TASK-3.5: ODPT 由来の乗換接続を落とす。埋め直すのはインポート側の
      // INSERT ... SELECT（TASK-2.8）である。この削除から取り込みまでの間、
      // 公開サイトの乗換接続は空になるため、続けて実行すること
      const deleted = await tx.delete(stationConnections).where(REPLACEABLE_CONNECTION);

      return {
        operators: { assigned: plan.operators.assigned.length },
        lines: { assigned: plan.lines.assigned.length },
        stations: { assigned: plan.stations.assigned.length },
        stationConnections: { deleted: deleted.rowCount ?? 0 },
      };
    });
  },
};

/**
 * 1テーブル1文で UPDATE する。
 *
 * 行ごとに UPDATE を投げると駅481行で481往復になり、1往復あたり約140ms
 * （TASK-1.1 実測）で1分を超える。VALUES を結合した1文なら 481行 × 2 = 962 の
 * bind パラメータで、1文あたりの上限 65535 の内側に十分収まる。
 */
async function assignCodes(
  tx: Tx,
  table: 'operators' | 'lines' | 'stations',
  column: 'ekidata_company_cd' | 'ekidata_line_cd' | 'ekidata_station_cd',
  assignments: readonly Assignment[],
): Promise<void> {
  if (assignments.length === 0) return;

  const values = sql.join(
    assignments.map((a) => sql`(${a.id}::uuid, ${a.code}::integer)`),
    sql`, `,
  );

  await tx.execute(sql`
    UPDATE ${sql.identifier(table)} AS t
    SET ${sql.identifier(column)} = v.code
    FROM (VALUES ${values}) AS v(id, code)
    WHERE t.id = v.id
  `);
}
