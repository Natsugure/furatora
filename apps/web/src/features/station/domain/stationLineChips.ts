// 駅の詳細の見出しに並べる路線のチップ。
// 駅の路線一覧は DTO に無いため、ホームの路線と乗換先の路線から作る（クエリを増やさない。Issue #166 の design.md）。
// 乗換先は相手駅の路線なので、自駅の路線（ホーム）を先に並べる
export type StationLineChip = { name: string; color: string | null };

type LineRef = { lineName: string; lineColor: string | null };

export function stationLineChips(platforms: LineRef[], partners: LineRef[]): StationLineChip[] {
  const chips = new Map<string, StationLineChip>();
  for (const { lineName, lineColor } of [...platforms, ...partners]) {
    if (!chips.has(lineName)) chips.set(lineName, { name: lineName, color: lineColor });
  }
  return [...chips.values()];
}
