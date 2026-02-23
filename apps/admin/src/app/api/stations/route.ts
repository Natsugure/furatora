import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { stations, stationLines, lines, stationConnections } from '@furatora/database/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('lineId');
    const connectedFromStationId = searchParams.get('connectedFrom');

    if (lineId && connectedFromStationId) {
      return NextResponse.json({ error: 'Cannot specify both lineId and connectedFrom filters.' }, { status: 400 });
    }

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

    if (connectedFromStationId) {
      const result = await db
        .select({
          id: stations.id,
          name: stations.name,
          code: stations.code,
          lineId: lines.id,
          lineName: lines.name,
        })
        .from(stationConnections)
        .innerJoin(stations, eq(stationConnections.connectedStationId, stations.id))
        .innerJoin(lines, eq(stationConnections.connectedRailwayId, lines.id))
        .where(eq(stationConnections.stationId, connectedFromStationId))
        .orderBy(asc(lines.name));
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
