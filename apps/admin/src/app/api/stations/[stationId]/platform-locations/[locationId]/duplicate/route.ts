import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { platformLocations, stationFacilities, facilityConnections } from '@railease-navi/database/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  try {
    const { locationId } = await params;

    const [original] = await db
      .select()
      .from(platformLocations)
      .where(eq(platformLocations.id, locationId));

    if (!original) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const originalFacilities = await db
      .select()
      .from(stationFacilities)
      .where(eq(stationFacilities.platformLocationId, locationId));

    const originalConnections = await db
      .select()
      .from(facilityConnections)
      .where(eq(facilityConnections.platformLocationId, locationId));

    const [duplicated] = await db
      .insert(platformLocations)
      .values({
        platformId: original.platformId,
        nearPlatformCell: original.nearPlatformCell,
        exits: original.exits,
        notes: original.notes,
      })
      .returning();

    if (originalFacilities.length > 0) {
      await db.insert(stationFacilities).values(
        originalFacilities.map((f) => ({
          platformLocationId: duplicated.id,
          typeCode: f.typeCode,
          isWheelchairAccessible: f.isWheelchairAccessible,
          isStrollerAccessible: f.isStrollerAccessible,
          notes: f.notes,
        }))
      );
    }

    if (originalConnections.length > 0) {
      await db.insert(facilityConnections).values(
        originalConnections.map((c) => ({
          platformLocationId: duplicated.id,
          connectedStationId: c.connectedStationId,
          exitLabel: c.exitLabel,
        }))
      );
    }

    return NextResponse.json(duplicated, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
