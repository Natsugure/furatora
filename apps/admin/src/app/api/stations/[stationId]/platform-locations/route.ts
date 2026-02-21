import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { platformLocations, stationFacilities, facilityConnections, platforms } from '@stroller-transit-app/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;

  const stationPlatforms = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.stationId, stationId));

  const platformIds = stationPlatforms.map(p => p.id);

  if (platformIds.length === 0) {
    return NextResponse.json([]);
  }

  const locations = await db
    .select()
    .from(platformLocations)
    .where(inArray(platformLocations.platformId, platformIds))
    .orderBy(asc(platformLocations.nearPlatformCell));

  return NextResponse.json(locations);
}

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

export async function POST(
  request: Request
) {
  const body = await request.json();

  const [location] = await db
    .insert(platformLocations)
    .values({
      platformId: body.platformId,
      nearPlatformCell: body.nearPlatformCell || null,
      exits: body.exits || null,
      notes: body.notes || null,
    })
    .returning();

  if (body.facilities?.length > 0) {
    await db.insert(stationFacilities).values(
      body.facilities.map((f: FacilityInput) => ({
        platformLocationId: location.id,
        typeCode: f.typeCode,
        isWheelchairAccessible: f.isWheelchairAccessible ?? true,
        isStrollerAccessible: f.isStrollerAccessible ?? true,
        notes: f.notes || null,
      }))
    );
  }

  if (body.connections?.length > 0) {
    await db.insert(facilityConnections).values(
      body.connections.map((c: ConnectionInput) => ({
        platformLocationId: location.id,
        connectedStationId: c.stationId,
        exitLabel: c.exitLabel || null,
      }))
    );
  }

  return NextResponse.json(location, { status: 201 });
}
