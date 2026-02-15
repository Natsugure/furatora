import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import { stations, stationFacilities, facilityConnections, platforms } from '@stroller-transit-app/database/schema';
import { eq } from 'drizzle-orm';
import { FacilityForm } from '@/components/FacilityForm';

export default async function EditFacilityPage({
  params,
}: {
  params: Promise<{ stationId: string; facilityId: string }>;
}) {
  const { stationId, facilityId } = await params;

  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
  if (!station) notFound();

  // Get all platforms for this station
  const stationPlatforms = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.stationId, stationId));

  const platformIds = stationPlatforms.map(p => p.id);

  if (platformIds.length === 0) notFound();

  // Get the facility and verify it belongs to this station's platforms
  const [facility] = await db
    .select()
    .from(stationFacilities)
    .where(eq(stationFacilities.id, facilityId));

  if (!facility || !platformIds.includes(facility.platformId)) notFound();

  // Get existing connections
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
          platformId: facility.platformId,
          typeCode: facility.typeCode,
          nearPlatformCell: facility.nearPlatformCell,
          exits: facility.exits ?? '',
          isWheelchairAccessible: facility.isWheelchairAccessible ?? true,
          isStrollerAccessible: facility.isStrollerAccessible ?? true,
          notes: facility.notes ?? '',
          connections: connections.map((c) => ({
            stationId: c.connectedStationId,
            exitLabel: c.exitLabel ?? '',
          })),
        }}
      />
    </div>
  );
}
