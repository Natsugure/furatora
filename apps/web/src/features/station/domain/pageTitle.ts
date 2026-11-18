// ページのタイトルの「%s」の部分（サイト名は layout.tsx の title.template が足す。Issue #8）

// カッコでくくらないのは、「東京さくらトラム（都電荒川線）」のように中にカッコを持つ路線名があるため。
// 路線名を「、」でつなぐのは、「日暮里・舎人ライナー」のように路線名の中に「・」が出てくるため。
// 今の stations は路線×駅の粒度で路線は1つだが、粒度が変わって（#82）複数になっても受けられるようにしておく
export function stationPageTitle(stationName: string, lineNames: string[]): string {
  const station = needsEkiSuffix(stationName) ? `${stationName}駅` : stationName;
  const lines = [...new Set(lineNames)].join('、');
  return lines ? `${station} ${lines}` : station;
}

export function linePageTitle(lineName: string): string {
  return `${lineName}の駅一覧`;
}

// 「王子駅前」「宇都宮駅東口」のように名前に「駅」を含むものと、「東京ディズニーランド・ステーション」には足さない。
// 停留場かどうかは見分けない。「駅家」（正式には駅家駅）も「駅」を含むので足さない。判断の根拠は ADR-0029
function needsEkiSuffix(stationName: string): boolean {
  return !stationName.includes('駅') && !stationName.endsWith('ステーション');
}
