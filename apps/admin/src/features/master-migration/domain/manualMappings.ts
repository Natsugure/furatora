// 自動突合では決まらない対応を人が書き下す表（docs/spec/design.md「移行アルゴリズム」）。
//
// 自動突合より **先に** 引く。ここに書かれた対応は、名前一致や全駅包含よりも
// 確かな根拠（人が CSV を読んで確認した結果）だからである。

/**
 * 事業者: odptOperatorId → ekidata company_cd（17件・TASK-3.1）。
 *
 * 現行DBの17事業者には全件 odptOperatorId が入っている（実測済み）。
 * 名前で突合しないのは、ekidata の company_name が現行DBの name と
 * **全件完全一致してしまう**ためである。一致すること自体は好都合に見えるが、
 * 名前は表記ゆれで壊れる。ID を鍵にする方が壊れ方が分かりやすい。
 *
 * 実DBの値は `odpt.Operator:TokyoMetro` の形式である（2026-09-04 実測）。
 * 照合は `:` の後ろで行うため、接頭辞の有無どちらでも引ける。
 */
export const OPERATOR_COMPANY_CD: Readonly<Record<string, number>> = {
  'JR-East': 2,
  'JR-Central': 3,
  TokyoMetro: 18,
  Toei: 119,
  Tobu: 11,
  Seibu: 12,
  Keisei: 13,
  Keio: 14,
  Odakyu: 15,
  Tokyu: 16,
  Keikyu: 17,
  SaitamaRailway: 121,
  MIR: 123,
  Yurikamome: 125,
  TokyoMonorail: 148,
  TWR: 149,
  ToyoRapid: 150,
};

/** `odpt.Operator:TokyoMetro` と `TokyoMetro` のどちらでも同じ鍵にする */
export function operatorKey(odptOperatorId: string | null): string | null {
  if (!odptOperatorId) return null;
  const key = odptOperatorId.slice(odptOperatorId.lastIndexOf(':') + 1).trim();
  return key === '' ? null : key;
}

/**
 * 路線: `<事業者キー>/<現行DBの路線名>` → ekidata line_cd（TASK-3.2）。
 *
 * 【この表がまだ空である理由】
 * design.md は要手動を4件（常磐線快速 / 東海道線 / 豊島線 /
 * 東武スカイツリーライン(支線)）と特定しているが、**対応する line_cd は
 * docs のどこにも記録されていない。** 値は CSV を読まないと決まらない。
 *
 * 【埋め方】
 * 1. Admin の /master-migration で CSV 4件を選び「突合を試算」する
 * 2. 未突合一覧に出た路線の `候補` 欄（同一事業者内で名前が近い ekidata 路線）を見る
 * 3. CSV で該当行を確認し、根拠コメントを添えてここに書く
 *
 * 期待件数も暫定である。design.md の「46件中42件が自動決定」は
 * 未解決接続由来の46路線に対する実測であり、メトロ10 + 都営6 を含む
 * 62件全体の数字ではない。試算の実測で確定させる。
 */
export const MANUAL_LINE_CD: Readonly<Record<string, number>> = {
  // 例: 'JR-East/常磐線快速': 11312,
};

/**
 * 駅: `<事業者キー>/<現行DBの路線名>/<現行DBの駅名>` → ekidata station_cd（TASK-3.3）。
 *
 * design.md が特定している要手動は4件。
 * - 常磐線快速の新橋・東京、高崎線の東京（上野東京ライン経由で乗り入れる駅であり、
 *   ekidata では当該路線の駅として登録されていない）
 * - 京王新線の「新宿」（ekidata 側の駅名が「新線新宿」であり、正規化しても一致しない）
 *
 * 新幹線11駅は会員版CSVに存在するため自動で解決する見込みである
 * （requirements.md C-1 は解消済み）。
 *
 * line_cd と同じく station_cd も docs に無い。埋め方は MANUAL_LINE_CD と同じ。
 */
export const MANUAL_STATION_CD: Readonly<Record<string, number>> = {
  // 例: 'Keio/京王新線/新宿': 2400115,
};
