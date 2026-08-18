import { NextResponse } from 'next/server';
import { stopPatternRepository } from '@/di';

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
