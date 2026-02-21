import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { stations } from '@railease-navi/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
  if (!station) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(station);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const body = await request.json();
  const [updated] = await db
    .update(stations)
    .set({
      notes: body.notes ?? null,
    })
    .where(eq(stations.id, stationId))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}
