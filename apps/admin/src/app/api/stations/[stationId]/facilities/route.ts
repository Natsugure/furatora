import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stationFacilities, facilityConnections, platforms } from '@stroller-transit-app/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;

  // Get all platforms for this station
  const stationPlatforms = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.stationId, stationId));

  const platformIds = stationPlatforms.map(p => p.id);

  if (platformIds.length === 0) {
    return NextResponse.json([]);
  }

  // Get facilities for these platforms
  const facilities = await db
    .select()
    .from(stationFacilities)
    .where(inArray(stationFacilities.platformId, platformIds))
    .orderBy(asc(stationFacilities.nearPlatformCell));

  return NextResponse.json(facilities);
}

export async function POST(
  request: Request
) {
  const body = await request.json();

  const [facility] = await db
    .insert(stationFacilities)
    .values({
      platformId: body.platformId,
      typeCode: body.typeCode,
      nearPlatformCell: body.nearPlatformCell || null,
      exits: body.exits || null,
      isWheelchairAccessible: body.isWheelchairAccessible ?? true,
      isStrollerAccessible: body.isStrollerAccessible ?? true,
      notes: body.notes || null,
    })
    .returning();

  // 乗換駅との接続を登録
  if (body.connections?.length > 0) {
    await db.insert(facilityConnections).values(
      body.connections.map((c: { stationId: string; exitLabel: string }) => ({
        facilityId: facility.id,
        connectedStationId: c.stationId,
        exitLabel: c.exitLabel || null,
      }))
    );
  }

  return NextResponse.json(facility, { status: 201 });
}
