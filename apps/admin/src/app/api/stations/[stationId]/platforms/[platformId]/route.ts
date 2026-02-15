import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { platforms } from '@stroller-transit-app/database/schema';
import { eq, and } from 'drizzle-orm';

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
  return NextResponse.json(platform);
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
      carStopPositions: body.carStopPositions || null,
      platformSide: body.platformSide || null,
      notes: body.notes || null,
    })
    .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
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
