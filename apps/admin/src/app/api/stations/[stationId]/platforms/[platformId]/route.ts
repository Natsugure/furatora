import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { platforms, platformCarStopPositions } from '@railease-navi/database/schema';
import { eq, and } from 'drizzle-orm';
import type { CarStopPosition } from '@railease-navi/database/schema';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  const { stationId, platformId } = await params;
  const [platform] = await db
    .select()
    .from(platforms)
    .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)));

  if (!platform) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const stopPositions = await db
    .select()
    .from(platformCarStopPositions)
    .where(eq(platformCarStopPositions.platformId, platformId));

  return NextResponse.json({
    ...platform,
    carStopPositions: stopPositions.map((sp) => ({
      carCount: sp.carCount,
      referenceCarNumber: sp.referenceCarNumber,
      referencePlatformCell: sp.referencePlatformCell,
      direction: sp.direction,
    })),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  const { stationId, platformId } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(platforms)
    .set({
      platformNumber: body.platformNumber,
      lineId: body.lineId,
      inboundDirectionId: body.inboundDirectionId || null,
      outboundDirectionId: body.outboundDirectionId || null,
      maxCarCount: body.maxCarCount,
      platformSide: body.platformSide || null,
      notes: body.notes || null,
    })
    .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(platformCarStopPositions).where(eq(platformCarStopPositions.platformId, platformId));

  const stopPositionRows = (body.carStopPositions ?? []).map((sp: CarStopPosition) => ({
    platformId,
    carCount: sp.carCount,
    referenceCarNumber: sp.referenceCarNumber,
    referencePlatformCell: sp.referencePlatformCell,
    direction: sp.direction,
  }));

  if (stopPositionRows.length > 0) {
    await db.insert(platformCarStopPositions).values(stopPositionRows);
  }

  const stopPositions = await db
    .select()
    .from(platformCarStopPositions)
    .where(eq(platformCarStopPositions.platformId, platformId));

  return NextResponse.json({
    ...updated,
    carStopPositions: stopPositions.map((sp) => ({
      carCount: sp.carCount,
      referenceCarNumber: sp.referenceCarNumber,
      referencePlatformCell: sp.referencePlatformCell,
      direction: sp.direction,
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  const { stationId, platformId } = await params;
  const [deleted] = await db
    .delete(platforms)
    .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
