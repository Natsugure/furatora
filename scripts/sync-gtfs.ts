import { headers } from 'next/headers';
import { db } from './db';
import { stations, operators } from '../src/db/schema';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

type GTFSStop = {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  operator: OperatorFromCsv
};

type OperatorFromCsv = {
  gtfs_agency_id: string;
  operator_name: string;
};

const syncGTFSData = async () => {
  console.log('🚀 Starting GTFS data synchronization...');

  await upsertOperator();

  const filePath = path.join(process.cwd(), 'public/gtfs-data/tokyo-metro/stops.txt');
  const content = fs.readFileSync(filePath, 'utf-8');

  const result = Papa.parse<GTFSStop>(content, {
    header: true,
    skipEmptyLines: true,
  });

  console.log(`📊 Found ${result.data.length} stations`);

  const operator = await db.query.operators.findFirst({
    where: (operators, { eq }) => eq(operators.name, '東京メトロ'),
  });

  if(!operator) {
    throw new Error('Operator not found');
  }

  const stationsData = result.data.map(stop => ({
    gtfsStopId: stop.stop_id,
    code: stop.stop_code || null,
    name: stop.stop_name,
    lat: stop.stop_lat,
    lon: stop.stop_lon,
    operatorId: operator.id,
  }));

  // データを挿入（既存データは更新）
  for (const station of stationsData) {
    await db.insert(stations)
      .values(station)
      .onConflictDoUpdate({
        target: stations.gtfsStopId,
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

const upsertOperator = async () => {
  console.log('🚀 Starting operator upsert...');

  const filePath = path.join(process.cwd(), 'public/gtfs-data/operator.csv');
  const content = fs.readFileSync(filePath, 'utf-8');

  const result = Papa.parse<OperatorFromCsv>(content, {
    header: true,
    skipEmptyLines: true,
  });

  console.log(`📊 Found ${result.data.length} operators`);

  const operatorsData = result.data.map(operator => ({
    name: operator.operator_name,
    gtfs_agency_id: operator.gtfs_agency_id,
  }));

  await db.insert(operators)
    .values(operatorsData)
    .onConflictDoNothing();

  console.log('✅ Operator upsert completed!');
};

syncGTFSData().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});