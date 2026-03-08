import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { platformLocations, platformLocationCells, stationFacilities, facilityConnections } from '@furatora/database/schema';
import { eq, inArray } from 'drizzle-orm';

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

    const originalCells = await db
      .select()
      .from(platformLocationCells)
      .where(eq(platformLocationCells.platformLocationId, locationId));

    const originalFacilities = originalCells.length > 0
      ? await db
          .select()
          .from(stationFacilities)
          .where(inArray(stationFacilities.platformLocationCellId, originalCells.map((c) => c.id)))
      : [];

    const originalConnections = await db
      .select()
      .from(facilityConnections)
      .where(eq(facilityConnections.platformLocationId, locationId));

    const [duplicated] = await db
      .insert(platformLocations)
      .values({
        platformId: original.platformId,
        exits: original.exits,
        notes: original.notes,
      })
      .returning();

    for (const cell of originalCells) {
      const [duplicatedCell] = await db
        .insert(platformLocationCells)
        .values({
          platformLocationId: duplicated.id,
          nearPlatformCell: cell.nearPlatformCell,
        })
        .returning();

      const cellFacilities = originalFacilities.filter((f) => f.platformLocationCellId === cell.id);
      if (cellFacilities.length > 0) {
        await db.insert(stationFacilities).values(
          cellFacilities.map((f) => ({
            platformLocationCellId: duplicatedCell.id,
            typeCode: f.typeCode,
            isWheelchairAccessible: f.isWheelchairAccessible,
            isStrollerAccessible: f.isStrollerAccessible,
            notes: f.notes,
          }))
        );
      }
    }

    if (originalConnections.length > 0) {
      await db.insert(facilityConnections).values(
        originalConnections.map((c) => ({
          platformLocationId: duplicated.id,
          connectedStationId: c.connectedStationId,
          connectedPlatformId: c.connectedPlatformId,
          directionId: c.directionId,
          exitLabel: c.exitLabel,
        }))
      );
    }

    return NextResponse.json(duplicated, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
