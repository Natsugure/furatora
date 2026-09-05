import { notFound } from 'next/navigation';
import { Title, Text } from '@mantine/core';
import { stationPublishingPageQuery } from '@/di';
import { buildSlugCandidate, hasKanaEkiSuffixMismatch } from '@/features/station-publishing/domain/slugCandidate';
import { StationPublishingForm } from '@/features/station-publishing/components/StationPublishingForm';

type Props = {
  params: Promise<{ stationId: string }>;
};

export default async function StationPublishPage({ params }: Props) {
  const { stationId } = await params;
  const [context, linesMissingSlug] = await Promise.all([
    stationPublishingPageQuery.getContext(stationId),
    stationPublishingPageQuery.listLinesMissingSlug(),
  ]);

  if (!context) {
    notFound();
  }

  const { station, line, facilityInputCount, facilityTypeCount } = context;

  return (
    <div>
      <Title order={2} mb="xs">{station.name} — 公開設定</Title>
      {station.nameEn && (
        <Text size="sm" c="dimmed" mb="lg">{station.nameEn}</Text>
      )}

      <StationPublishingForm
        stationId={stationId}
        station={station}
        line={line}
        slugCandidate={buildSlugCandidate(line?.slug ?? null, station.nameKana)}
        hasKanaDefect={hasKanaEkiSuffixMismatch(station.name, station.nameKana)}
        facilityInputCount={facilityInputCount}
        facilityTypeCount={facilityTypeCount}
        linesMissingSlug={linesMissingSlug}
      />
    </div>
  );
}
