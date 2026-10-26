import { db } from '@furatora/database/client';
import { stations, stationLines, lines } from '@furatora/database/schema';
import { toKanaSearchKey } from '@/features/station/domain/kana';
import { stripRomajiSeparator } from '@/features/station/domain/romaji';
import { ilike, eq, and, or, sql } from 'drizzle-orm';
import type { StationGroup } from '@/types';
import { publishedStation } from './visibility';

// name_en（例: Naka-meguro）から区切り記号を除いた値。
// 入力側の stripRomajiSeparator と同じ規則で揃える（片方だけ変えるとヒットしなくなる）
const normalizedNameEn = sql`translate(${stations.nameEn}, '- 　', '')`;
// name_kana（例: メイジジングウマエ　ハラジュク）から半角・全角の空白を除いた値。
// 入力側の toKanaSearchKey と同じ規則で揃える
const normalizedNameKana = sql`translate(${stations.nameKana}, ' 　', '')`;

/**
 * 駅名・カナ・ローマ字のいずれかが、検索キーを pattern で包んだ値に一致する条件を作る。
 * 区切り記号や空白だけの入力は検索キーが空になり、'%%' が全駅に一致してしまうため条件から外す
 */
function matchesAnyName(query: string, pattern: (key: string) => string) {
  const kanaKey = toKanaSearchKey(query);
  const romajiKey = stripRomajiSeparator(query);
  return or(
    ilike(stations.name, pattern(query)),
    kanaKey ? ilike(normalizedNameKana, pattern(kanaKey)) : undefined,
    romajiKey ? ilike(normalizedNameEn, pattern(romajiKey)) : undefined,
  );
}

/** 駅名・カナ・ローマ字のいずれかに検索キーを含む駅の条件 */
export function stationSearchCondition(query: string) {
  return matchesAnyName(query, (key) => `%${key}%`);
}

/**
 * 一致の度合い（完全一致 0 → 前方一致 1 → 部分一致 2）。
 * 短い入力は limit を超えて一致するため、並べてから切らないと完全一致の駅が落ちる
 */
export function stationSearchRank(query: string) {
  return sql`case when ${matchesAnyName(query, (key) => key)} then 0 when ${matchesAnyName(query, (key) => `${key}%`)} then 1 else 2 end`;
}

/**
 * /api/v1/stations（駅名検索）。
 * stationLines・lines を LEFT JOIN し、駅名と路線情報を一括取得する。
 * @param query 検索条件
 * @returns `Promise<StationGroup[]>` 検索条件に合致した公開駅のグループ。一致の度合いが高い順に並ぶ。
 */
export async function searchVisibleStations(query: string): Promise<StationGroup[]> {
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
    .leftJoin(stationLines, eq(stationLines.stationId, stations.id))
    .leftJoin(lines, eq(lines.id, stationLines.lineId))
    .where(and(publishedStation(), stationSearchCondition(query)))
    // 同じ順位の中はカナ順。同名駅の行が隣り合うよう name も添える
    .orderBy(stationSearchRank(query), normalizedNameKana, stations.name)
    .limit(60); // 同一物理駅が複数の路線レコードを持つ場合、行数が増えるため limit は多めに設定する。

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
      // slug は非 null（published_requires_slug の CHECK 制約により、
      // publishedStation() を通った行は必ず slug を持つ）
      slug: row.slug!,
      code: row.code,
      lineId: row.lineId ?? null,
      lineName: row.lineName ?? null,
      lineCode: row.lineCode ?? null,
      lineColor: row.lineColor ?? null,
      lineSlug: row.lineSlug ?? null,
    });
  }

  return [...groupMap.values()].slice(0, 20);
}
