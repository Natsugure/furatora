import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import { stations, platforms } from '@stroller-transit-app/database/schema';
import { eq, and } from 'drizzle-orm';
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

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Edit Platform - {station.name}</h2>
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
          carStopPositions: platform.carStopPositions,
          notes: platform.notes ?? '',
        }}
      />
    </div>
  );
}
