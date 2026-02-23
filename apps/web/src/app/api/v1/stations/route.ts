import { NextRequest, NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { stations, stationLines, lines, operators } from '@furatora/database/schema';
import { ilike, eq, isNotNull, and, or } from 'drizzle-orm';
import type { StationGroup } from '@/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    // stationLines・lines を LEFT JOIN し、駅名と路線情報を一括取得
    // 同一物理駅が複数の路線レコードを持つ場合、行数が増えるため limit は多めに設定
    const rows = await db
      .select({
        id: stations.id,
        slug: stations.slug,
        code: stations.code,
        name: stations.name,
        nameEn: stations.nameEn,
        lat: stations.lat,
        lon: stations.lon,
        lineId: stationLines.lineId,
        lineName: lines.name,
        lineCode: lines.lineCode,
        lineColor: lines.color,
        lineSlug: lines.slug,
      })
      .from(stations)
      .innerJoin(operators, and(
        eq(operators.id, stations.operatorId),
        isNotNull(operators.displayPriority),
      ))
      .leftJoin(stationLines, eq(stationLines.stationId, stations.id))
      .leftJoin(lines, eq(lines.id, stationLines.lineId))
      .where(or(
        ilike(stations.name, `%${query}%`),
        ilike(stations.nameKana, `%${query}%`),
      ))
      .limit(60);

    // 駅名でグループ化（Map は挿入順を保持するため表示順が安定する）
    const groupMap = new Map<string, StationGroup>();

    for (const row of rows) {
      if (!groupMap.has(row.name)) {
        groupMap.set(row.name, {
          name: row.name,
          nameEn: row.nameEn,
          stations: [],
        });
      }
      groupMap.get(row.name)!.stations.push({
        id: row.id,
        slug: row.slug,
        code: row.code,
        lineId: row.lineId ?? null,
        lineName: row.lineName ?? null,
        lineCode: row.lineCode ?? null,
        lineColor: row.lineColor ?? null,
        lineSlug: row.lineSlug ?? null,
      });
    }

    const stationGroups = [...groupMap.values()].slice(0, 20);

    return NextResponse.json({
      stationGroups,
      total: stationGroups.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}