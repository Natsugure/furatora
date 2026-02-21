import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { platformLocations, stationFacilities, facilityConnections } from '@railease-navi/database/schema';
import { eq } from 'drizzle-orm';

type FacilityInput = {
  typeCode: string;
  isWheelchairAccessible: boolean;
  isStrollerAccessible: boolean;
  notes: string;
};

type ConnectionInput = {
  stationId: string;
  exitLabel: string;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  const { locationId } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(platformLocations)
    .set({
      platformId: body.platformId,
      nearPlatformCell: body.nearPlatformCell || null,
      exits: body.exits || null,
      notes: body.notes || null,
    })
    .where(eq(platformLocations.id, locationId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 設備を再登録（既存削除→再挿入）
  await db.delete(stationFacilities).where(eq(stationFacilities.platformLocationId, locationId));
  if (body.facilities?.length > 0) {
    await db.insert(stationFacilities).values(
      body.facilities.map((f: FacilityInput) => ({
        platformLocationId: locationId,
        typeCode: f.typeCode,
        isWheelchairAccessible: f.isWheelchairAccessible ?? true,
        isStrollerAccessible: f.isStrollerAccessible ?? true,
        notes: f.notes || null,
      }))
    );
  }

  // 乗換駅接続を再登録（既存削除→再挿入）
  await db.delete(facilityConnections).where(eq(facilityConnections.platformLocationId, locationId));
  if (body.connections?.length > 0) {
    await db.insert(facilityConnections).values(
      body.connections.map((c: ConnectionInput) => ({
        platformLocationId: locationId,
        connectedStationId: c.stationId,
        exitLabel: c.exitLabel || null,
      }))
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  const { locationId } = await params;
  const [deleted] = await db
    .delete(platformLocations)
    .where(eq(platformLocations.id, locationId))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
