import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { TrainStopPatternForm } from '@/features/stop-pattern/components/TrainStopPatternForm';
import { stopPatternPageQuery } from '@/di';

export default async function NewStopPatternPage({
  params,
}: {
  params: Promise<{ stationId: string; platformId: string }>;
}) {
  const { stationId, platformId } = await params;
  const context = await stopPatternPageQuery.getEditContext(stationId, platformId);
  if (!context) notFound();

  return (
    <div>
      <Title order={2} mb="lg">
        新規停車位置パターン - {context.stationName} {context.platformNumber}番線
      </Title>
      <TrainStopPatternForm
        stationId={stationId}
        platformId={platformId}
        platformNumber={context.platformNumber}
        physicalLength={context.physicalLength}
        trains={context.trains}
      />
    </div>
  );
}
