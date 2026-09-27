import { NextResponse } from 'next/server';
import { transferConnectionRepository } from '@/di';
import { pairSaveInputSchema } from '@/features/transfer-connection/schema';
import { validateSaveInput } from '@/features/transfer-connection/domain/validate';
import { RouteLabelTakenError, RouteOutOfScopeError } from '@/features/transfer-connection/ports';
import { parseUuidParam } from '@/shared/list/params';

/**
 * 駅対（自駅 S・相手駅 T）の乗換難易度を、最終状態でまとめて保存する。
 * 操作単位の API にしない。基準ルートの付け替えなどの不変条件を Repository が1トランザクションで守る（ADR-0005）。
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stationId: string; connectedStationId: string }> },
) {
  try {
    const { stationId, connectedStationId } = await params;
    // 不正な id を 500 にしない（#108）。UUID でなければ駅対は存在しない
    if (!parseUuidParam(stationId) || !parseUuidParam(connectedStationId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'リクエストボディが不正な JSON です' }, { status: 400 });
    }

    const parsed = pairSaveInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    // クライアントと同じ検証。describeError が各 message を連結して通知に出す
    const issues = validateSaveInput(parsed.data);
    if (issues.length > 0) {
      return NextResponse.json({ error: issues }, { status: 422 });
    }

    const saved = await transferConnectionRepository.savePair(stationId, connectedStationId, parsed.data);
    if (!saved) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof RouteOutOfScopeError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof RouteLabelTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
