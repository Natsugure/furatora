// 方面ラベル（「池袋方面」など）の解決規則（ADR-0014 / docs/domain/line-directions.md）。

import type { DirectionType } from '@furatora/database/enums';

// 走行方向の語彙は @furatora/database/enums に1つだけ置く（ADR-0015）。利用側の import を変えないため再 export する
export type { DirectionType };

export type DirectionLabelSource = 'platform' | 'default' | 'fallback';

/** Admin の方面一覧・フォームの「方面タイプ」の表記にも使う */
export const FALLBACK_DIRECTION_LABELS: Record<DirectionType, string> = {
  inbound: '上り',
  outbound: '下り',
};

export function resolveDirectionLabel(input: {
  directionType: DirectionType;
  /** ①: その駅のその路線のホームが、その走行方向の枠に持つ方面の文言（呼び出し側がホーム番号順に並べる） */
  platformNames: readonly string[];
  /** ②: (路線, 走行方向) の既定行の文言。既定行が無ければ null */
  defaultName: string | null;
}): { label: string; source: DirectionLabelSource } {
  // 1つの走行方向に複数のホームが対応する駅（中野坂上 inbound。#128）では、どれか1つに決めずに並べる
  const platformNames = [...new Set(input.platformNames.filter((name) => name !== ''))];
  if (platformNames.length > 0) return { label: platformNames.join('／'), source: 'platform' };
  if (input.defaultName) return { label: input.defaultName, source: 'default' };
  return { label: FALLBACK_DIRECTION_LABELS[input.directionType], source: 'fallback' };
}

// 駅ごとの「最初の路線」。行は呼び出し側の SQL で lines.displayOrder, lines.id 順に並べてあること。
// 1駅が複数路線を持っても（#82）、読み込みのたびに変わらないようにするため、この順の先頭を採る
export function firstLineByStation(
  rows: readonly { stationId: string; lineId: string; lineName: string }[],
): Map<string, { lineId: string; lineName: string }> {
  const firstLineOf = new Map<string, { lineId: string; lineName: string }>();
  for (const row of rows) {
    if (!firstLineOf.has(row.stationId)) firstLineOf.set(row.stationId, { lineId: row.lineId, lineName: row.lineName });
  }
  return firstLineOf;
}

/**
 * 駅の方面ラベル。駅は現在1駅1路線なので、駅の最初の路線（firstLineByStation）について解決する。
 * 路線で絞るのは、1駅が複数路線を持つようになったとき（#82）に別路線の文言が混ざらないようにするため
 */
export function resolveStationDirectionLabels(input: {
  stationId: string;
  firstLineOf: ReadonlyMap<string, { lineId: string }>;
  /** ①: ホームの枠ごとの方面。全駅分をそのまま渡してよい */
  platformRows: readonly {
    stationId: string;
    lineId: string;
    platformNumber: string;
    inboundName: string | null;
    outboundName: string | null;
  }[];
  /** ②: 路線の既定行 */
  defaultRows: readonly { lineId: string; directionType: DirectionType; displayName: string }[];
}): Record<DirectionType, string> {
  const lineId = input.firstLineOf.get(input.stationId)?.lineId;
  // 路線の無い駅は、ホームや既定行があっても使わない（どの路線の文言かを決められない）
  const platformsOfLine =
    lineId === undefined
      ? []
      : input.platformRows
          .filter((p) => p.stationId === input.stationId && p.lineId === lineId)
          // ホーム番号は varchar なので、SQL の並びでは '10' が '2' より前になる。数値として並べる
          .sort((a, b) => a.platformNumber.localeCompare(b.platformNumber, 'ja', { numeric: true }));
  const resolve = (directionType: DirectionType, names: (string | null)[]) =>
    resolveDirectionLabel({
      directionType,
      platformNames: names.filter((name): name is string => name !== null),
      defaultName:
        lineId === undefined
          ? null
          : (input.defaultRows.find((d) => d.lineId === lineId && d.directionType === directionType)?.displayName ??
            null),
    }).label;
  return {
    inbound: resolve('inbound', platformsOfLine.map((p) => p.inboundName)),
    outbound: resolve('outbound', platformsOfLine.map((p) => p.outboundName)),
  };
}
