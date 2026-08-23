import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { stations, platforms } from '@furatora/database/schema';
import { eq, and } from 'drizzle-orm';
import { Title } from '@mantine/core';
import { PlatformForm } from '@/features/platform/components/PlatformForm';

export default async function EditPlatformPage({
  params,
}: {
  params: Promise<{ stationId: string; platformId: string }>;
}) {
  const { stationId, platformId } = await params;

  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
  if (!station) notFound();

  const [platform] = await db
    .select()
    .from(platforms)
    .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)));

  if (!platform) notFound();

  return (
    <div>
      <Title order={2} mb="lg">ホームを編集 - {station.name}</Title>
      <PlatformForm
        stationId={stationId}
        isEdit
        initialData={{
          id: platform.id,
          platformNumber: platform.platformNumber,
          lineId: platform.lineId,
          inboundDirectionId: platform.inboundDirectionId,
          outboundDirectionId: platform.outboundDirectionId,
          physicalLength: Number(platform.physicalLength),
          platformSide: platform.platformSide ?? null,
          notes: platform.notes ?? '',
        }}
      />
    </div>
  );
}
