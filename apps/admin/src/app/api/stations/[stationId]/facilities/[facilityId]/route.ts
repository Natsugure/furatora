import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stationFacilities, facilityConnections } from '@stroller-transit-app/database/schema';
import { eq, and } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; facilityId: string }> }
) {
  const { stationId, facilityId } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(stationFacilities)
    .set({
      type: body.type,
      nearCarNumber: body.nearCarNumber || null,
      description: body.description || null,
      isAccessible: body.isAccessible ?? true,
      notes: body.notes || null,
    })
    .where(
      and(
        eq(stationFacilities.id, facilityId),
        eq(stationFacilities.stationId, stationId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Replace connections: delete existing, insert new
  await db
    .delete(facilityConnections)
    .where(eq(facilityConnections.facilityId, facilityId));

  if (body.connections?.length > 0) {
    await db.insert(facilityConnections).values(
      body.connections.map((conn: { connectedStationId: string; description?: string }) => ({
        facilityId,
        connectedStationId: conn.connectedStationId,
        description: conn.description || null,
      }))
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; facilityId: string }> }
) {
  const { stationId, facilityId } = await params;
  // facilityConnections will be cascade-deleted
  const [deleted] = await db
    .delete(stationFacilities)
    .where(
      and(
        eq(stationFacilities.id, facilityId),
        eq(stationFacilities.stationId, stationId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
