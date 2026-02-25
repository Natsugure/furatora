import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { platforms, stations, lines } from '@furatora/database/schema';
import { eq, inArray } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    if (!idsParam) return NextResponse.json([]);

    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length === 0) return NextResponse.json([]);

    const result = await db
      .select({
        id: platforms.id,
        platformNumber: platforms.platformNumber,
        stationName: stations.name,
        lineName: lines.name,
      })
      .from(platforms)
      .innerJoin(stations, eq(platforms.stationId, stations.id))
      .innerJoin(lines, eq(platforms.lineId, lines.id))
      .where(inArray(platforms.id, ids));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
