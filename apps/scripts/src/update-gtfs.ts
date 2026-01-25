import { db } from '@stroller-transit-app/database/client';
import { stations, gtfsMetadata, operators } from '@stroller-transit-app/database/schema';
import { eq, and, notInArray, sql } from 'drizzle-orm';
import AdmZip from 'adm-zip';
import Papa from 'papaparse';
import crypto from 'crypto';
import { decimal } from 'drizzle-orm/gel-core';

type GTFSStop = {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  platform_code?: string;
  wheelchair_boarding?: string;
};

type Operator = 'TokyoMetro' | 'Toei';

async function updateGTFS(operator: Operator) {
  const url = `https://api.odpt.org/api/v4/files/${operator}/data/${operator}-Train-GTFS.zip?acl:consumerKey=${process.env.ODPT_API_KEY}`;
  
  console.log(`Fetching ${operator} GTFS data...`);
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());

    // バッファの内容を確認（最初の数バイト）
  console.log(`${operator}: Downloaded ${buffer.length} bytes`);
  console.log(`${operator}: First bytes:`, buffer.subarray(0, 20).toString('hex'));
  console.log(`${operator}: Content-Type:`, response.headers.get('content-type'));
  
  // ZIPファイルのマジックナンバー確認 (PK\x03\x04 または 50 4B 03 04)
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
    console.error(`${operator}: Not a valid ZIP file`);
    console.error('First 100 bytes as text:', buffer.subarray(0, 100).toString('utf-8'));
    throw new Error('Downloaded file is not a valid ZIP archive');
  }
  
  // ハッシュ値で更新確認
  const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const lastHash = await db.query.gtfsMetadata.findFirst({
    where: eq(gtfsMetadata.operator, operator)
  });
  
  if (lastHash?.hash === currentHash) {
    console.log(`${operator}: No updates detected`);
    return;
  }
  
  console.log(`${operator}: New data detected, processing...`);
  const zip = new AdmZip(buffer);
  const stopsEntry = zip.getEntry('stops.txt');
  
  if (!stopsEntry) {
    console.error(`${operator}: stops.txt not found in ZIP`);
    return;
  }
  
  const csvContent = stopsEntry.getData().toString('utf-8');
  
  const parseResult = await new Promise<Papa.ParseResult<GTFSStop>>((resolve, reject) => {
    Papa.parse<GTFSStop>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: resolve,
      error: reject
    });
  });
  
  if (parseResult.errors.length > 0) {
    console.error(`${operator}: Parse errors:`, parseResult.errors);
    throw new Error('CSV parsing failed');
  }
  
  const stopsData = parseResult.data;
  console.log(`${operator}: Parsed ${stopsData.length} stops`);

  const operatorRecord = await db
    .select()
    .from(operators)
    .where(eq(operators.gtfsAgencyId, operator))
    .limit(1)
    .then(rows => rows[0]);
  
  await db.transaction(async (tx) => {
    const newStopIds = stopsData.map(row => row.stop_id);

    const values = stopsData.map((row) => ({
      operatorId: operatorRecord.id,
      gtfsStopId: row.stop_id,
      code: row.stop_code || null,
      name: row.stop_name,
      lat: row.stop_lat,
      lon: row.stop_lon,
    }));

    // バッチに分けてUPSERT
    const BATCH_SIZE = 500;
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      
      await tx
        .insert(stations)
        .values(batch)
        .onConflictDoUpdate({
          target: [stations.operatorId, stations.gtfsStopId],
          set: {
            code: sql`EXCLUDED.code`,
            name: sql`EXCLUDED.name`,
            lat: sql`EXCLUDED.lat`,
            lon: sql`EXCLUDED.lon`,
          }
        });
      
      console.log(`${operator}: Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(values.length / BATCH_SIZE)}`);
    }

    const deleteResult = await tx
      .delete(stations)
      .where(
        and(
          eq(stations.operatorId, operatorRecord.id),
          notInArray(stations.gtfsStopId, newStopIds)
        )
      );

    console.log(`${operator}: Deleted ${deleteResult || 0} obsolete records`);

    await tx
      .insert(gtfsMetadata)
      .values({
        operator,
        hash: currentHash,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: gtfsMetadata.operator,
        set: { 
          hash: currentHash, 
          updatedAt: new Date() 
        }
      });
  });
  
  console.log(`${operator}: Update completed successfully`);
}

async function main() {
  console.log('Starting GTFS data update...');
  
  try {
    await updateGTFS('TokyoMetro');
    await updateGTFS('Toei');
    console.log('All GTFS data updated successfully');
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();