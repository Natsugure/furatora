import { notFound } from 'next/navigation';
import { getVisibleLineWithStations } from '@/external/query/lineStationsQuery';
import { BackButton } from '@/components/BackButton';
import { StationTimeline } from '@/components/StationTimeline';
import { Container } from '@/components/ui/Container';
import { LineSymbol } from '@/components/ui/LineSymbol';
import { Sheet } from '@/components/ui/Sheet';

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
    <>
      <Container className="pt-2 pb-6">
        {/* 履歴が無いとき（直接開いたとき）は路線一覧（トップ）へ */}
        <BackButton href="/" />

        <div className="flex items-center gap-4">
          <LineSymbol lineCode={line.lineCode} fallbackStationCode={stations[0]?.code ?? null} color={line.color} />
          <div className="min-w-0">
            {/* 路線名は路線色で塗らない（白地とのコントラストが足りない路線がある。REQ-10） */}
            <h1 className="font-display font-bold text-[30px] leading-tight text-ink">{line.name}</h1>
            <p className="text-[13px] text-muted mt-0.5">
              {line.nameEn && `${line.nameEn} · `}全{stations.length}駅
            </p>
          </div>
        </div>
      </Container>

      <Sheet>
        <h2 className="font-display font-bold text-base text-ink mb-3">駅をえらぶ</h2>
        {stations.length > 0 ? (
          <StationTimeline stations={stations} lineColor={line.color} />
        ) : (
          <p className="text-center text-muted py-12">この路線の駅データがありません</p>
        )}
      </Sheet>
    </>
  );
}
