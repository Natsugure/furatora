import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { stationConnections } from '@railease-navi/database/schema';
import { eq } from 'drizzle-orm';
import { stationConnectionUpdateSchema } from '@/lib/validations';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;
    const body = await request.json();
    const parsed = stationConnectionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { strollerDifficulty, wheelchairDifficulty, notesAboutStroller, notesAboutWheelchair } = parsed.data;

    const [updated] = await db
      .update(stationConnections)
      .set({
        strollerDifficulty: strollerDifficulty ?? null,
        wheelchairDifficulty: wheelchairDifficulty ?? null,
        notesAboutStroller: notesAboutStroller ?? null,
        notesAboutWheelchair: notesAboutWheelchair ?? null,
      })
      .where(eq(stationConnections.id, connectionId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
