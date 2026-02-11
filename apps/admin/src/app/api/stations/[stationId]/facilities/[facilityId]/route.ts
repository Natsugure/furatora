import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stationFacilities } from '@stroller-transit-app/database/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; facilityId: string }> }
) {
  const { facilityId } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(stationFacilities)
    .set({
      platformId: body.platformId,
      typeCode: body.typeCode,
      nearCarNumber: body.nearCarNumber || null,
      description: body.description || null,
      isWheelchairAccessible: body.isWheelchairAccessible ?? true,
      isStrollerAccessible: body.isStrollerAccessible ?? true,
      notes: body.notes || null,
    })
    .where(eq(stationFacilities.id, facilityId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; facilityId: string }> }
) {
  const { facilityId } = await params;
  const [deleted] = await db
    .delete(stationFacilities)
    .where(eq(stationFacilities.id, facilityId))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
