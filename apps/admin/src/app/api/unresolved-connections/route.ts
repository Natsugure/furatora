import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { sql } from 'drizzle-orm';

function parseOdptRailwayId(id: string) {
  const [, rest] = id.split(':');
  const parts = rest.split('.');
  return { operatorKey: parts[0], suggestedName: parts.slice(1).join(' ') };
}

function parseOdptStationId(id: string) {
  const [, rest] = id.split(':');
  const parts = rest.split('.');
  return {
    operatorKey: parts[0],
    suggestedLineName: parts[1] ?? '',
    suggestedName: parts.slice(2).join(' '),
  };
}

// neon-http は rows を直接配列で返す場合と { rows: [...] } で返す場合がある
function getRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const r = result as { rows?: Record<string, unknown>[] };
  return r.rows ?? [];
}

export async function GET() {
  try {
    const [railwayResult, stationResult] = await Promise.all([
      db.execute(sql`
        SELECT
          sc.odpt_railway_id,
          COUNT(*)::int AS reference_count,
          ARRAY_AGG(DISTINCT s.name ORDER BY s.name) AS referencing_station_names
        FROM station_connections sc
        JOIN stations s ON sc.station_id = s.id
        WHERE sc.connected_railway_id IS NULL
          AND sc.odpt_railway_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM lines l WHERE l.odpt_railway_id = sc.odpt_railway_id
          )
        GROUP BY sc.odpt_railway_id
        ORDER BY sc.odpt_railway_id
      `),
      db.execute(sql`
        SELECT
          sc.odpt_station_id,
          MAX(sc.odpt_railway_id) AS odpt_railway_id,
          COUNT(*)::int AS reference_count,
          ARRAY_AGG(DISTINCT s.name ORDER BY s.name) AS referencing_station_names
        FROM station_connections sc
        JOIN stations s ON sc.station_id = s.id
        WHERE sc.connected_station_id IS NULL
          AND sc.odpt_station_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM stations st WHERE st.odpt_station_id = sc.odpt_station_id
          )
        GROUP BY sc.odpt_station_id
        ORDER BY sc.odpt_station_id
      `),
    ]);

    const railways = getRows(railwayResult).map((row) => ({
      odptRailwayId: row.odpt_railway_id as string,
      referenceCount: row.reference_count as number,
      referencingStationNames: row.referencing_station_names as string[],
      ...parseOdptRailwayId(row.odpt_railway_id as string),
    }));

    const stations = getRows(stationResult).map((row) => ({
      odptStationId: row.odpt_station_id as string,
      odptRailwayId: row.odpt_railway_id as string | null,
      referenceCount: row.reference_count as number,
      referencingStationNames: row.referencing_station_names as string[],
      ...parseOdptStationId(row.odpt_station_id as string),
    }));

    return NextResponse.json({ railways, stations });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
