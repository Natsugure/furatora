import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import { stations } from '@stroller-transit-app/database/schema';
import { eq } from 'drizzle-orm';
import { PlatformForm } from '@/components/PlatformForm';

export default async function NewPlatformPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));

  if (!station) notFound();

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">New Platform - {station.name}</h2>
      <PlatformForm stationId={stationId} />
    </div>
  );
}
