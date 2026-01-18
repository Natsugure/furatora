import { db } from '../src/db';
import { stations } from '../src/db/schema';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

type GTFSStop = {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
}

const syncGTFSData = async () => {
  console.log('🚀 Starting GTFS data synchronization...');

  const filePath = path.join(process.cwd(), 'public/gtfs-data/tokyo-metro/stops.txt');
  const content = fs.readFileSync(filePath, 'utf-8');

  const result = Papa.parse<GTFSStop>(content, {
    header: true,
    skipEmptyLines: true,
  });

  console.log(`📊 Found ${result.data.length} stations`);

  const stationsData = result.data.map(stop => ({
    id: stop.stop_id,
    code: stop.stop_code || null,
    name: stop.stop_name,
    lat: stop.stop_lat,
    lon: stop.stop_lon,
    operator: 'TokyoMetro',
  }));

  // データを挿入（既存データは更新）
  for (const station of stationsData) {
    await db.insert(stations)
      .values(station)
      .onConflictDoUpdate({
        target: stations.id,
        set: {
          name: station.name,
          lat: station.lat,
          lon: station.lon,
          updatedAt: new Date(),
        },
      });
  }

  console.log('✅ GTFS synchronization completed!');
  process.exit(0);
};

syncGTFSData().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});