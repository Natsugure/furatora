import { NextResponse } from 'next/server';
import { platformSchema } from '@/features/platform/schema';
import { platformRepository } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { stationId } = ids;
    const body = await request.json();
    const parsed = platformSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const platform = await platformRepository.create(stationId, parsed.data);

    return NextResponse.json(platform, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
