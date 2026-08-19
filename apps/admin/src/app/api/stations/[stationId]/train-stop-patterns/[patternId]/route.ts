import { NextResponse } from 'next/server';
import { trainStopPatternSchema } from '@/features/stop-pattern/schema';
import { DuplicateStopPatternError } from '@/features/stop-pattern/ports';
import { stopPatternRepository } from '@/di';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; patternId: string }> }
) {
  try {
    const { patternId } = await params;
    const body = await request.json();
    const parsed = trainStopPatternSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const updated = await stopPatternRepository.update(patternId, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof DuplicateStopPatternError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; patternId: string }> }
) {
  try {
    const { patternId } = await params;
    const deleted = await stopPatternRepository.delete(patternId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
