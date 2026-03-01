import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { stations } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { stationUpdateSchema } from '@/lib/validations';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;
    const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
    if (!station) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(station);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;
    const body = await request.json();
    const parsed = stationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const [updated] = await db
      .update(stations)
      .set({
        name: parsed.data.name,
        nameKana: parsed.data.nameKana ?? null,
        nameEn: parsed.data.nameEn ?? null,
        odptStationId: parsed.data.odptStationId ?? null,
        slug: parsed.data.slug ?? null,
        code: parsed.data.code ?? null,
        lat: parsed.data.lat ?? null,
        lon: parsed.data.lon ?? null,
        operatorId: parsed.data.operatorId,
        notes: parsed.data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(stations.id, stationId))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
