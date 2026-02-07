import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stationFacilities, facilityConnections } from '@stroller-transit-app/database/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const facilities = await db
    .select()
    .from(stationFacilities)
    .where(eq(stationFacilities.stationId, stationId))
    .orderBy(asc(stationFacilities.type), asc(stationFacilities.nearCarNumber));

  // Fetch connections for each facility
  const facilityIds = facilities.map((f) => f.id);
  const connections =
    facilityIds.length > 0
      ? await db
          .select()
          .from(facilityConnections)
          .where(
            // Use a simple approach: fetch all and filter
            eq(facilityConnections.facilityId, facilityIds[0])
          )
      : [];

  // For multiple facilities, fetch all connections
  let allConnections = connections;
  if (facilityIds.length > 1) {
    const results = await Promise.all(
      facilityIds.map((fid) =>
        db
          .select()
          .from(facilityConnections)
          .where(eq(facilityConnections.facilityId, fid))
      )
    );
    allConnections = results.flat();
  }

  const facilitiesWithConnections = facilities.map((f) => ({
    ...f,
    connections: allConnections.filter((c) => c.facilityId === f.id),
  }));

  return NextResponse.json(facilitiesWithConnections);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const body = await request.json();

  const [facility] = await db
    .insert(stationFacilities)
    .values({
      stationId,
      type: body.type,
      nearCarNumber: body.nearCarNumber || null,
      description: body.description || null,
      isAccessible: body.isAccessible ?? true,
      notes: body.notes || null,
    })
    .returning();

  // Insert connections if provided
  if (body.connections?.length > 0) {
    await db.insert(facilityConnections).values(
      body.connections.map((conn: { connectedStationId: string; description?: string }) => ({
        facilityId: facility.id,
        connectedStationId: conn.connectedStationId,
        description: conn.description || null,
      }))
    );
  }

  return NextResponse.json(facility, { status: 201 });
}
