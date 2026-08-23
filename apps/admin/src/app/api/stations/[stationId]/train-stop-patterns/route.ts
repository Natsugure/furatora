import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { trainStopPatterns, trainStopPatternCars, platforms } from '@furatora/database/schema';
import { and, eq, asc, inArray } from 'drizzle-orm';
import { trainStopPatternSchema } from '@/features/stop-pattern/schema';
import { DuplicateStopPatternError } from '@/features/stop-pattern/ports';
import { stopPatternRepository } from '@/di';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;
    const { searchParams } = new URL(request.url);
    const platformId = searchParams.get('platformId');
    if (!platformId) {
      return NextResponse.json({ error: 'platformId is required' }, { status: 400 });
    }

    // platformId はクエリ文字列由来のため、当該駅のホームであることを確認する
    const patterns = await db
      .select({
        id: trainStopPatterns.id,
        platformId: trainStopPatterns.platformId,
        trainId: trainStopPatterns.trainId,
      })
      .from(trainStopPatterns)
      .innerJoin(platforms, eq(platforms.id, trainStopPatterns.platformId))
      .where(and(eq(trainStopPatterns.platformId, platformId), eq(platforms.stationId, stationId)));

    if (patterns.length === 0) {
      return NextResponse.json([]);
    }

    const patternIds = patterns.map((p) => p.id);

    const cars = await db
      .select()
      .from(trainStopPatternCars)
      .where(inArray(trainStopPatternCars.trainStopPatternId, patternIds))
      .orderBy(asc(trainStopPatternCars.carNumber));

    const result = patterns.map((pattern) => ({
      id: pattern.id,
      platformId: pattern.platformId,
      trainId: pattern.trainId,
      cars: cars
        .filter((c) => c.trainStopPatternId === pattern.id)
        .map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
    }));

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
    const parsed = trainStopPatternSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    // 他駅のホームへのパターン作成は stationId で弾く
    const saved = await stopPatternRepository.save(stationId, parsed.data);
    if (!saved) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateStopPatternError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
