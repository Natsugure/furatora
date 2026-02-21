import { Accessibility } from 'lucide-react';
import { db } from '@railease-navi/database/client';
import { operators, lines } from '@railease-navi/database/schema';
import { asc, isNotNull } from 'drizzle-orm';
import { SearchTabs } from '@/components/SearchTabs';
import { Container } from '@/components/ui/Container';
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
    <Container className="py-6">
      {/* Info card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Accessibility size={22} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold mb-1">このアプリについて</h2>
            <p className="text-sm text-gray-600">
              ベビーカーや車いすでの移動を快適にするため、各駅のバリアフリー設備と列車内のフリースペース・優先席の位置を視覚的に表示します。
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
            <p className="text-sm font-semibold text-green-800 mb-0.5">エレベーター</p>
            <p className="text-xs text-green-600">位置と改札からの距離</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-800 mb-0.5">フリースペース</p>
            <p className="text-xs text-blue-600">車両内の位置図</p>
          </div>
          <div className="bg-pink-50 border border-pink-100 rounded-lg p-3">
            <p className="text-sm font-semibold text-pink-800 mb-0.5">優先席</p>
            <p className="text-xs text-pink-600">各車両の位置</p>
          </div>
        </div>
      </div>

      {/* Search tabs */}
      <SearchTabs operators={operatorsWithLines} />
    </Container>
  );
}
