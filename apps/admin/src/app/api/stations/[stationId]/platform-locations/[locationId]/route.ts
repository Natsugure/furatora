import { NextResponse } from 'next/server';
import { platformLocationSchema } from '@/features/facility/schema';
import { platformLocationRepository } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { stationId, locationId } = ids;
    const body = await request.json();
    const parsed = platformLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const updated = await platformLocationRepository.update(locationId, stationId, parsed.data);
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
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { stationId, locationId } = ids;
    const deleted = await platformLocationRepository.delete(locationId, stationId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
