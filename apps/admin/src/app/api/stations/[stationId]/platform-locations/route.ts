import { NextResponse } from 'next/server';
import { platformLocationSchema } from '@/features/facility/schema';
import { platformLocationRepository } from '@/di';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;
    const body = await request.json();
    const parsed = platformLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const location = await platformLocationRepository.create(stationId, parsed.data);
    if (!location) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(location, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
