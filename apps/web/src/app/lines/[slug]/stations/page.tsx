import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { db } from '@furatora/database/client';
import { stations, stationLines, lines } from '@furatora/database/schema';
import { eq, asc } from 'drizzle-orm';
import { StationCard } from '@/components/StationCard';
import { Container } from '@/components/ui/Container';
import type { Line, StationWithOrder } from '@/types';

type Props = {
  params: Promise<{ slug: string }>;
};

async function fetchLineWithStations(
  slug: string
): Promise<{ line: Line; stations: StationWithOrder[] } | null> {
  const lineRecord = await db
    .select()
    .from(lines)
    .where(eq(lines.slug, slug))
    .limit(1);

  if (!lineRecord.length) {
    return null;
  }

  const line = lineRecord[0];

  const stationsResult = await db
    .select({
      id: stations.id,
      slug: stations.slug,
      code: stations.code,
      name: stations.name,
      nameEn: stations.nameEn,
      lat: stations.lat,
      lon: stations.lon,
      stationOrder: stationLines.stationOrder,
    })
    .from(stationLines)
    .innerJoin(stations, eq(stationLines.stationId, stations.id))
    .where(eq(stationLines.lineId, line.id))
    .orderBy(asc(stationLines.stationOrder));

  return {
    line: {
      id: line.id,
      slug: line.slug,
      name: line.name,
      nameEn: line.nameEn,
      lineCode: line.lineCode,
      color: line.color,
      displayOrder: line.displayOrder,
      operatorId: line.operatorId,
    },
    stations: stationsResult,
  };
}

export default async function StationListPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchLineWithStations(slug);

  if (!data) {
    notFound();
  }

  const { line, stations } = data;

  return (
    <Container className="py-6">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 bg-white shadow-sm transition-colors mb-5"
      >
        <ArrowLeft size={15} />
        路線一覧に戻る
      </Link>

      {/* Line header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-1.5 h-12 rounded-full flex-shrink-0"
            style={{ backgroundColor: line.color || '#888888' }}
          />
          <div>
            <h1
              className="text-2xl font-bold leading-tight"
              style={{ color: line.color || '#111827' }}
            >
              {line.name}
            </h1>
            {line.nameEn && (
              <p className="text-sm text-gray-500 mt-0.5">{line.nameEn}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">全{stations.length}駅</p>
          </div>
        </div>
      </div>

      {/* Station list */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        駅を選択
      </h2>
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
    </Container>
  );
}
