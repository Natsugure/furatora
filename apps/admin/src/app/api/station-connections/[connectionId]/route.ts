import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { stationConnections } from '@stroller-transit-app/database/schema';
import type { StrollerDifficulty, WheelchairDifficulty } from '@stroller-transit-app/database/enums';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(stationConnections)
    .set({
      strollerDifficulty: (body.strollerDifficulty as StrollerDifficulty) ?? null,
      wheelchairDifficulty: (body.wheelchairDifficulty as WheelchairDifficulty) ?? null,
      notesAboutStroller: body.notesAboutStroller || null,
      notesAboutWheelchair: body.notesAboutWheelchair || null,
    })
    .where(eq(stationConnections.id, connectionId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}
