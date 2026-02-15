import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { lines } from '@stroller-transit-app/database/schema';
import { sql } from 'drizzle-orm';

function generateLineSlug(odptRailwayId: string): string {
  return odptRailwayId
    .replace('odpt.Railway:', '')
    .replace(/\./g, '-')
    .toLowerCase();
}

export async function POST(request: Request) {
  const body = await request.json();
  const { odptRailwayId, name, nameEn, operatorId, lineCode, color } = body;

  const [line] = await db
    .insert(lines)
    .values({
      odptRailwayId,
      slug: generateLineSlug(odptRailwayId),
      name,
      nameEn: nameEn || null,
      operatorId,
      lineCode: lineCode || null,
      color: color || null,
      displayOrder: 999,
    })
    .returning();

  // 同じ odptRailwayId を持つ未解決の接続を一括更新
  await db.execute(sql`
    UPDATE station_connections
    SET connected_railway_id = ${line.id}
    WHERE odpt_railway_id = ${odptRailwayId}
      AND connected_railway_id IS NULL
  `);

  return NextResponse.json(line, { status: 201 });
}
