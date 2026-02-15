import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stations } from '@stroller-transit-app/database/schema';
import { sql } from 'drizzle-orm';

function generateStationSlug(odptStationId: string): string {
  return odptStationId
    .replace('odpt.Station:', '')
    .replace(/\./g, '-')
    .toLowerCase();
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, odptStationId, name, nameEn, code, operatorId, stationId } = body;

  let resolvedStationId: string;

  if (action === 'create') {
    const [station] = await db
      .insert(stations)
      .values({
        odptStationId,
        slug: generateStationSlug(odptStationId),
        name,
        nameEn: nameEn || null,
        code: code || null,
        operatorId,
      })
      .returning();
    resolvedStationId = station.id;
  } else if (action === 'link') {
    resolvedStationId = stationId;
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // 同じ odptStationId を持つ未解決の接続を一括更新
  await db.execute(sql`
    UPDATE station_connections
    SET connected_station_id = ${resolvedStationId}
    WHERE odpt_station_id = ${odptStationId}
      AND connected_station_id IS NULL
  `);

  return NextResponse.json({ stationId: resolvedStationId }, { status: 201 });
}
