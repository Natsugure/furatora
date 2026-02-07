import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { platforms } from '@stroller-transit-app/database/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const result = await db
    .select()
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
      carStopPositions: body.carStopPositions || null,
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json(platform, { status: 201 });
}
