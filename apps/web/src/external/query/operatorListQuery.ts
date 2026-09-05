import { db } from '@furatora/database/client';
import { lines, operators } from '@furatora/database/schema';
import { asc } from 'drizzle-orm';
import type { OperatorWithLines } from '@/types';
import { visibleLine, visibleOperator } from './visibility';

// トップページ（app/page.tsx）と公開API（/api/v1/operators）が共用する。
// 両者は同じ「表示してよい事業者と路線」を返す必要があり、
// 可視性の判定を JS 側の絞り込みではなく where 句に置くことで、
// 詳細ページで判定が抜けた原因（design.md「現行の可視性ガードは一覧にしか無い」）を
// 繰り返さない。
export async function getVisibleOperatorsWithLines(): Promise<OperatorWithLines[]> {
  const operatorList = await db
    .select()
    .from(operators)
    .where(visibleOperator())
    .orderBy(asc(operators.name));

  const lineList = await db
    .select()
    .from(lines)
    .where(visibleLine())
    .orderBy(asc(lines.operatorId), asc(lines.displayOrder));

  return operatorList.map((op) => ({
    ...op,
    lines: lineList.filter((line) => line.operatorId === op.id),
  }));
}
