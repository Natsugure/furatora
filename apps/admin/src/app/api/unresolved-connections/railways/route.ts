import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { lines } from '@furatora/database/schema';
import { sql } from 'drizzle-orm';
import { unresolvedRailwaySchema } from '@/lib/validations';

function generateLineSlug(odptRailwayId: string): string {
  return odptRailwayId
    .replace('odpt.Railway:', '')
    .replace(/\./g, '-')
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = unresolvedRailwaySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { odptRailwayId, name, nameEn, operatorId, lineCode, color } = parsed.data;

    const [line] = await db
      .insert(lines)
      .values({
        odptRailwayId,
        slug: generateLineSlug(odptRailwayId),
        name,
        nameEn: nameEn ?? null,
        operatorId,
        lineCode: lineCode ?? null,
        color: color ?? null,
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
