import { notFound } from 'next/navigation';
import { Title, Text } from '@mantine/core';
import { LinkAnchor } from '@/components/LinkElements';
import { StationEditForm } from '@/components/StationEditForm';
import { parseStationListState, stationListHref } from '@/features/station/listState';
import { stationEditPageQuery } from '@/di';

type Props = {
  params: Promise<{ stationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StationEditPage({ params, searchParams }: Props) {
  const { stationId } = await params;
  const context = await stationEditPageQuery.getEditContext(stationId);
  if (!context) {
    notFound();
  }

  const listState = parseStationListState(await searchParams);
  const backHref = stationListHref(listState);

  return (
    <div>
      <LinkAnchor href={backHref} size="sm" mb="lg" style={{ display: 'block' }}>
        &larr; 駅一覧に戻る
      </LinkAnchor>

      <Title order={2} mb="xs">{context.station.name} — 編集</Title>
      {context.station.nameEn && (
        <Text size="sm" c="dimmed" mb="lg">{context.station.nameEn}</Text>
      )}

      <StationEditForm
        stationId={stationId}
        initialData={context.station}
        connections={context.connections}
        operators={context.operators}
        backHref={backHref}
      />
    </div>
  );
}
