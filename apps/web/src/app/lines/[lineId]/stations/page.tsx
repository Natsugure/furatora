import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@stroller-transit-app/database/client';
import { stations, stationLines, lines } from '@stroller-transit-app/database/schema';
import { eq, asc } from 'drizzle-orm';
import { StationCard } from '@/components/StationCard';
import type { Line, StationWithOrder } from '@/types';

type Props = {
  params: Promise<{ lineId: string }>;
};

async function fetchLineWithStations(
  lineId: string
): Promise<{ line: Line; stations: StationWithOrder[] } | null> {
  // Get line details first
  const lineRecord = await db
    .select()
    .from(lines)
    .where(eq(lines.id, lineId))
    .limit(1);

  if (!lineRecord.length) {
    return null;
  }

  const line = lineRecord[0];

  // Get stations with stationOrder
  const stationsResult = await db
    .select({
      id: stations.id,
      code: stations.code,
      name: stations.name,
      nameEn: stations.nameEn,
      lat: stations.lat,
      lon: stations.lon,
      stationOrder: stationLines.stationOrder,
    })
    .from(stationLines)
    .innerJoin(stations, eq(stationLines.stationId, stations.id))
    .where(eq(stationLines.lineId, lineId))
    .orderBy(asc(stationLines.stationOrder));

  return {
    line: {
      id: line.id,
      name: line.name,
      nameEn: line.nameEn,
      lineCode: line.lineCode,
      color: line.color,
      operatorId: line.operatorId,
    },
    stations: stationsResult,
  };
}

export default async function StationListPage({ params }: Props) {
  const { lineId } = await params;
  const data = await fetchLineWithStations(lineId);

  if (!data) {
    notFound();
  }

  const { line, stations } = data;

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
      >
        ← 路線一覧に戻る
      </Link>

      {/* Line header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-6 h-6 rounded-full flex-shrink-0"
          style={{ backgroundColor: line.color || '#888888' }}
        />
        <h1 className="text-2xl md:text-3xl font-bold">
          {line.name}
          {line.nameEn && (
            <span className="text-lg font-normal text-gray-500 ml-2">
              {line.nameEn}
            </span>
          )}
        </h1>
      </div>

      {/* Station list */}
      {stations.length > 0 ? (
        <div className="space-y-2">
          {stations.map((station, index) => (
            <StationCard
              key={station.id}
              station={station}
              lineColor={line.color}
              isFirst={index === 0}
              isLast={index === stations.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-12">
          <p>この路線の駅データがありません</p>
        </div>
      )}
    </main>
  );
}
