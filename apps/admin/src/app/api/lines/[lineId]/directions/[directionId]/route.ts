import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { lineDirections } from '@furatora/database/schema';
import { eq, and } from 'drizzle-orm';
import { directionSchema } from '@/lib/validations';
import { lineDirectionRepository } from '@/di';
import { DirectionDefaultConflictError } from '@/features/line/ports';

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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'リクエストボディが不正な JSON です' }, { status: 400 });
    }
    const parsed = directionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { displayNameEn, terminalStationIds, notes, ...rest } = parsed.data;

    const updated = await lineDirectionRepository.update(lineId, directionId, {
      ...rest,
      displayNameEn: displayNameEn ?? null,
      terminalStationIds: terminalStationIds ?? null,
      notes: notes ?? null,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof DirectionDefaultConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
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
