import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import { getStationDetail } from '@/di';
import { PlatformDisplay } from '@/features/platform/components/PlatformDisplay';
import { PlatformTabs } from '@/features/platform/components/PlatformTabs';
import { BackButton } from '@/components/BackButton';
import { StationBadge } from '@/components/ui/StationBadge';
import { Container } from '@/components/ui/Container';
import { TransferDifficultySection } from '@/components/TransferDifficultySection';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function StationDetailPage({ params }: Props) {
  const { slug } = await params;
  const data = await getStationDetail(slug);

  if (!data) {
    notFound();
  }

  const { station, headerLineColor, platforms: platformList, transferConnections, tabs } = data;

  return (
    <Container className="py-6">
      {/* Back navigation */}
      <BackButton />

      {/* Station header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-4">
          {station.code && (
            <StationBadge code={station.code} color={headerLineColor} />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{station.name}</h1>
            {station.nameEn && (
              <p className="text-gray-500 text-sm mt-0.5">{station.nameEn}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {station.notes && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 whitespace-pre-wrap">
          {station.notes}
        </div>
      )}

      {/* Transfer difficulty */}
      <TransferDifficultySection connections={transferConnections} />

      {/* Platform list */}
      {platformList.length > 0 ? (
        <div>
          {/* Info alert */}
          <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-2.5">
              <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">ご利用案内</p>
                <p className="text-sm text-blue-700">
                  各ホームのバリアフリー設備と列車のフリースペース・優先席の位置を確認できます。
                  エレベーターの位置を参考に、乗車位置を事前に確認することで、スムーズな移動が可能です。
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            ホーム情報
          </h2>
          {tabs.length > 1 ? (
            <PlatformTabs tabs={tabs} />
          ) : (
            <div className="space-y-4">
              {platformList.map((platform) => (
                <PlatformDisplay key={platform.id} platform={platform} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-500">
          <p>この駅のプラットフォーム情報がありません</p>
        </div>
      )}
    </Container>
  );
}
