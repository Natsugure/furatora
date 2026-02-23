import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { platformLocations, stationFacilities, facilityConnections, platforms } from '@furatora/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { platformLocationSchema } from '@/lib/validations';

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
      .orderBy(asc(platformLocations.nearPlatformCell));

    return NextResponse.json(locations);
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
    const { platformId, nearPlatformCell, exits, notes, facilities, connections } = parsed.data;

    const [location] = await db
      .insert(platformLocations)
      .values({
        platformId,
        nearPlatformCell: nearPlatformCell ?? null,
        exits: exits ?? null,
        notes: notes ?? null,
      })
      .returning();

    if (facilities && facilities.length > 0) {
      await db.insert(stationFacilities).values(
        facilities.map((f) => ({
          platformLocationId: location.id,
          typeCode: f.typeCode,
          isWheelchairAccessible: f.isWheelchairAccessible ?? true,
          isStrollerAccessible: f.isStrollerAccessible ?? true,
          notes: f.notes ?? null,
        }))
      );
    }

    if (connections && connections.length > 0) {
      await db.insert(facilityConnections).values(
        connections.map((c) => ({
          platformLocationId: location.id,
          connectedStationId: c.stationId,
          exitLabel: c.exitLabel ?? null,
        }))
      );
    }

    return NextResponse.json(location, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
