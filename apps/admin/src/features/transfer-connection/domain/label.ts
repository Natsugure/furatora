// 同名の駅どうし（池袋↔池袋）でも区別できるよう、駅名に路線名を添える
export function withLine(stationName: string, lineName: string | null): string {
  return lineName ? `${stationName}（${lineName}）` : stationName;
}
