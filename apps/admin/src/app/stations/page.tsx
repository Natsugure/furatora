import Link from 'next/link';
import { db } from '@railease-navi/database/client';
import {
  operators,
  lines,
  stationLines,
  stations,
} from '@railease-navi/database/schema';
import { asc, eq } from 'drizzle-orm';

export default async function StationsPage() {
  const operatorList = await db.select().from(operators).orderBy(asc(operators.name));
  const lineList = await db.select().from(lines).orderBy(asc(lines.displayOrder));

  // Fetch stations grouped by line
  const lineStations = await Promise.all(
    lineList.map(async (line) => {
      const stns = await db
        .select({
          id: stations.id,
          name: stations.name,
          nameEn: stations.nameEn,
          code: stations.code,
          stationOrder: stationLines.stationOrder,
        })
        .from(stationLines)
        .innerJoin(stations, eq(stationLines.stationId, stations.id))
        .where(eq(stationLines.lineId, line.id))
        .orderBy(asc(stationLines.stationOrder));

      return { line, stations: stns };
    })
  );

  // Group by operator
  const byOperator = operatorList.map((op) => ({
    operator: op,
    lines: lineStations.filter((ls) => ls.line.operatorId === op.id),
  }));

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Stations</h2>

      {byOperator.map(({ operator, lines: opLines }) => (
        <div key={operator.id} className="mb-8">
          <h3 className="text-lg font-semibold mb-3">{operator.name}</h3>
          {opLines.map(({ line, stations: stns }) => (
            <div key={line.id} className="mb-4 ml-4">
              <div className="flex items-center gap-2 mb-2">
                {line.color && (
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: line.color }}
                  />
                )}
                <h4 className="font-medium">{line.name}</h4>
                <span className="text-sm text-gray-400">({stns.length} stations)</span>
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden ml-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Name (EN)</th>
                      <th className="px-3 py-2">Facilities</th>
                      <th className="px-3 py-2">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stns.map((stn) => (
                      <tr key={stn.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{stn.stationOrder}</td>
                        <td className="px-3 py-2 font-mono">{stn.code ?? '-'}</td>
                        <td className="px-3 py-2">{stn.name}</td>
                        <td className="px-3 py-2 text-gray-500">{stn.nameEn ?? '-'}</td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/stations/${stn.id}/facilities`}
                            className="text-blue-600 hover:underline"
                          >
                            Manage
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/stations/${stn.id}/edit`}
                            className="text-gray-500 hover:underline"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
