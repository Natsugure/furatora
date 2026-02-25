import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { lines, lineDirections, stations } from '@furatora/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { DeleteButton } from '@/components/DeleteButton';

export default async function LineDirectionsPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const [line] = await db.select().from(lines).where(eq(lines.id, lineId));

  if (!line) notFound();

  const directions = await db
    .select()
    .from(lineDirections)
    .where(eq(lineDirections.lineId, lineId))
    .orderBy(asc(lineDirections.directionType));

  // Fetch representative stations
  const stationIds = directions.map((d) => d.representativeStationId);
  const stationList =
    stationIds.length > 0
      ? await db.select().from(stations).where(inArray(stations.id, stationIds))
      : [];
  const stationMap = Object.fromEntries(stationList.map((s) => [s.id, s.name]));

  return (
    <div>
      <div className="mb-6">
        <Link href="/lines" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Lines
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{line.name}</h2>
          <p className="text-sm text-gray-500">Manage Directions</p>
        </div>
        <Link
          href={`/lines/${lineId}/directions/new`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          + New Direction
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Define direction information for this line. This will be used when registering platforms.
      </p>

      {directions.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No directions defined yet. Click &quot;+ New Direction&quot; to create one.
        </p>
      ) : (
        <div className="space-y-3">
          {directions.map((direction) => (
            <div key={direction.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-lg">{direction.displayName}</span>
                    {direction.displayNameEn && (
                      <span className="text-sm text-gray-500">({direction.displayNameEn})</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Type: {direction.directionType === 'inbound' ? '上り (Inbound)' : '下り (Outbound)'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Representative Station: {stationMap[direction.representativeStationId] ?? '-'}
                  </p>
                  {direction.notes && (
                    <p className="text-sm text-gray-400 mt-1">{direction.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/lines/${lineId}/directions/${direction.id}/edit`}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                  >
                    Edit
                  </Link>
                  <DeleteButton
                    endpoint={`/api/lines/${lineId}/directions/${direction.id}`}
                    redirectTo={`/lines/${lineId}/directions`}
                    label="Delete"
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
