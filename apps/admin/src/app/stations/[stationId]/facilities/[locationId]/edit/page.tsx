import { notFound } from 'next/navigation';
import { db } from '@railease-navi/database/client';
import {
  stations,
  platformLocations,
  stationFacilities,
  facilityConnections,
  platforms,
} from '@railease-navi/database/schema';
import { eq } from 'drizzle-orm';
import { FacilityForm } from '@/components/FacilityForm';

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ stationId: string; locationId: string }>;
}) {
  const { stationId, locationId } = await params;

  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
  if (!station) notFound();

  // Verify the location belongs to this station's platforms
  const stationPlatforms = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.stationId, stationId));

  const platformIds = stationPlatforms.map(p => p.id);
  if (platformIds.length === 0) notFound();

  const [location] = await db
    .select()
    .from(platformLocations)
    .where(eq(platformLocations.id, locationId));

  if (!location || !platformIds.includes(location.platformId)) notFound();

  const facilities = await db
    .select()
    .from(stationFacilities)
    .where(eq(stationFacilities.platformLocationId, locationId));

  const connections = await db
    .select()
    .from(facilityConnections)
    .where(eq(facilityConnections.platformLocationId, locationId));

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Edit Platform Location - {station.name}</h2>
      <FacilityForm
        stationId={stationId}
        isEdit
        initialData={{
          id: location.id,
          platformId: location.platformId,
          nearPlatformCell: location.nearPlatformCell,
          exits: location.exits ?? '',
          notes: location.notes ?? '',
          facilities: facilities.map((f) => ({
            typeCode: f.typeCode,
            isWheelchairAccessible: f.isWheelchairAccessible ?? true,
            isStrollerAccessible: f.isStrollerAccessible ?? true,
            notes: f.notes ?? '',
          })),
          connections: connections.map((c) => ({
            stationId: c.connectedStationId,
            exitLabel: c.exitLabel ?? '',
          })),
        }}
      />
    </div>
  );
}
