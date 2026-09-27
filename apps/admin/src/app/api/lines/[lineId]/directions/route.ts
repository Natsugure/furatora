import { NextResponse } from 'next/server';
import { directionSchema } from '@/lib/validations';
import { lineDirectionRepository } from '@/di';
import { DirectionDefaultConflictError } from '@/features/line/ports';

// 方面の新規作成
export async function POST(
  request: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  try {
    const { lineId } = await params;
    // 空ボディ・不正 JSON は 400
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'リクエストボディが不正な JSON です' }, { status: 400 });
    }
    const parsed = directionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const direction = await lineDirectionRepository.create(lineId, parsed.data);

    return NextResponse.json(direction, { status: 201 });
  } catch (err) {
    if (err instanceof DirectionDefaultConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
