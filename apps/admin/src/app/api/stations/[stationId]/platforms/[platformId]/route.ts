import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { platforms } from '@furatora/database/schema';
import { eq, and } from 'drizzle-orm';
import { platformSchema } from '@/features/platform/schema';
import { platformRepository } from '@/di';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  try {
    const { stationId, platformId } = await params;
    const [platform] = await db
      .select()
      .from(platforms)
      .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)));

    if (!platform) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(platform);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; platformId: string }> }
) {
  try {
    const { stationId, platformId } = await params;
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
    const { stationId, platformId } = await params;
    const deleted = await platformRepository.delete(platformId, stationId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
