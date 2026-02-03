import { db } from '@stroller-transit-app/database/client';
import { stations, lines, stationLines, odptMetadata, operators } from '@stroller-transit-app/database/schema';
import { eq, and, notInArray, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ODPT API のレスポンス型定義
type OdptRailway = {
  '@id': string;
  '@type': string;
  'dc:date': string;
  'dc:title': string;
  'owl:sameAs': string;
  'odpt:color'?: string;
  'odpt:lineCode'?: string;
  'odpt:operator': string;
  'odpt:railwayTitle': {
    ja: string;
    en?: string;
    ko?: string;
    'zh-Hans'?: string;
    'zh-Hant'?: string;
  };
  'odpt:stationOrder': {
    'odpt:index': number;
    'odpt:station': string;
    'odpt:stationTitle': {
      ja: string;
      en?: string;
      ko?: string;
      'ja-Hrkt'?: string;
      'zh-Hans'?: string;
      'zh-Hant'?: string;
    };
  }[];
};

type OdptStation = {
  '@id': string;
  '@type': string;
  'dc:date': string;
  'dc:title': string;
  'owl:sameAs': string;
  'geo:lat': number;
  'geo:long': number;
  'odpt:railway': string;
  'odpt:operator': string;
  'odpt:stationCode'?: string;
  'odpt:stationTitle': {
    ja: string;
    en?: string;
    ko?: string;
    'ja-Hrkt'?: string;
    'zh-Hans'?: string;
    'zh-Hant'?: string;
  };
  'odpt:connectingRailway'?: string[];
  'odpt:connectingStation'?: string[];
};

type Operator = 'TokyoMetro' | 'Toei';

// 路線の表示順マッピング (odptRailwayId → displayOrder)
const LINE_DISPLAY_ORDER: Record<string, number> = {
  // 東京メトロ
  'odpt.Railway:TokyoMetro.Ginza': 1,
  'odpt.Railway:TokyoMetro.Marunouchi': 2,
  'odpt.Railway:TokyoMetro.MarunouchiBranch': 3,
  'odpt.Railway:TokyoMetro.Hibiya': 4,
  'odpt.Railway:TokyoMetro.Tozai': 5,
  'odpt.Railway:TokyoMetro.Chiyoda': 6,
  'odpt.Railway:TokyoMetro.Yurakucho': 7,
  'odpt.Railway:TokyoMetro.Hanzomon': 8,
  'odpt.Railway:TokyoMetro.Namboku': 9,
  'odpt.Railway:TokyoMetro.Fukutoshin': 10,
  // 都営
  'odpt.Railway:Toei.Asakusa': 11,
  'odpt.Railway:Toei.Mita': 12,
  'odpt.Railway:Toei.Shinjuku': 13,
  'odpt.Railway:Toei.Oedo': 14,
  'odpt.Railway:Toei.NipporiToneri': 15,
  'odpt.Railway:Toei.Toden': 16,
};

// odptRailwayId からスラッグを生成
// 例: "odpt.Railway:TokyoMetro.Marunouchi" → "tokyometro-marunouchi"
function generateSlug(odptRailwayId: string): string {
  return odptRailwayId
    .replace('odpt.Railway:', '')
    .replace(/\./g, '-')
    .toLowerCase();
}

async function fetchOdptData<T>(endpoint: string, operator: Operator): Promise<T[]> {
  const url = `https://api.odpt.org/api/v4/${endpoint}?odpt:operator=odpt.Operator:${operator}&acl:consumerKey=${process.env.ODPT_API_KEY}`;

  console.log(`Fetching ${operator} ${endpoint} data...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T[]>;
}

async function updateOdptData(operator: Operator) {
  // 路線データと駅データを取得
  const [railwayData, stationData] = await Promise.all([
    fetchOdptData<OdptRailway>('odpt:Railway', operator),
    fetchOdptData<OdptStation>('odpt:Station', operator),
  ]);

  console.log(`${operator}: Fetched ${railwayData.length} railways and ${stationData.length} stations`);

  // ハッシュ値で更新確認
  const railwayHash = crypto.createHash('sha256').update(JSON.stringify(railwayData)).digest('hex');
  const stationHash = crypto.createHash('sha256').update(JSON.stringify(stationData)).digest('hex');

  const lastMetadata = await db.query.odptMetadata.findFirst({
    where: eq(odptMetadata.operator, operator)
  });

  if (lastMetadata?.railwayHash === railwayHash && lastMetadata?.stationHash === stationHash) {
    console.log(`${operator}: No updates detected`);
    return;
  }

  console.log(`${operator}: New data detected, processing...`);

  // オペレーター情報を取得
  const operatorRecord = await db
    .select()
    .from(operators)
    .where(eq(operators.odptOperatorId, `odpt.Operator:${operator}`))
    .limit(1)
    .then(rows => rows[0]);

  if (!operatorRecord) {
    console.error(`${operator}: Operator record not found in database`);
    return;
  }

  await db.transaction(async (tx) => {
    // 1. 路線データを登録/更新
    const lineValues = railwayData.map((railway) => ({
      operatorId: operatorRecord.id,
      odptRailwayId: railway['owl:sameAs'],
      slug: generateSlug(railway['owl:sameAs']),
      lineCode: railway['odpt:lineCode'] || null,
      name: railway['odpt:railwayTitle']?.ja || railway['dc:title'],
      nameEn: railway['odpt:railwayTitle']?.en || null,
      color: railway['odpt:color'] || null,
      displayOrder: LINE_DISPLAY_ORDER[railway['owl:sameAs']] ?? 999,
    }));

    const BATCH_SIZE = 100;
    for (let i = 0; i < lineValues.length; i += BATCH_SIZE) {
      const batch = lineValues.slice(i, i + BATCH_SIZE);

      await tx
        .insert(lines)
        .values(batch)
        .onConflictDoUpdate({
          target: [lines.odptRailwayId, lines.operatorId],
          set: {
            slug: sql`EXCLUDED.slug`,
            lineCode: sql`EXCLUDED.line_code`,
            name: sql`EXCLUDED.name`,
            nameEn: sql`EXCLUDED.name_en`,
            color: sql`EXCLUDED.color`,
            displayOrder: sql`EXCLUDED.display_order`,
            updatedAt: new Date(),
          }
        });
    }
    console.log(`${operator}: Upserted ${lineValues.length} lines`);

    // 2. 駅データを登録/更新
    const stationValues = stationData.map((station) => ({
      operatorId: operatorRecord.id,
      odptStationId: station['owl:sameAs'],
      code: station['odpt:stationCode'] || null,
      name: station['odpt:stationTitle']?.ja || station['dc:title'],
      nameEn: station['odpt:stationTitle']?.en || null,
      lat: station['geo:lat']?.toString() || null,
      lon: station['geo:long']?.toString() || null,
    }));

    for (let i = 0; i < stationValues.length; i += BATCH_SIZE) {
      const batch = stationValues.slice(i, i + BATCH_SIZE);

      await tx
        .insert(stations)
        .values(batch)
        .onConflictDoUpdate({
          target: [stations.odptStationId, stations.operatorId],
          set: {
            code: sql`EXCLUDED.code`,
            name: sql`EXCLUDED.name`,
            nameEn: sql`EXCLUDED.name_en`,
            lat: sql`EXCLUDED.lat`,
            lon: sql`EXCLUDED.lon`,
            updatedAt: new Date(),
          }
        });
    }
    console.log(`${operator}: Upserted ${stationValues.length} stations`);

    // 3. 路線と駅の関連データを登録 (stationOrder から取得)
    // 既存のstationLinesを削除してから再登録
    const lineRecords = await tx
      .select({ id: lines.id, odptRailwayId: lines.odptRailwayId })
      .from(lines)
      .where(eq(lines.operatorId, operatorRecord.id));

    const lineIdMap = new Map(lineRecords.map(l => [l.odptRailwayId, l.id]));

    const stationRecords = await tx
      .select({ id: stations.id, odptStationId: stations.odptStationId })
      .from(stations)
      .where(eq(stations.operatorId, operatorRecord.id));

    const stationIdMap = new Map(stationRecords.map(s => [s.odptStationId, s.id]));

    // 路線ごとの駅順序データを収集（重複排除用にMapを使用）
    // 同じ駅が同じ路線に複数回登場する場合（分岐路線など）は、最初の出現を使用
    const stationLineMap = new Map<string, { stationId: string; lineId: string; stationOrder: number }>();

    for (const railway of railwayData) {
      const lineId = lineIdMap.get(railway['owl:sameAs']);
      if (!lineId) continue;

      for (const order of railway['odpt:stationOrder'] || []) {
        const stationId = stationIdMap.get(order['odpt:station']);
        if (!stationId) continue;

        const key = `${stationId}:${lineId}`;
        // 最初に登場した順序を保持（分岐路線では本線側の順序を優先）
        if (!stationLineMap.has(key)) {
          stationLineMap.set(key, {
            stationId,
            lineId,
            stationOrder: order['odpt:index'],
          });
        }
      }
    }

    const stationLineValues = Array.from(stationLineMap.values());

    // 既存のstationLinesを削除
    for (const lineRecord of lineRecords) {
      await tx
        .delete(stationLines)
        .where(eq(stationLines.lineId, lineRecord.id));
    }

    // 新しいstationLinesを登録
    for (let i = 0; i < stationLineValues.length; i += BATCH_SIZE) {
      const batch = stationLineValues.slice(i, i + BATCH_SIZE);
      await tx.insert(stationLines).values(batch);
    }
    console.log(`${operator}: Registered ${stationLineValues.length} station-line relations`);

    // 4. 不要なデータを削除
    const newStationIds = stationData.map(s => s['owl:sameAs']);
    await tx
      .delete(stations)
      .where(
        and(
          eq(stations.operatorId, operatorRecord.id),
          notInArray(stations.odptStationId, newStationIds)
        )
      );

    const newLineIds = railwayData.map(r => r['owl:sameAs']);
    await tx
      .delete(lines)
      .where(
        and(
          eq(lines.operatorId, operatorRecord.id),
          notInArray(lines.odptRailwayId, newLineIds)
        )
      );

    // 5. メタデータを更新
    await tx
      .insert(odptMetadata)
      .values({
        operator,
        railwayHash,
        stationHash,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: odptMetadata.operator,
        set: {
          railwayHash,
          stationHash,
          updatedAt: new Date()
        }
      });
  });

  console.log(`${operator}: Update completed successfully`);
}

async function main() {
  console.log('Starting ODPT data update...');

  try {
    await updateOdptData('TokyoMetro');
    await updateOdptData('Toei');
    console.log('All ODPT data updated successfully');
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
