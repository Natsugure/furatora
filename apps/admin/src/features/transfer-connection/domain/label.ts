import { directionsOfCombo } from './normalize';
import type { ComboKey } from './types';

// 同名の駅どうし（池袋↔池袋）でも区別できるよう、駅名に路線名を添える
export function withLine(stationName: string, lineName: string | null): string {
  return lineName ? `${stationName}（${lineName}）` : stationName;
}

// 方面の組み合わせの表示（行 = 自駅 S、列 = 相手駅 T）。方面表のチェックボックスの名前と、
// 組み合わせ単位の検証エラー・警告の見出しで同じ文言にそろえる
export function describeCombo(combo: ComboKey, stationName: string, connectedStationName: string): string {
  const [s, t] = directionsOfCombo(combo);
  return `${stationName} ${s} × ${connectedStationName} ${t}`;
}

// 検証エラー・警告の1行。組み合わせを持つものは、どの組み合わせかを前に添える
export function describeIssue(
  issue: { message: string; combo?: ComboKey },
  stationName: string,
  connectedStationName: string,
): string {
  return issue.combo
    ? `${describeCombo(issue.combo, stationName, connectedStationName)}: ${issue.message}`
    : issue.message;
}
