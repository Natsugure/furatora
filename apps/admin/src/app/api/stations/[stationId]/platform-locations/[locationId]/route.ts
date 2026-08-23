import { NextResponse } from 'next/server';
import { platformLocationSchema } from '@/features/facility/schema';
import { platformLocationRepository } from '@/di';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const body = await request.json();
    const parsed = platformLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const updated = await platformLocationRepository.update(locationId, parsed.data);
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
    const { locationId } = await params;
    const deleted = await platformLocationRepository.delete(locationId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
