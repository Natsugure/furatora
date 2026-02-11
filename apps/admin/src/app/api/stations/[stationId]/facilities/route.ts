import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stationFacilities, platforms } from '@stroller-transit-app/database/schema';
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
    .orderBy(asc(stationFacilities.typeCode), asc(stationFacilities.nearCarNumber));

  return NextResponse.json(facilities);
}

export async function POST(
  request: Request,
  _params: { params: Promise<{ stationId: string }> }
) {
  const body = await request.json();

  const [facility] = await db
    .insert(stationFacilities)
    .values({
      platformId: body.platformId,
      typeCode: body.typeCode,
      nearCarNumber: body.nearCarNumber || null,
      description: body.description || null,
      isWheelchairAccessible: body.isWheelchairAccessible ?? true,
      isStrollerAccessible: body.isStrollerAccessible ?? true,
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json(facility, { status: 201 });
}
