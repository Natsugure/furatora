import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { stations, platforms, platformCarStopPositions } from '@furatora/database/schema';
import { eq, and } from 'drizzle-orm';
import { Title } from '@mantine/core';
import { PlatformForm } from '@/components/PlatformForm';

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

  const stopPositions = await db
    .select()
    .from(platformCarStopPositions)
    .where(eq(platformCarStopPositions.platformId, platformId));

  return (
    <div>
      <Title order={2} mb="lg">Edit Platform - {station.name}</Title>
      <PlatformForm
        stationId={stationId}
        isEdit
        initialData={{
          id: platform.id,
          platformNumber: platform.platformNumber,
          lineId: platform.lineId,
          inboundDirectionId: platform.inboundDirectionId,
          outboundDirectionId: platform.outboundDirectionId,
          maxCarCount: platform.maxCarCount,
          carStopPositions: stopPositions.map((sp) => ({
            carCount: sp.carCount,
            referenceCarNumber: sp.referenceCarNumber,
            referencePlatformCell: sp.referencePlatformCell,
            direction: sp.direction,
          })),
          platformSide: platform.platformSide ?? null,
          notes: platform.notes ?? '',
        }}
      />
    </div>
  );
}
