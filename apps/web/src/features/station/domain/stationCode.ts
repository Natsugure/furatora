// 駅番号（例: G01、方南町支線の Mb03）を、路線記号の英字と番号に分ける。
// 駅番号の見方を1か所にまとめ、駅のバッジ（StationBadge）と路線記号（LineSymbol）で食い違わないようにする。
// この形に合わないもの（A-11 など）は null。呼び出し側で、そのまま出すか描かないかを決める
export type StationCodeParts = { lineSymbol: string; number: string };

export function parseStationCode(code: string): StationCodeParts | null {
  const [, lineSymbol, number] = code.match(/^([A-Za-z]+)(\d+)$/) ?? [];
  return lineSymbol && number ? { lineSymbol, number } : null;
}
