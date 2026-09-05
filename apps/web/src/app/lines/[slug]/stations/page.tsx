import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getVisibleLineWithStations } from '@/external/query/lineStationsQuery';
import { StationCard } from '@/components/StationCard';
import { Container } from '@/components/ui/Container';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function StationListPage({ params }: Props) {
  const { slug } = await params;
  const data = await getVisibleLineWithStations(slug);

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
