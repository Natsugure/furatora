import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stations, stationLines, lines } from '@stroller-transit-app/database/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lineId = searchParams.get('lineId');

  if (lineId) {
    const result = await db
      .select({
        id: stations.id,
        name: stations.name,
        nameEn: stations.nameEn,
        code: stations.code,
        stationOrder: stationLines.stationOrder,
      })
      .from(stationLines)
      .innerJoin(stations, eq(stationLines.stationId, stations.id))
      .where(eq(stationLines.lineId, lineId))
      .orderBy(asc(stationLines.stationOrder));
    return NextResponse.json(result);
  }

  const result = await db
    .select({
      id: stations.id,
      name: stations.name,
      nameEn: stations.nameEn,
      code: stations.code,
      operatorId: stations.operatorId,
    })
    .from(stations)
    .orderBy(asc(stations.name));
  return NextResponse.json(result);
}
