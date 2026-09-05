import { NextResponse } from 'next/server';
import { getVisibleOperatorsWithLines } from '@/external/query/operatorListQuery';
import type { OperatorsApiResponse } from '@/types';

// TASK-5.0: 旧実装は `.select().from(operators)` が無条件で、URL推測すら不要に
// 非表示事業者の一覧が取れた（design.md「現行の可視性ガードは一覧にしか無い」で
// 「最も重い漏れ」と特定された経路）。可視性の判定を getVisibleOperatorsWithLines に
// 一本化し、公開駅を1件以上持つ事業者だけを返す。
export async function GET() {
  try {
    const operatorsWithLines = await getVisibleOperatorsWithLines();

    const response: OperatorsApiResponse = {
      operators: operatorsWithLines,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
