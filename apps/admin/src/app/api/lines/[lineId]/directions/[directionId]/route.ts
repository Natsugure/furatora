import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { lineDirections } from '@railease-navi/database/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lineId: string; directionId: string }> }
) {
  const { lineId, directionId } = await params;
  const [direction] = await db
    .select()
    .from(lineDirections)
    .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId)));

  if (!direction) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(direction);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ lineId: string; directionId: string }> }
) {
  const { lineId, directionId } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(lineDirections)
    .set({
      directionType: body.directionType,
      representativeStationId: body.representativeStationId,
      displayName: body.displayName,
      displayNameEn: body.displayNameEn || null,
      terminalStationIds: body.terminalStationIds || null,
      notes: body.notes || null,
    })
    .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ lineId: string; directionId: string }> }
) {
  const { lineId, directionId } = await params;
  const [deleted] = await db
    .delete(lineDirections)
    .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
