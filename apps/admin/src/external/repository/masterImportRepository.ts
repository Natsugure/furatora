import { db } from '@furatora/database/client';
import { withTransaction, type Tx } from '@furatora/database/tx';
import {
  lines,
  operators,
  stationAdjacencies,
  stationGroups,
  stationLines,
  stations,
} from '@furatora/database/schema';
import { inArray, sql } from 'drizzle-orm';
import { ImportBlockedError, type MasterImportRepository } from '@/features/master-import/ports';
import { computeImportPlan } from '@/features/master-import/domain/plan';
import type {
  AbolishMark,
  ApplyResult,
  ImportedRecords,
  MasterSnapshot,
} from '@/features/master-import/domain/importedRecords';

/**
 * ekidata マスタの取り込み。
 *
 * 【単一トランザクション】約47,800行の投入は 7.3〜8.0 秒で成立することを
 * TASK-1.1 で実測している（`idle_in_transaction_session_timeout = 300,000ms` の 1/37）。
 * テーブル単位の分割コミットは採らない。
 *
 * 【パースはこの外で終わっていること】300,000ms は文と文の「間」にのみ効く制限であり、
 * バッチを連続投入している限りアイドルはネットワーク往復1回分でしかない。
 * トランザクション内で 1.7MB の CSV を解析すると、そこで初めてこの5分がリスクになる。
 *
 * 【スナップショットはトランザクションの内側で取り直す】plan の提示から
 * 承認までの間に DB が変わっていても、書き込みが古い前提に基づかないようにするため。
 * SELECT 数本のアイドルは上記の制限に対して無害である。
 */

/**
 * TASK-1.1 の採用値。
 * 【measure-tx-scale.ts の MAX_SAFE_BATCH = 4000 を流用しないこと】あれは計測用に
 * stations へ12列しか渡さないことを前提にした値である。bind パラメータ上限は
 * 1文あたり 65535 であり、本経路が渡す列数でも 1000 行なら十分内側に収まる。
 */
const BATCH_SIZE = 1000;

async function inBatches<T>(
  rows: readonly T[],
  apply: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await apply(rows.slice(i, i + BATCH_SIZE));
  }
}

/** 差分算出に必要な読み取りだけを行う。db（neon-http）と tx のどちらからでも呼べる */
type SnapshotReader = Pick<Tx, 'select'>;

async function readSnapshot(reader: SnapshotReader): Promise<MasterSnapshot> {
  const operatorRows = await reader
    .select({ id: operators.id, name: operators.name, ekidataCompanyCd: operators.ekidataCompanyCd })
    .from(operators);

  const lineRows = await reader
    .select({
      id: lines.id,
      ekidataLineCd: lines.ekidataLineCd,
      name: lines.name,
      nameKana: lines.nameKana,
      color: lines.color,
      abolishedAt: lines.abolishedAt,
    })
    .from(lines);

  const groupRows = await reader
    .select({
      id: stationGroups.id,
      ekidataStationGroupCd: stationGroups.ekidataStationGroupCd,
      name: stationGroups.name,
      nameKana: stationGroups.nameKana,
      prefCode: stationGroups.prefCode,
      lat: stationGroups.lat,
      lon: stationGroups.lon,
    })
    .from(stationGroups);

  const stationRows = await reader
    .select({
      id: stations.id,
      ekidataStationCd: stations.ekidataStationCd,
      name: stations.name,
      nameKana: stations.nameKana,
      lat: stations.lat,
      lon: stations.lon,
      prefCode: stations.prefCode,
      stationGroupId: stations.stationGroupId,
      abolishedAt: stations.abolishedAt,
    })
    .from(stations);

  const stationLinePairs = await reader
    .select({ stationId: stationLines.stationId, lineId: stationLines.lineId })
    .from(stationLines);

  const stationAdjacencyKeys = await reader
    .select({
      lineId: stationAdjacencies.lineId,
      stationAId: stationAdjacencies.stationAId,
      stationBId: stationAdjacencies.stationBId,
    })
    .from(stationAdjacencies);

  return {
    operators: operatorRows,
    lines: lineRows,
    stationGroups: groupRows,
    stations: stationRows,
    stationLinePairs,
    stationAdjacencyKeys,
  };
}

