import { db } from '@furatora/database/client';
import { stationLines, lines, lineDirections } from '@furatora/database/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import type { LineWithDirections } from '@/features/platform/ports';

// stationLayoutPageQuery が新規ホーム追加フォームの路線候補として再利用する
// Query Service。方面を路線にネストして返すことで、路線切替時の
// fetch（/api/lines/{id}/directions）とレースが不要になる（#49 / #32）。
//
// 当該駅の stationLines に載っている路線だけを返す。
// ホームは駅に停車する路線に属するものなので、それ以外の路線を選択肢に出す意味がない。
// かつ lines は実測 602 件あり（#49 設計時の想定 62 件は古い）、全件を返すと
// ホームの新規・編集ページを開くたびに RSC ペイロードへ全路線が載る。
export async function getLinesWithDirections(stationId: string): Promise<LineWithDirections[]> {
  const stationLineIds = db
    .select({ lineId: stationLines.lineId })
    .from(stationLines)
    .where(eq(stationLines.stationId, stationId));

  const [lineRows, directionRows] = await Promise.all([
    db
      .select({ id: lines.id, name: lines.name })
      .from(stationLines)
      .innerJoin(lines, eq(lines.id, stationLines.lineId))
      .where(eq(stationLines.stationId, stationId))
      .orderBy(asc(lines.displayOrder)),
    db
      .select({
        id: lineDirections.id,
        lineId: lineDirections.lineId,
        directionType: lineDirections.directionType,
        displayName: lineDirections.displayName,
      })
      .from(lineDirections)
      .where(inArray(lineDirections.lineId, stationLineIds))
      .orderBy(asc(lineDirections.directionType)),
  ]);

  return lineRows.map((line) => {
    const forLine = directionRows.filter((d) => d.lineId === line.id);
    return {
      id: line.id,
      name: line.name,
      inboundDirections: forLine
        .filter((d) => d.directionType === 'inbound')
        .map((d) => ({ id: d.id, displayName: d.displayName })),
      outboundDirections: forLine
        .filter((d) => d.directionType === 'outbound')
        .map((d) => ({ id: d.id, displayName: d.displayName })),
    };
  });
}
