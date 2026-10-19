// 駅から乗れる・乗り換えられる路線（Issue #172）。
// 乗換先は乗換接続（station_connections）の相手駅から導く。乗換単位（station_groups）は使わない。
// 乗換関係は推移的でなく、グループからは「淡路町–JR御茶ノ水」のような誤りが出るため（ADR-0021）。
export type LineRef = { lineName: string; lineColor: string | null };

export type ReachableLines = {
  /** この駅名で乗れる路線。自駅の路線 → 同じ駅名の乗換先（渋谷の各社など）の順 */
  here: LineRef[];
  /** 別の駅名の乗換先（淡路町から見た新御茶ノ水など）。駅名は最初に出た順 */
  transfers: { stationName: string; lines: LineRef[] }[];
};

// 同じ路線名は最初に出た1つだけを残す。here を先に確定するので、here に出た路線は transfers に出ない
// （徒歩で別の駅へ移らなくても乗れる路線を、乗換先として二重に見せない）
export function reachableLines(
  stationName: string,
  ownLines: LineRef[],
  partners: (LineRef & { connectedStationName: string })[],
): ReachableLines {
  const seen = new Set<string>();
  const firstSeen = (lineName: string) => {
    if (seen.has(lineName)) return false;
    seen.add(lineName);
    return true;
  };
  const isHere = (p: { connectedStationName: string }) => p.connectedStationName === stationName;

  const here = [...ownLines, ...partners.filter(isHere)]
    .filter((l) => firstSeen(l.lineName))
    .map(({ lineName, lineColor }) => ({ lineName, lineColor }));

  const transfers = new Map<string, LineRef[]>();
  for (const p of partners) {
    if (isHere(p) || !firstSeen(p.lineName)) continue;
    const lines = transfers.get(p.connectedStationName) ?? [];
    lines.push({ lineName: p.lineName, lineColor: p.lineColor });
    transfers.set(p.connectedStationName, lines);
  }

  return {
    here,
    transfers: [...transfers].map(([name, lines]) => ({ stationName: name, lines })),
  };
}
