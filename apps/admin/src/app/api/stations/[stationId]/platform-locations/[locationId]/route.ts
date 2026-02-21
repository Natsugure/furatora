import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { platformLocations, stationFacilities, facilityConnections } from '@railease-navi/database/schema';
import { eq } from 'drizzle-orm';
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
    const { platformId, nearPlatformCell, exits, notes, facilities, connections } = parsed.data;

    const [updated] = await db
      .update(platformLocations)
      .set({
        platformId,
        nearPlatformCell: nearPlatformCell ?? null,
        exits: exits ?? null,
        notes: notes ?? null,
      })
      .where(eq(platformLocations.id, locationId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 設備を再登録（既存削除→再挿入）
    await db.delete(stationFacilities).where(eq(stationFacilities.platformLocationId, locationId));
    if (facilities && facilities.length > 0) {
      await db.insert(stationFacilities).values(
        facilities.map((f) => ({
          platformLocationId: locationId,
          typeCode: f.typeCode,
          isWheelchairAccessible: f.isWheelchairAccessible ?? true,
          isStrollerAccessible: f.isStrollerAccessible ?? true,
          notes: f.notes ?? null,
        }))
      );
    }

    // 乗換駅接続を再登録（既存削除→再挿入）
    await db.delete(facilityConnections).where(eq(facilityConnections.platformLocationId, locationId));
    if (connections && connections.length > 0) {
      await db.insert(facilityConnections).values(
        connections.map((c) => ({
          platformLocationId: locationId,
          connectedStationId: c.stationId,
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
