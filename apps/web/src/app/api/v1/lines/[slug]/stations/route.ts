import { NextRequest, NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stations, stationLines, lines } from '@stroller-transit-app/database/schema';
import { eq, asc } from 'drizzle-orm';
import type { LineStationsApiResponse } from '@/types';

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const lineRecord = await db
      .select()
      .from(lines)
      .where(eq(lines.slug, slug))
      .limit(1);

    if (!lineRecord.length) {
      return NextResponse.json(
        { error: 'Line not found' },
        { status: 404 }
      );
    }

    const line = lineRecord[0];

    const stationsResult = await db
      .select({
        id: stations.id,
        slug: stations.slug,
        code: stations.code,
        name: stations.name,
        nameEn: stations.nameEn,
        lat: stations.lat,
        lon: stations.lon,
        stationOrder: stationLines.stationOrder,
      })
      .from(stationLines)
      .innerJoin(stations, eq(stationLines.stationId, stations.id))
      .where(eq(stationLines.lineId, line.id))
      .orderBy(asc(stationLines.stationOrder));

    const response: LineStationsApiResponse = {
      line: {
        id: line.id,
        slug: line.slug,
        name: line.name,
        nameEn: line.nameEn,
        lineCode: line.lineCode,
        color: line.color,
        displayOrder: line.displayOrder,
        operatorId: line.operatorId,
      },
      stations: stationsResult,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Line stations fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
