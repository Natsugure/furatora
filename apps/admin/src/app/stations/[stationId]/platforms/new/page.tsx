import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { PlatformForm } from '@/features/platform/components/PlatformForm';
import { platformEditPageQuery } from '@/di';

export default async function NewPlatformPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const context = await platformEditPageQuery.getCreateContext(stationId);

  if (!context) notFound();

  return (
    <div>
      <Title order={2} mb="lg">新規ホーム - {context.stationName}</Title>
      <PlatformForm stationId={stationId} lines={context.lines} />
    </div>
  );
}
