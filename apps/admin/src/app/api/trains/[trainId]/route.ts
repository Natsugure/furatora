import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { trains } from '@stroller-transit-app/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  const { trainId } = await params;
  const [train] = await db.select().from(trains).where(eq(trains.id, trainId));
  if (!train) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(train);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  const { trainId } = await params;
  const body = await request.json();
  const [updated] = await db
    .update(trains)
    .set({
      name: body.name,
      operators: body.operatorId,
      lines: body.lineIds,
      carCount: body.carCount,
      carStructure: body.carStructure || null,
      freeSpaces: body.freeSpaces || null,
      prioritySeats: body.prioritySeats || null,
    })
    .where(eq(trains.id, trainId))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  const { trainId } = await params;
  const [deleted] = await db
    .delete(trains)
    .where(eq(trains.id, trainId))
    .returning();
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
