import { NextResponse } from 'next/server';
import { trainSchema } from '@/features/train/schema';
import { trainEditPageQuery, trainRepository } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { trainId } = ids;
    const train = await trainEditPageQuery.getTrain(trainId);
    if (!train) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(train);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { trainId } = ids;
    const body = await request.json();
    const parsed = trainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const updated = await trainRepository.update(trainId, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { trainId } = ids;
    const deleted = await trainRepository.delete(trainId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
