import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { lineDirections } from '@railease-navi/database/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const { lineId } = await params;
  const result = await db
    .select()
    .from(lineDirections)
    .where(eq(lineDirections.lineId, lineId))
    .orderBy(asc(lineDirections.directionType));
  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const { lineId } = await params;
  const body = await request.json();

  const [direction] = await db
    .insert(lineDirections)
    .values({
      lineId,
      directionType: body.directionType,
      representativeStationId: body.representativeStationId,
      displayName: body.displayName,
      displayNameEn: body.displayNameEn || null,
      terminalStationIds: body.terminalStationIds || null,
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json(direction, { status: 201 });
}
