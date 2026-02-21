import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { platforms, platformCarStopPositions } from '@railease-navi/database/schema';
import { eq, and } from 'drizzle-orm';
import { platformSchema } from '@/lib/validations';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  try {
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  try {
    const { stationId, platformId } = await params;
    const body = await request.json();
    const parsed = platformSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { platformNumber, lineId, inboundDirectionId, outboundDirectionId, maxCarCount, platformSide, notes, carStopPositions } = parsed.data;

    const [updated] = await db
      .update(platforms)
      .set({
        platformNumber,
        lineId,
        inboundDirectionId: inboundDirectionId ?? null,
        outboundDirectionId: outboundDirectionId ?? null,
        maxCarCount,
        platformSide: platformSide ?? null,
        notes: notes ?? null,
      })
      .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.delete(platformCarStopPositions).where(eq(platformCarStopPositions.platformId, platformId));

    const stopPositionRows = (carStopPositions ?? []).map((sp) => ({
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  try {
    const { stationId, platformId } = await params;
    const [deleted] = await db
      .delete(platforms)
      .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
