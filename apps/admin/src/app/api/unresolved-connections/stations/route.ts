import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { stations } from '@railease-navi/database/schema';
import { sql } from 'drizzle-orm';
import { unresolvedStationSchema } from '@/lib/validations';

function generateStationSlug(odptStationId: string): string {
  return odptStationId
    .replace('odpt.Station:', '')
    .replace(/\./g, '-')
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = unresolvedStationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    let resolvedStationId: string;

    if (parsed.data.action === 'create') {
      const { odptStationId, name, nameEn, code, operatorId } = parsed.data;
      const [station] = await db
        .insert(stations)
        .values({
          odptStationId,
          slug: generateStationSlug(odptStationId),
          name,
          nameEn: nameEn ?? null,
          code: code ?? null,
          operatorId,
        })
        .returning();
      resolvedStationId = station.id;
    } else {
      const { stationId } = parsed.data;
      resolvedStationId = stationId;
    }

    const odptStationId = parsed.data.odptStationId;
    // 同じ odptStationId を持つ未解決の接続を一括更新
    await db.execute(sql`
      UPDATE station_connections
      SET connected_station_id = ${resolvedStationId}
      WHERE odpt_station_id = ${odptStationId}
        AND connected_station_id IS NULL
    `);

    return NextResponse.json({ stationId: resolvedStationId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
