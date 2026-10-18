import { NextResponse } from 'next/server';
import { trainStopPatternSchema } from '@/features/stop-pattern/schema';
import { DuplicateStopPatternError } from '@/features/stop-pattern/ports';
import { stopPatternRepository } from '@/di';

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

    return NextResponse.json({ success: true, id: saved.id }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateStopPatternError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
