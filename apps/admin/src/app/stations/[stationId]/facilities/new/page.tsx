import { notFound } from 'next/navigation';
import { db } from '@railease-navi/database/client';
import { stations } from '@railease-navi/database/schema';
import { eq } from 'drizzle-orm';
import { FacilityForm } from '@/components/FacilityForm';

export default async function NewFacilityPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));

  if (!station) notFound();

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">New Platform Location - {station.name}</h2>
      <FacilityForm stationId={stationId} />
    </div>
  );
}
