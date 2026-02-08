import { db } from '@stroller-transit-app/database/client';
import { operators, lines } from '@stroller-transit-app/database/schema';
import { asc, isNotNull } from 'drizzle-orm';
import { OperatorList } from '@/components/OperatorList';
import type { OperatorWithLines } from '@/types';

async function fetchOperatorsWithLines(): Promise<OperatorWithLines[]> {
  const operatorList = await db
    .select()
    .from(operators)
    .where(isNotNull(operators.displayPriority))
    .orderBy(asc(operators.name));

  const lineList = await db
    .select()
    .from(lines)
    .orderBy(asc(lines.operatorId), asc(lines.displayOrder));

  return operatorList.map((op) => ({
    ...op,
    lines: lineList.filter((line) => line.operatorId === op.id),
  }));
}

export default async function Home() {
  const operatorsWithLines = await fetchOperatorsWithLines();

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">
        ベビーカー対応 乗換案内
      </h1>

      {operatorsWithLines.length > 0 ? (
        <OperatorList operators={operatorsWithLines} />
      ) : (
        <div className="text-center text-gray-500 py-12">
          <p>事業者データがありません</p>
          <p className="text-sm mt-2">データを取得してください</p>
        </div>
      )}
    </main>
  );
}
