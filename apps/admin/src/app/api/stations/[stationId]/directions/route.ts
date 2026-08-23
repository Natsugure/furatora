import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { platforms, lineDirections } from '@furatora/database/schema';
import { eq, inArray } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;
    const stationPlatforms = await db
      .select({ inboundDirectionId: platforms.inboundDirectionId, outboundDirectionId: platforms.outboundDirectionId })
      .from(platforms)
      .where(eq(platforms.stationId, stationId));

    const directionIds = [...new Set(
      stationPlatforms
        .flatMap((p) => [p.inboundDirectionId, p.outboundDirectionId])
        .filter((id): id is string => id !== null)
    )];

    if (directionIds.length === 0) {
      return NextResponse.json([]);
    }

    const result = await db
      .select({ id: lineDirections.id, displayName: lineDirections.displayName })
      .from(lineDirections)
      .where(inArray(lineDirections.id, directionIds));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
