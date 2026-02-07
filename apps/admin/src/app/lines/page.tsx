import Link from 'next/link';
import { db } from '@stroller-transit-app/database/client';
import { lines, operators } from '@stroller-transit-app/database/schema';
import { asc } from 'drizzle-orm';

export default async function LinesPage() {
  const lineList = await db.select().from(lines).orderBy(asc(lines.displayOrder));
  const operatorList = await db.select().from(operators);
  const operatorMap = Object.fromEntries(operatorList.map((op) => [op.id, op.name]));

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Lines</h2>

      {lineList.length === 0 ? (
        <p className="text-gray-500">No lines found.</p>
      ) : (
        <table className="w-full bg-white rounded-lg shadow">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lineList.map((line) => (
              <tr key={line.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">{line.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {operatorMap[line.operatorId] ?? '-'}
                </td>
                <td className="px-4 py-3 text-sm font-mono">{line.lineCode ?? '-'}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/lines/${line.id}/directions`}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                  >
                    Manage Directions
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
