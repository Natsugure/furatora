import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { platforms, platformCarStopPositions } from '@railease-navi/database/schema';
import { eq, asc } from 'drizzle-orm';
import { platformSchema } from '@/lib/validations';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;
    const result = await db
      .select({ id: platforms.id, platformNumber: platforms.platformNumber })
      .from(platforms)
      .where(eq(platforms.stationId, stationId))
      .orderBy(asc(platforms.platformNumber));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;
    const body = await request.json();
    const parsed = platformSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { platformNumber, lineId, inboundDirectionId, outboundDirectionId, maxCarCount, platformSide, notes, carStopPositions } = parsed.data;

    const [platform] = await db
      .insert(platforms)
      .values({
        stationId,
        platformNumber,
        lineId,
        inboundDirectionId: inboundDirectionId ?? null,
        outboundDirectionId: outboundDirectionId ?? null,
        maxCarCount,
        platformSide: platformSide ?? null,
        notes: notes ?? null,
      })
      .returning();

    const stopPositionRows = (carStopPositions ?? []).map((sp) => ({
      platformId: platform.id,
      carCount: sp.carCount,
      referenceCarNumber: sp.referenceCarNumber,
      referencePlatformCell: sp.referencePlatformCell,
      direction: sp.direction,
    }));

    if (stopPositionRows.length > 0) {
      await db.insert(platformCarStopPositions).values(stopPositionRows);
    }

    return NextResponse.json(platform, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
