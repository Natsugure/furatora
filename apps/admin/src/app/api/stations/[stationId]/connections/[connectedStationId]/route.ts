import { NextResponse } from 'next/server';
import { stationConnectionRepository } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

// 乗換接続の削除（Issue #88）。有向2行（A→B と B→A）の両方を削除する。
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; connectedStationId: string }> },
) {
  try {
    const ids = parseUuidParams(await params);
    if (!ids) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { stationId, connectedStationId } = ids;

    const deleted = await stationConnectionRepository.deletePair(stationId, connectedStationId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
