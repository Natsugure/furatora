// 方面ラベル（「池袋方面」など）の解決規則（ADR-0014 / docs/domain/line-directions.md）。

export type DirectionType = 'inbound' | 'outbound';

export type DirectionLabelSource = 'platform' | 'default' | 'fallback';

/** Admin の方面一覧・フォームの「方面タイプ」の表記と同じ対応 */
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
