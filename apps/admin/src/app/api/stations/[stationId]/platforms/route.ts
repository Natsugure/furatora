import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { platforms, platformCarStopPositions } from '@stroller-transit-app/database/schema';
import { eq, asc } from 'drizzle-orm';
import type { CarStopPosition } from '@stroller-transit-app/database/schema';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const result = await db
    .select({
      id: platforms.id,
      platformNumber: platforms.platformNumber,
    })
    .from(platforms)
    .where(eq(platforms.stationId, stationId))
    .orderBy(asc(platforms.platformNumber));
  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const body = await request.json();

  const [platform] = await db
    .insert(platforms)
    .values({
      stationId,
      platformNumber: body.platformNumber,
      lineId: body.lineId,
      inboundDirectionId: body.inboundDirectionId || null,
      outboundDirectionId: body.outboundDirectionId || null,
      maxCarCount: body.maxCarCount,
      platformSide: body.platformSide || null,
      notes: body.notes || null,
    })
    .returning();

  const stopPositionRows = (body.carStopPositions ?? []).map((sp: CarStopPosition) => ({
    platformId: platform.id,
    carCount: sp.carCount,
    referenceCarNumber: sp.referenceCarNumber,
    referencePlatformCell: sp.referencePlatformCell,
    direction: sp.direction,
  }));

  if (stopPositionRows.length > 0) {
    await db.insert(platformCarStopPositions).values(stopPositionRows);
  }

  return NextResponse.json(platform, { status: 201 });
}
