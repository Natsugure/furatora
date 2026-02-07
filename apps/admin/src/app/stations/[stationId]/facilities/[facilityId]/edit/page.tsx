import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import { stations, stationFacilities, facilityConnections } from '@stroller-transit-app/database/schema';
import { eq, and } from 'drizzle-orm';
import { FacilityForm } from '@/components/FacilityForm';

export default async function EditFacilityPage({
  params,
}: {
  params: Promise<{ stationId: string; facilityId: string }>;
}) {
  const { stationId, facilityId } = await params;

  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
  if (!station) notFound();

  const [facility] = await db
    .select()
    .from(stationFacilities)
    .where(
      and(
        eq(stationFacilities.id, facilityId),
        eq(stationFacilities.stationId, stationId)
      )
    );

  if (!facility) notFound();

  const connections = await db
    .select()
    .from(facilityConnections)
    .where(eq(facilityConnections.facilityId, facilityId));

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Edit Facility - {station.name}</h2>
      <FacilityForm
        stationId={stationId}
        isEdit
        initialData={{
          id: facility.id,
          type: facility.type,
          nearCarNumber: facility.nearCarNumber,
          description: facility.description ?? '',
          isAccessible: facility.isAccessible ?? true,
          notes: facility.notes ?? '',
          connections: connections.map((c) => ({
            connectedStationId: c.connectedStationId,
            description: c.description ?? '',
          })),
        }}
      />
    </div>
  );
}
