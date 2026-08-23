import { NextResponse } from 'next/server';
import { platformLocationRepository } from '@/di';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; locationId: string }> }
) {
  try {
    const { locationId } = await params;

    const duplicated = await platformLocationRepository.duplicate(locationId);
    if (!duplicated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(duplicated, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
