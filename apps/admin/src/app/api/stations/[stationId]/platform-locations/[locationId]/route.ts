import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { platformLocations, platformLocationCells, stationFacilities, facilityConnections } from '@furatora/database/schema';
import { eq, inArray } from 'drizzle-orm';
import { platformLocationSchema } from '@/lib/validations';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const body = await request.json();
    const parsed = platformLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { platformId, exits, notes, cells, connections } = parsed.data;

    const [updated] = await db
      .update(platformLocations)
      .set({
        platformId,
        exits: exits ?? null,
        notes: notes ?? null,
      })
      .where(eq(platformLocations.id, locationId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // アクセス点を再登録（既存削除→再挿入、stationFacilitiesはCASCADEで削除）
    const existingCells = await db
      .select({ id: platformLocationCells.id })
      .from(platformLocationCells)
      .where(eq(platformLocationCells.platformLocationId, locationId));

    if (existingCells.length > 0) {
      await db.delete(stationFacilities).where(
        inArray(stationFacilities.platformLocationCellId, existingCells.map((c) => c.id))
      );
    }
    await db.delete(platformLocationCells).where(eq(platformLocationCells.platformLocationId, locationId));

    for (const cell of cells) {
      const [insertedCell] = await db
        .insert(platformLocationCells)
        .values({
          platformLocationId: locationId,
          nearPlatformCell: cell.nearPlatformCell ?? null,
        })
        .returning();

      if (cell.facilities.length > 0) {
        await db.insert(stationFacilities).values(
          cell.facilities.map((f) => ({
            platformLocationCellId: insertedCell.id,
            typeCode: f.typeCode,
            isWheelchairAccessible: f.isWheelchairAccessible ?? true,
            isStrollerAccessible: f.isStrollerAccessible ?? true,
            notes: f.notes ?? null,
          }))
        );
      }
    }

    // 乗換駅接続を再登録（既存削除→再挿入）
    await db.delete(facilityConnections).where(eq(facilityConnections.platformLocationId, locationId));
    if (connections && connections.length > 0) {
      await db.insert(facilityConnections).values(
        connections.map((c) => ({
          platformLocationId: locationId,
          connectedStationId: c.stationId,
          connectedPlatformId: c.connectedPlatformId ?? null,
          directionId: c.directionId ?? null,
          exitLabel: c.exitLabel ?? null,
        }))
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const [deleted] = await db
      .delete(platformLocations)
      .where(eq(platformLocations.id, locationId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
