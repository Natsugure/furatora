import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { lineDirections } from '@furatora/database/schema';
import { eq, and } from 'drizzle-orm';
import { directionSchema } from '@/lib/validations';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lineId: string; directionId: string }> }
) {
  try {
    const { lineId, directionId } = await params;
    const [direction] = await db
      .select()
      .from(lineDirections)
      .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId)));

    if (!direction) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(direction);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ lineId: string; directionId: string }> }
) {
  try {
    const { lineId, directionId } = await params;
    const body = await request.json();
    const parsed = directionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { directionType, representativeStationId, displayName, displayNameEn, terminalStationIds, notes } = parsed.data;

    const [updated] = await db
      .update(lineDirections)
      .set({
        directionType,
        representativeStationId,
        displayName,
        displayNameEn: displayNameEn ?? null,
        terminalStationIds: terminalStationIds ?? null,
        notes: notes ?? null,
      })
      .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ lineId: string; directionId: string }> }
) {
  try {
    const { lineId, directionId } = await params;
    const [deleted] = await db
      .delete(lineDirections)
      .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
