import { NextResponse } from 'next/server';
import { getVisibleOperatorsWithLines } from '@/external/query/operatorListQuery';
import type { OperatorsApiResponse } from '@/types';

// このエンドポイントはかつて `.select().from(operators)` を無条件で実行しており、
// URL 推測すら不要に非公開事業者の全路線が取れた（可視性の判定漏れ経路のうち
// 最も露出が大きかったもの）。可視性の判定を getVisibleOperatorsWithLines に
// 一本化し、公開駅を1件以上持つ事業者だけを返す
// （docs/domain/station-visibility.md「読み取り経路（apps/web）」）。
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
