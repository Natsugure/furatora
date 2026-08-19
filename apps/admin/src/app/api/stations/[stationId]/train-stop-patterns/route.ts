import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { trainStopPatterns, trainStopPatternCars } from '@furatora/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { trainStopPatternSchema } from '@/features/stop-pattern/schema';
import { DuplicateStopPatternError } from '@/features/stop-pattern/ports';
import { stopPatternRepository } from '@/di';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platformId = searchParams.get('platformId');
    if (!platformId) {
      return NextResponse.json({ error: 'platformId is required' }, { status: 400 });
    }

    const patterns = await db
      .select()
      .from(trainStopPatterns)
      .where(eq(trainStopPatterns.platformId, platformId));

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = trainStopPatternSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    await stopPatternRepository.save(parsed.data);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateStopPatternError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
