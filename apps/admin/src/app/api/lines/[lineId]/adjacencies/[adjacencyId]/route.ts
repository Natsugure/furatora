import { NextResponse } from 'next/server';
import { stationAdjacencyRepository } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

// 路線内の隣接の削除（Issue #88）。
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ lineId: string; adjacencyId: string }> },
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { lineId, adjacencyId } = ids;

    const deleted = await stationAdjacencyRepository.delete(lineId, adjacencyId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
