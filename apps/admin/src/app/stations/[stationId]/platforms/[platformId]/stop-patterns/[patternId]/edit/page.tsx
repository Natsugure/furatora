import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { TrainStopPatternForm } from '@/features/stop-pattern/components/TrainStopPatternForm';
import { stopPatternPageQuery } from '@/di';

export default async function EditStopPatternPage({
  params,
}: {
  params: Promise<{ stationId: string; platformId: string; patternId: string }>;
}) {
  const { stationId, platformId, patternId } = await params;
  const context = await stopPatternPageQuery.getEditContext(stationId, platformId, patternId);
  if (!context || !context.pattern) notFound();

  return (
    <div>
      <Title order={2} mb="lg">
        停車位置パターンを編集 - {context.stationName} {context.platformNumber}番線
      </Title>
      <TrainStopPatternForm
        stationId={stationId}
        platformId={platformId}
        platformNumber={context.platformNumber}
        physicalLength={context.physicalLength}
        trains={context.trains}
        initialData={context.pattern}
        isEdit
      />
    </div>
  );
}