/** 廃止日ごとにまとめて UPDATE する。1行1文にすると往復回数がそのまま時間になる */
async function applyAbolishMarks(
  tx: Tx,
  marks: readonly AbolishMark[],
  table: typeof lines | typeof stations,
): Promise<void> {
  const byDate = new Map<string, string[]>();
  for (const mark of marks) {
    const ids = byDate.get(mark.abolishedAt);
    if (ids) ids.push(mark.id);
    else byDate.set(mark.abolishedAt, [mark.id]);
  }

  for (const [abolishedAt, ids] of byDate) {
    await inBatches(ids, (batch) =>
      tx.update(table).set({ abolishedAt }).where(inArray(table.id, batch)),
    );
  }
}

export const dbMasterImportRepository: MasterImportRepository = {
  loadSnapshot() {
    return readSnapshot(db);
  },

  async apply(records: ImportedRecords): Promise<ApplyResult> {
    const runDate = new Date().toISOString().slice(0, 10);

    return withTransaction(async (tx) => {
      const snapshot = await readSnapshot(tx);
      const plan = computeImportPlan(records, snapshot, runDate);

      // plan の時点で提示済みの事象。ここへ来たら適用せずに止める。
      // 素通しすると operators_name_unique 違反でトランザクション全体が落ちる
      if (plan.blockers.length > 0) throw new ImportBlockedError();

      const changes = plan.changes;

      // FK の依存順に投入する。順序を入れ替えてはならない。
      // 既存行の id はスナップショットから、新規行の id は returning から集める

      // --- 事業者 ---
      const operatorIdByCd = new Map<number, string>();
      for (const row of snapshot.operators) {
        if (row.ekidataCompanyCd !== null) operatorIdByCd.set(row.ekidataCompanyCd, row.id);
      }
      await inBatches(changes.operators.write, async (batch) => {
        const written = await tx
          .insert(operators)
          .values(batch.map((o) => ({ name: o.name, ekidataCompanyCd: o.ekidataCompanyCd })))
          .onConflictDoUpdate({
            target: operators.ekidataCompanyCd,
            // 【触らない列】displayPriority / odptOperatorId は SET に入れない
            set: { name: sql`COALESCE(NULLIF(EXCLUDED.name, ''), ${operators.name})` },
          })
          .returning({ id: operators.id, cd: operators.ekidataCompanyCd });
        for (const row of written) {
          if (row.cd !== null) operatorIdByCd.set(row.cd, row.id);
        }
      });

      // --- 路線 ---
      const lineIdByCd = new Map<number, string>();
      for (const row of snapshot.lines) {
        if (row.ekidataLineCd !== null) lineIdByCd.set(row.ekidataLineCd, row.id);
      }
      await inBatches(changes.lines.write, async (batch) => {
        const written = await tx
          .insert(lines)
          .values(
            batch.map((line) => ({
              name: line.name,
              nameKana: line.nameKana,
              color: line.color,
              ekidataLineCd: line.ekidataLineCd,
              operatorId: requireId(
                operatorIdByCd,
                line.ekidataCompanyCd,
                `line_cd=${line.ekidataLineCd} の company_cd`,
              ),
            })),
          )
          .onConflictDoUpdate({
            target: lines.ekidataLineCd,
            // 【触らない列】slug / nameEn / lineCode / displayOrder / operatorId は SET に入れない。
            // abolishedAt は「現役として再登場した」ことを表すため NULL に戻す
            set: {
              name: sql`COALESCE(NULLIF(EXCLUDED.name, ''), ${lines.name})`,
              nameKana: sql`COALESCE(NULLIF(EXCLUDED.name_kana, ''), ${lines.nameKana})`,
              color: sql`COALESCE(NULLIF(EXCLUDED.color, ''), ${lines.color})`,
              abolishedAt: null,
              updatedAt: new Date(),
            },
          })
          .returning({ id: lines.id, cd: lines.ekidataLineCd });
        for (const row of written) {
          if (row.cd !== null) lineIdByCd.set(row.cd, row.id);
        }
      });
      await applyAbolishMarks(tx, changes.lines.abolish, lines);

      // --- 乗換単位の駅 ---
      const groupIdByCd = new Map<number, string>();
      for (const row of snapshot.stationGroups) {
        groupIdByCd.set(row.ekidataStationGroupCd, row.id);
      }
      await inBatches(changes.stationGroups.write, async (batch) => {
        const written = await tx
          .insert(stationGroups)
          .values(
            batch.map((group) => ({
              ekidataStationGroupCd: group.ekidataStationGroupCd,
              name: group.name,
              nameKana: group.nameKana,
              prefCode: group.prefCode,
              lat: group.lat,
              lon: group.lon,
            })),
          )
          .onConflictDoUpdate({
            target: stationGroups.ekidataStationGroupCd,
            set: {
              name: sql`COALESCE(NULLIF(EXCLUDED.name, ''), ${stationGroups.name})`,
              nameKana: sql`COALESCE(NULLIF(EXCLUDED.name_kana, ''), ${stationGroups.nameKana})`,
              prefCode: sql`COALESCE(EXCLUDED.pref_code, ${stationGroups.prefCode})`,
              lat: sql`COALESCE(EXCLUDED.lat, ${stationGroups.lat})`,
              lon: sql`COALESCE(EXCLUDED.lon, ${stationGroups.lon})`,
              updatedAt: new Date(),
            },
          })
          .returning({ id: stationGroups.id, cd: stationGroups.ekidataStationGroupCd });
        for (const row of written) groupIdByCd.set(row.cd, row.id);
      });

      // --- 駅 ---
      // 駅の事業者は「所属路線の事業者」である。ekidata の駅行は company_cd を持たない
      const companyCdByLineCd = new Map(
        records.lines.map((line) => [line.ekidataLineCd, line.ekidataCompanyCd] as const),
      );
      const stationIdByCd = new Map<number, string>();
      for (const row of snapshot.stations) {
        if (row.ekidataStationCd !== null) stationIdByCd.set(row.ekidataStationCd, row.id);
      }
      await inBatches(changes.stations.write, async (batch) => {
        const written = await tx
          .insert(stations)
          .values(
            batch.map((station) => ({
              name: station.name,
              nameKana: station.nameKana,
              lat: station.lat,
              lon: station.lon,
              prefCode: station.prefCode,
              ekidataStationCd: station.ekidataStationCd,
              stationGroupId: requireId(
                groupIdByCd,
                station.ekidataStationGroupCd,
                `station_cd=${station.ekidataStationCd} の station_g_cd`,
              ),
              operatorId: requireId(
                operatorIdByCd,
                requireId(
                  companyCdByLineCd,
                  station.ekidataLineCd,
                  `station_cd=${station.ekidataStationCd} の line_cd`,
                ),
                `station_cd=${station.ekidataStationCd} の事業者`,
              ),
            })),
          )
          .onConflictDoUpdate({
            target: stations.ekidataStationCd,
            // 【触らない列】slug / nameEn / code / notes / publishedAt / operatorId は SET に入れない。
            // publishedAt を触らないことが「可視性は管理者だけが決める」を成り立たせている
            set: {
              name: sql`COALESCE(NULLIF(EXCLUDED.name, ''), ${stations.name})`,
              nameKana: sql`COALESCE(NULLIF(EXCLUDED.name_kana, ''), ${stations.nameKana})`,
              lat: sql`COALESCE(EXCLUDED.lat, ${stations.lat})`,
              lon: sql`COALESCE(EXCLUDED.lon, ${stations.lon})`,
              prefCode: sql`COALESCE(EXCLUDED.pref_code, ${stations.prefCode})`,
              stationGroupId: sql`COALESCE(EXCLUDED.station_group_id, ${stations.stationGroupId})`,
              abolishedAt: null,
              updatedAt: new Date(),
            },
          })
          .returning({ id: stations.id, cd: stations.ekidataStationCd });
        for (const row of written) {
          if (row.cd !== null) stationIdByCd.set(row.cd, row.id);
        }
      });
      await applyAbolishMarks(tx, changes.stations.abolish, stations);

      // --- 駅と路線の関連 ---
      // stationOrder は書かない。ekidata に路線内順序を示す列が無く、
      // ODPT 由来の既存値（odpt:index）を壊さないためでもある
      await inBatches(changes.stationLines, (batch) =>
        tx
          .insert(stationLines)
          .values(
            batch.map((pair) => ({
              stationId: requireId(stationIdByCd, pair.ekidataStationCd, 'station_cd'),
              lineId: requireId(lineIdByCd, pair.ekidataLineCd, 'line_cd'),
            })),
          )
          .onConflictDoNothing(),
      );

      // --- 隣接 ---
      // stationAdjacencies は無向辺を1行で持つ。両方向を見るのは読み取り側の責務である。
      // 端点 UUID を昇順に固定することで、供給元が辺を逆向きに配布し直しても
      // unique_station_adjacency（端点の順序に依存する）に衝突して弾かれる
      await inBatches(changes.adjacencies, (batch) =>
        tx
          .insert(stationAdjacencies)
          .values(
            batch.map((adjacency) => {
              const lineId = requireId(lineIdByCd, adjacency.ekidataLineCd, 'line_cd');
              const end1 = requireId(stationIdByCd, adjacency.ekidataStationCdA, 'station_cd1');
              const end2 = requireId(stationIdByCd, adjacency.ekidataStationCdB, 'station_cd2');
              const [stationAId, stationBId] = end1 <= end2 ? [end1, end2] : [end2, end1];
              return { lineId, stationAId, stationBId };
            }),
          )
          .onConflictDoNothing(),
      );

      // --- 乗換接続（TASK-2.8） ---
      // 同一 station_g_cd の現役駅の全順序対を生成する。JS で数千行を組み立てず
      // 自己結合1文で済ませる。ON CONFLICT DO NOTHING が
      // source='manual' の行と難易度入力済みの行を守る（REQ-4.3 / REQ-4.4）
      const connections = await tx.execute(sql`
        INSERT INTO station_connections (station_id, connected_station_id, source)
        SELECT a.id, b.id, 'ekidata_group'
        FROM stations a
        JOIN stations b
          ON a.station_group_id = b.station_group_id
         AND a.id <> b.id
        WHERE a.station_group_id IS NOT NULL
          AND a.abolished_at IS NULL
          AND b.abolished_at IS NULL
        ON CONFLICT (station_id, connected_station_id) DO NOTHING
      `);

      return {
        operators: {
          created: plan.summary.operators.created,
          updated: plan.summary.operators.updated,
        },
        lines: {
          created: plan.summary.lines.created,
          updated: plan.summary.lines.updated,
          abolished: plan.summary.lines.abolished,
        },
        stationGroups: {
          created: plan.summary.stationGroups.created,
          updated: plan.summary.stationGroups.updated,
        },
        stations: {
          created: plan.summary.stations.created,
          updated: plan.summary.stations.updated,
          abolished: plan.summary.stations.abolished,
        },
        stationLines: { created: changes.stationLines.length },
        stationAdjacencies: { created: changes.adjacencies.length },
        stationConnections: { created: connections.rowCount ?? 0 },
      };
    });
  },
};

/**
 * FK の解決に失敗したら止める。パーサが参照の無い行を落としているため
 * 通常は起きないが、起きたまま進むと NOT NULL 違反という遠い場所で表面化する
 */
function requireId<T>(map: ReadonlyMap<number, T>, code: number, label: string): T {
  const value = map.get(code);
  if (value === undefined) {
    throw new Error(`${label} (${code}) を解決できない`);
  }
  return value;
}
