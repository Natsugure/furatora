import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stationFacilities, facilityConnections } from '@stroller-transit-app/database/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; facilityId: string }> }
) {
  const { facilityId } = await params;

  const [original] = await db
    .select()
    .from(stationFacilities)
    .where(eq(stationFacilities.id, facilityId));

  if (!original) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const originalConnections = await db
    .select()
    .from(facilityConnections)
    .where(eq(facilityConnections.facilityId, facilityId));

  const [duplicated] = await db
    .insert(stationFacilities)
    .values({
      platformId: original.platformId,
      typeCode: original.typeCode,
      nearPlatformCell: original.nearPlatformCell,
      exits: original.exits,
      isWheelchairAccessible: original.isWheelchairAccessible,
      isStrollerAccessible: original.isStrollerAccessible,
      notes: original.notes,
    })
    .returning();

  if (originalConnections.length > 0) {
    await db.insert(facilityConnections).values(
      originalConnections.map((c) => ({
        facilityId: duplicated.id,
        connectedStationId: c.connectedStationId,
        exitLabel: c.exitLabel,
      }))
    );
  }

  return NextResponse.json(duplicated, { status: 201 });
}
