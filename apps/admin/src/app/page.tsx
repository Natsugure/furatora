import { db } from '@railease-navi/database/client';
import { operators, lines, stations, trains, stationFacilities } from '@railease-navi/database/schema';
import { count } from 'drizzle-orm';

async function fetchCounts() {
  const [operatorCount] = await db.select({ count: count() }).from(operators);
  const [lineCount] = await db.select({ count: count() }).from(lines);
  const [stationCount] = await db.select({ count: count() }).from(stations);
  const [trainCount] = await db.select({ count: count() }).from(trains);
  const [facilityCount] = await db.select({ count: count() }).from(stationFacilities);

  return {
    operators: operatorCount.count,
    lines: lineCount.count,
    stations: stationCount.count,
    trains: trainCount.count,
    facilities: facilityCount.count,
  };
}

export default async function Dashboard() {
  const counts = await fetchCounts();

  const cards = [
    { label: 'Operators', value: counts.operators },
    { label: 'Lines', value: counts.lines },
    { label: 'Stations', value: counts.stations },
    { label: 'Trains', value: counts.trains },
    { label: 'Facilities', value: counts.facilities },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-lg shadow p-4 text-center"
          >
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
