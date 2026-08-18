import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { platformLocations, platformLocationCells, stationFacilities, facilityConnections, platforms } from '@furatora/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { platformLocationSchema } from '@/features/facility/schema';
import { platformLocationRepository } from '@/di';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;

    const stationPlatforms = await db
      .select({ id: platforms.id })
      .from(platforms)
      .where(eq(platforms.stationId, stationId));

    const platformIds = stationPlatforms.map((p) => p.id);

    if (platformIds.length === 0) {
      return NextResponse.json([]);
    }

    const locations = await db
      .select()
      .from(platformLocations)
      .where(inArray(platformLocations.platformId, platformIds))
      .orderBy(asc(platformLocations.createdAt));

    if (locations.length === 0) {
      return NextResponse.json([]);
    }

    const locationIds = locations.map((l) => l.id);

    const cells = await db
      .select()
      .from(platformLocationCells)
      .where(inArray(platformLocationCells.platformLocationId, locationIds))
      .orderBy(asc(platformLocationCells.xPositionMeters));

    const cellIds = cells.map((c) => c.id);

    const facilities = cellIds.length > 0
      ? await db
          .select()
          .from(stationFacilities)
          .where(inArray(stationFacilities.platformLocationCellId, cellIds))
      : [];

    const connections = await db
      .select()
      .from(facilityConnections)
      .where(inArray(facilityConnections.platformLocationId, locationIds));

    const result = locations.map((location) => {
      const locationCells = cells
        .filter((c) => c.platformLocationId === location.id)
        .map((cell) => ({
          id: cell.id,
          xPositionMeters: cell.xPositionMeters,
          facilities: facilities
            .filter((f) => f.platformLocationCellId === cell.id)
            .map((f) => ({
              id: f.id,
              typeCode: f.typeCode,
              isWheelchairAccessible: f.isWheelchairAccessible,
              isStrollerAccessible: f.isStrollerAccessible,
              notes: f.notes,
            })),
        }));

      const locationConnections = connections
        .filter((c) => c.platformLocationId === location.id)
        .map((c) => ({
          id: c.id,
          connectedStationId: c.connectedStationId,
          connectedPlatformId: c.connectedPlatformId,
          directionId: c.directionId,
          exitLabel: c.exitLabel,
          xRangeStart: c.xRangeStart,
          xRangeEnd: c.xRangeEnd,
        }));

      return {
        id: location.id,
        platformId: location.platformId,
        exits: location.exits,
        notes: location.notes,
        cells: locationCells,
        connections: locationConnections,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = platformLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const location = await platformLocationRepository.create(parsed.data);

    return NextResponse.json(location, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
