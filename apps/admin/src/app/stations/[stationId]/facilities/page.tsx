import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import {
  stations,
  stationFacilities,
  facilityConnections,
  platforms,
  lines,
  lineDirections,
} from '@stroller-transit-app/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { DeleteButton } from '@/components/DeleteButton';

const TYPE_LABELS: Record<string, string> = {
  elevator: 'Elevator',
  escalator: 'Escalator',
  stairs: 'Stairs',
};

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

  const facilities = await db
    .select()
    .from(stationFacilities)
    .where(eq(stationFacilities.stationId, stationId))
    .orderBy(asc(stationFacilities.type), asc(stationFacilities.nearCarNumber));

  // Fetch connections for all facilities
  const connections = await Promise.all(
    facilities.map((f) =>
      db
        .select()
        .from(facilityConnections)
        .where(eq(facilityConnections.facilityId, f.id))
    )
  );

  // Fetch connected station names
  const connectedStationIds = [...new Set(connections.flat().map((c) => c.connectedStationId))];
  const connectedStations =
    connectedStationIds.length > 0
      ? await Promise.all(
          connectedStationIds.map((sid) =>
            db.select({ id: stations.id, name: stations.name }).from(stations).where(eq(stations.id, sid))
          )
        )
      : [];
  const stationNameMap = Object.fromEntries(
    connectedStations.flat().map((s) => [s.id, s.name])
  );

  const facilitiesWithConnections = facilities.map((f, i) => ({
    ...f,
    connections: connections[i],
  }));

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
            + New Facility
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

      {/* Facilities Section */}
      <h3 className="text-lg font-semibold mb-3">Facilities</h3>
      {facilitiesWithConnections.length === 0 ? (
        <p className="text-gray-500">No facilities registered yet.</p>
      ) : (
        <div className="space-y-4">
          {facilitiesWithConnections.map((facility) => (
            <div
              key={facility.id}
              className="bg-white rounded-lg shadow p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {TYPE_LABELS[facility.type] ?? facility.type}
                    </span>
                    {facility.nearCarNumber && (
                      <span className="text-sm text-gray-500">
                        (Car #{facility.nearCarNumber})
                      </span>
                    )}
                    {facility.isAccessible === false && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        Not accessible
                      </span>
                    )}
                  </div>
                  {facility.description && (
                    <p className="text-sm text-gray-600">{facility.description}</p>
                  )}
                  {facility.notes && (
                    <p className="text-sm text-gray-400 mt-1">{facility.notes}</p>
                  )}
                  {facility.connections.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Connections:</p>
                      <ul className="text-sm text-gray-600">
                        {facility.connections.map((conn) => (
                          <li key={conn.id}>
                            {stationNameMap[conn.connectedStationId] ?? conn.connectedStationId}
                            {conn.description && ` - ${conn.description}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/stations/${stationId}/facilities/${facility.id}/edit`}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                  >
                    Edit
                  </Link>
                  <DeleteButton
                    endpoint={`/api/stations/${stationId}/facilities/${facility.id}`}
                    redirectTo={`/stations/${stationId}/facilities`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
