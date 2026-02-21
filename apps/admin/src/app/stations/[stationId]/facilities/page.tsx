import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@railease-navi/database/client';
import {
  stations,
  platformLocations,
  stationFacilities,
  platforms,
  lines,
  lineDirections,
  facilityTypes,
} from '@railease-navi/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { DeleteButton } from '@/components/DeleteButton';
import { FacilityDuplicateButton } from '@/components/FacilityDuplicateButton';

export default async function FacilitiesPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const [station] = await db
    .select()
    .from(stations)
    .where(eq(stations.id, stationId));

  if (!station) notFound();

  // Fetch platforms
  const platformList = await db
    .select()
    .from(platforms)
    .where(eq(platforms.stationId, stationId))
    .orderBy(asc(platforms.platformNumber));

  // Fetch line names for platforms
  const lineIds = [...new Set(platformList.map((p) => p.lineId))];
  const lineList =
    lineIds.length > 0
      ? await Promise.all(
          lineIds.map((lid) =>
            db.select({ id: lines.id, name: lines.name }).from(lines).where(eq(lines.id, lid))
          )
        )
      : [];
  const lineNameMap = Object.fromEntries(lineList.flat().map((l) => [l.id, l.name]));

  // Fetch direction names for platforms
  const directionIds = [
    ...new Set(
      platformList
        .flatMap((p) => [p.inboundDirectionId, p.outboundDirectionId])
        .filter((id): id is string => id !== null)
    ),
  ];
  const directionList =
    directionIds.length > 0
      ? await db
          .select()
          .from(lineDirections)
          .where(inArray(lineDirections.id, directionIds))
      : [];
  const directionMap = Object.fromEntries(directionList.map((d) => [d.id, d.displayName]));

  // Get platform IDs for this station
  const platformIds = platformList.map((p) => p.id);

  // Fetch platform locations for these platforms
  const locationList =
    platformIds.length > 0
      ? await db
          .select()
          .from(platformLocations)
          .where(inArray(platformLocations.platformId, platformIds))
          .orderBy(asc(platformLocations.nearPlatformCell))
      : [];

  const locationIds = locationList.map((l) => l.id);

  // Fetch facilities for these locations
  const facilityList =
    locationIds.length > 0
      ? await db
          .select()
          .from(stationFacilities)
          .where(inArray(stationFacilities.platformLocationId, locationIds))
      : [];

  // Fetch facility types
  const typeList = await db.select().from(facilityTypes);
  const typeMap = Object.fromEntries(typeList.map((t) => [t.code, t.name]));

  // Group locations by platformId
  const locationsByPlatform = new Map<string, typeof locationList>();
  for (const location of locationList) {
    const group = locationsByPlatform.get(location.platformId) ?? [];
    group.push(location);
    locationsByPlatform.set(location.platformId, group);
  }

  // Group facilities by platformLocationId
  const facilitiesByLocation = new Map<string, typeof facilityList>();
  for (const facility of facilityList) {
    const group = facilitiesByLocation.get(facility.platformLocationId) ?? [];
    group.push(facility);
    facilitiesByLocation.set(facility.platformLocationId, group);
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/stations" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Stations
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{station.name}</h2>
          {station.nameEn && (
            <p className="text-sm text-gray-500">{station.nameEn}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/stations/${stationId}/platforms/new`}
            className="px-4 py-2 border rounded hover:bg-gray-100 text-sm"
          >
            + New Platform
          </Link>
          <Link
            href={`/stations/${stationId}/facilities/new`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            + New Location
          </Link>
        </div>
      </div>

      {/* Platforms Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3">Platforms</h3>
        {platformList.length === 0 ? (
          <p className="text-gray-500 text-sm">No platforms registered yet.</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2">Max Cars</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {platformList.map((platform) => {
                  const directions = [];
                  if (platform.inboundDirectionId) {
                    directions.push(directionMap[platform.inboundDirectionId] ?? '上り');
                  }
                  if (platform.outboundDirectionId) {
                    directions.push(directionMap[platform.outboundDirectionId] ?? '下り');
                  }
                  const directionText = directions.length > 0 ? directions.join(' / ') : '-';

                  return (
                    <tr key={platform.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{platform.platformNumber}</td>
                      <td className="px-3 py-2">{lineNameMap[platform.lineId] ?? '-'}</td>
                      <td className="px-3 py-2">{directionText}</td>
                      <td className="px-3 py-2">{platform.maxCarCount}</td>
                      <td className="px-3 py-2 flex gap-2">
                        <Link
                          href={`/stations/${stationId}/platforms/${platform.id}/edit`}
                          className="px-2 py-1 text-xs border rounded hover:bg-gray-100"
                        >
                          Edit
                        </Link>
                        <DeleteButton
                          endpoint={`/api/stations/${stationId}/platforms/${platform.id}`}
                          redirectTo={`/stations/${stationId}/facilities`}
                          label="Delete"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Platform Locations Section - grouped by platform */}
      <h3 className="text-lg font-semibold mb-3">Platform Locations</h3>
      {locationList.length === 0 ? (
        <p className="text-gray-500">No locations registered yet.</p>
      ) : (
        <div className="space-y-6">
          {platformList.map((platform) => {
            const locations = locationsByPlatform.get(platform.id) ?? [];
            if (locations.length === 0) return null;

            const directions = [];
            if (platform.inboundDirectionId) directions.push(directionMap[platform.inboundDirectionId] ?? '上り');
            if (platform.outboundDirectionId) directions.push(directionMap[platform.outboundDirectionId] ?? '下り');
            const directionText = directions.length > 0 ? ` — ${directions.join(' / ')}` : '';

            return (
              <div key={platform.id}>
                <h4 className="text-sm font-semibold text-gray-600 mb-2 border-b pb-1">
                  Platform {platform.platformNumber}{directionText}
                </h4>
                <div className="space-y-2">
                  {locations.map((location) => {
                    const locFacilities = facilitiesByLocation.get(location.id) ?? [];
                    const hasLimitedAccessibility = locFacilities.some(
                      (f) => !f.isWheelchairAccessible || !f.isStrollerAccessible
                    );

                    return (
                      <div key={location.id} className="bg-white rounded-lg shadow p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {location.nearPlatformCell && (
                                <span className="text-sm text-gray-500 font-medium">
                                  枠 #{location.nearPlatformCell}
                                </span>
                              )}
                              {hasLimitedAccessibility && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                  Limited accessibility
                                </span>
                              )}
                            </div>
                            {location.exits && (
                              <p className="text-sm text-gray-600 mb-1">{location.exits}</p>
                            )}
                            {/* Facility types list */}
                            <div className="flex flex-wrap gap-1.5 mb-1">
                              {locFacilities.map((f) => (
                                <span
                                  key={f.id}
                                  className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                                >
                                  {typeMap[f.typeCode] ?? f.typeCode}
                                  {(!f.isWheelchairAccessible || !f.isStrollerAccessible) && (
                                    <span className="ml-1 text-yellow-600">*</span>
                                  )}
                                </span>
                              ))}
                            </div>
                            {location.notes && (
                              <p className="text-sm text-gray-400 mt-1">{location.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Link
                              href={`/stations/${stationId}/facilities/${location.id}/edit`}
                              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                            >
                              Edit
                            </Link>
                            <FacilityDuplicateButton
                              endpoint={`/api/stations/${stationId}/platform-locations/${location.id}/duplicate`}
                            />
                            <DeleteButton
                              endpoint={`/api/stations/${stationId}/platform-locations/${location.id}`}
                              redirectTo={`/stations/${stationId}/facilities`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
