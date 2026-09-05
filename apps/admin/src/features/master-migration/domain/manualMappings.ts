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
 * **値 `null` は「ekidata に対応する行が存在しない」ことを人が確認した印である。**
 * 未記載（自動突合に任せる）と区別する。null を書いた行は自動突合を打ち切り、
 * コードを NULL のまま残す。
 *
 * 【値の出どころ】2026-09-04、会員版CSV（line20260618 / station20260731）と
 * 本番相当のDBに対して突合を実行し、未突合・適用不能として出た行を CSV で確認した。
 */
export const MANUAL_LINE_CD: Readonly<Record<string, number | null>> = {
  // --- 包含判定が複数の路線に一致してしまうもの ---
  // ODPT の路線は運行系統粒度で作られており、区間が短い路線ほど
  // 「その駅を全部持っている ekidata 路線」が複数になる。
  // 例: {上野, 東京} は新幹線5路線すべてに含まれる
  'JR-East/東海道線': 11301, // JR東海道本線(東京～熱海)。{東京,新橋} は山手線・京浜東北線・横須賀線にも含まれる
  'JR-East/横須賀線': 11308, // JR横須賀線。同上
  'JR-East/高崎線': 11323, // JR高崎線。{上野,東京} が新幹線5路線に一致する
  'JR-East/武蔵野線': 11305, // JR武蔵野線。{西船橋} が中央・総武線と京葉線にも含まれる
  'JR-East/湘南新宿ライン': 11333, // {渋谷,新宿,池袋,恵比寿} が山手線・埼京線にも含まれる
  'JR-East/上越新幹線': 1005, // 1006（ガーラ湯沢支線）にも同じ2駅が含まれる
  'Seibu/豊島線': 22004, // 西武豊島線。{練馬} が西武池袋線・西武有楽町線にも含まれる

  // --- 包含判定が成立しないもの ---
  // JR常磐線(上野～取手)。現行DBの「常磐線快速」は上野東京ライン経由で
  // 乗り入れる東京・新橋を含むが、ekidata の常磐線にその2駅は無い
  'JR-East/常磐線快速': 11320,
  // 東京メトロ有楽町線。現行DBの「麴町」(U+9EB4) と ekidata の「麹町」(U+9EB9) が
  // 異体字で一致せず、1駅欠けるために包含判定が落ちる
  'TokyoMetro/有楽町線': 28006,

  // --- ekidata に対応する路線が存在しないもの ---
  // ekidata の東京メトロは9路線しかなく、方南町の分岐線は 28002 に畳まれている。
  // 28002 は「丸ノ内線」が取るため、こちらはコードを持てない（ekidata*Cd は一意）。
  // 所属駅は下の MANUAL_STATION_CD で個別に対応づける
  'TokyoMetro/丸ノ内線支線': null,
  // ekidata の 11320「JR常磐線(上野～取手)」は快速線と緩行線の両方の駅を1本に持つ。
  // 現行DBは運行系統で2本に割れており、11320 は「常磐線快速」が取る
  // （快速は4駅が 11320 に一致するのに対し、各駅停車は綾瀬1駅しか持たない）。
  // 綾瀬は下の MANUAL_STATION_CD で対応づける
  'JR-East/常磐線各駅停車': null,
  // ekidata の東武は 21002「東武伊勢崎線」1本で、押上支線はそこに畳まれている。
  // 21002 は「東武スカイツリーライン」が取る
  'Tobu/東武スカイツリーライン(支線)': null,
};

/**
 * 駅: `<事業者キー>/<現行DBの路線名>/<現行DBの駅名>` → ekidata station_cd（TASK-3.3）。
 *
 * `null` の意味は MANUAL_LINE_CD と同じである。
 *
 * **路線が未突合でもこの表は引く。** 上の「対応する路線が存在しない」2路線の駅は、
 * ekidata では親路線の駅として存在するため、ここで直接対応づけられる。
 */
export const MANUAL_STATION_CD: Readonly<Record<string, number | null>> = {
  // ekidata 側の駅名が「新線新宿」であり、正規化しても一致しない
  'Keio/京王新線/新宿': 2400701,
  // 麴(U+9EB4) と 麹(U+9EB9) の異体字差。括弧除去とヶ/ケ では吸収できない
  'TokyoMetro/有楽町線/麴町': 2800615,

  // --- 路線が ekidata に無い分の駅（親路線の駅として存在する） ---
  'TokyoMetro/丸ノ内線支線/中野新橋': 2800226,
  'TokyoMetro/丸ノ内線支線/中野富士見町': 2800227,
  'TokyoMetro/丸ノ内線支線/方南町': 2800228,
  // 中野坂上は「丸ノ内線」側の行が 2800220 を取る。DB は路線×駅粒度のため
  // 同じ駅が2行あるが、ekidata は1行しか持たない。こちらは NULL のまま残す
  'TokyoMetro/丸ノ内線支線/中野坂上': null,
  // ekidata では「押上〈スカイツリー前〉」。括弧除去で名前は一致するが、
  // 路線が未突合のため候補を引けない
  'Tobu/東武スカイツリーライン(支線)/押上': 2100203,
  // ekidata では 11320（常磐線）の駅。路線は「常磐線快速」が取るため個別に対応づける
  'JR-East/常磐線各駅停車/綾瀬': 1132006,

  // --- 上野東京ライン経由で乗り入れる駅（対応づけられない） ---
  // 現行DBは「常磐線快速の東京」「高崎線の東京」を別の行として持つが、
  // ekidata でこれらに当たるのは 11343「上野東京ライン」の東京 1件だけである。
  // ekidataStationCd は一意であり、2行が同じコードを持てない。
  // 片方に割り当てる根拠が無いため、どちらも NULL のまま残す（REQ-3.2）。
  //
  // これは突合の失敗ではなく、**粒度が一致しないこと**の現れである。
  // 現行の路線×駅粒度は暫定であり（docs/spec/design.md「粒度は暫定である」）、
  // 確定は実データ投入後の後続Issue（tasks.md TASK-6.4）で行う。
  // それまでは Admin の未突合解決UI（TASK-5.3）に出続ける
  'JR-East/常磐線快速/東京': null,
  'JR-East/常磐線快速/新橋': null,
  'JR-East/高崎線/東京': null,
};
