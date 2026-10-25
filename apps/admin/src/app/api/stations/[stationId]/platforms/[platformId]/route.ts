import { NextResponse } from 'next/server';
import { platformSchema } from '@/features/platform/schema';
import { platformRepository } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { stationId, platformId } = ids;
    const body = await request.json();
    const parsed = platformSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const updated = await platformRepository.update(platformId, stationId, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { stationId, platformId } = ids;
    const deleted = await platformRepository.delete(platformId, stationId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
