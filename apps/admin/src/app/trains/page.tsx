import Link from 'next/link';
import { db } from '@stroller-transit-app/database/client';
import { trains, operators } from '@stroller-transit-app/database/schema';
import { asc, eq } from 'drizzle-orm';
import { DeleteButton } from '@/components/DeleteButton';
import { DuplicateButton } from '@/components/DuplicateButton';

export default async function TrainsPage() {
  const trainList = await db.select().from(trains).orderBy(asc(trains.name));
  const operatorList = await db.select().from(operators);
  const operatorMap = Object.fromEntries(operatorList.map((op) => [op.id, op.name]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Trains</h2>
        <Link
          href="/trains/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          + New Train
        </Link>
      </div>

      {trainList.length === 0 ? (
        <p className="text-gray-500">No trains registered yet.</p>
      ) : (
        <table className="w-full bg-white rounded-lg shadow">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3">Cars</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trainList.map((train) => (
              <tr key={train.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">{train.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {operatorMap[train.operators] ?? '-'}
                </td>
                <td className="px-4 py-3 text-sm">{train.carCount}</td>
                <td className="px-4 py-3 flex gap-2">
                  <Link
                    href={`/trains/${train.id}/edit`}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                  >
                    Edit
                  </Link>
                  <DuplicateButton trainId={train.id} trainName={train.name} />
                  <DeleteButton
                    endpoint={`/api/trains/${train.id}`}
                    redirectTo="/trains"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
