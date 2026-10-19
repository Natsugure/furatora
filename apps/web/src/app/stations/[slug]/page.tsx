import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import { getStationDetail } from '@/di';
import { PlatformDisplay } from '@/features/platform/components/PlatformDisplay';
import { PlatformTabs } from '@/features/platform/components/PlatformTabs';
import { stationLineChips } from '@/features/station/domain/stationLineChips';
import { BackButton } from '@/components/BackButton';
import { StationBadge } from '@/components/ui/StationBadge';
import { Container } from '@/components/ui/Container';
import { Sheet } from '@/components/ui/Sheet';
import { TransferDifficultySection } from '@/components/TransferDifficultySection';
import { railLineColor } from '@/theme/railLineColor';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function StationDetailPage({ params }: Props) {
  const { slug } = await params;
  const data = await getStationDetail(slug);

  if (!data) {
    notFound();
  }

  const { station, headerLineColor, platforms: platformList, transferPartners, tabs } = data;
  const lineChips = stationLineChips(platformList, transferPartners);

  return (
    <>
      <Container className="pt-2 pb-6">
        {/* 履歴が無いとき（直接開いたとき）はトップへ。駅の詳細は複数の路線から来るため、路線の駅一覧には決められない */}
        <BackButton href="/" />

        <div className="flex items-center gap-4">
          {station.code && (
            <StationBadge code={station.code} color={headerLineColor} />
          )}
          <div className="min-w-0">
            <h1 className="font-display font-bold text-[32px] leading-tight text-ink">{station.name}</h1>
            {station.nameEn && (
              <p className="text-[13px] text-muted mt-0.5">{station.nameEn}</p>
            )}
          </div>
        </div>

        {/* この駅のホームの路線と、乗換先の路線（stationLineChips） */}
        {lineChips.length > 0 && (
          <ul aria-label="路線" className="flex flex-wrap gap-1.5 mt-4">
            {lineChips.map((chip) => (
              <li key={chip.name} className="h-7.5 pl-1.5 pr-3 inline-flex items-center gap-1.5 rounded-full bg-surface text-xs font-medium text-ink">
                <span aria-hidden className="size-4 rounded-full flex-shrink-0" style={{ backgroundColor: railLineColor(chip.color) }} />
                {chip.name}
              </li>
            ))}
          </ul>
        )}
      </Container>

      <Sheet className="flex flex-col gap-5">
        {/* 駅の注記。ADR-0018 により、汎用の警告色は作らずニュートラルの面に置く */}
        {station.notes && (
          <div className="p-4 bg-subtle rounded-card text-sm text-ink-soft whitespace-pre-wrap">
            {station.notes}
          </div>
        )}

        <TransferDifficultySection stationName={station.name} partners={transferPartners} />

        {platformList.length > 0 ? (
          <>
            {/* ご利用案内 */}
            <div className="flex gap-3 px-4.5 py-4 rounded-card bg-canvas text-ink-soft">
              <Info size={20} aria-hidden className="text-brand-600 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] leading-[1.75]">
                各ホームのバリアフリー設備と列車のフリースペース・優先席の位置を確認できます。
                エレベーターの位置を参考に、乗車位置を事前に確認しておくと、スムーズに移動できます。
              </p>
            </div>

            <hr className="border-subtle" />

            <section className="flex flex-col gap-4">
              <h2 className="font-display font-bold text-lg text-ink">ホーム</h2>
              {tabs.length > 1 ? (
                <PlatformTabs tabs={tabs} />
              ) : (
                <div className="space-y-4">
                  {platformList.map((platform) => (
                    <PlatformDisplay key={platform.id} platform={platform} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <p className="py-10 text-center text-muted">この駅のプラットフォーム情報がありません</p>
        )}
      </Sheet>
    </>
  );
}
