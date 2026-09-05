// TASK-5.1b（Issue #56 / docs/spec/design.md「ローマ字変換規則」）。
//
// カナ → 修正ヘボン式ローマ字への変換器。slug 候補の生成に使う。
//
// 【変換元は station_name_k（stations.nameKana）】
// ekidata の station_name_r は station_name_k の機械転写に過ぎず、
// `shinnjukusannchoume` のような撥音の誤変換や `echigouuzawa`（エチゴユザワ）
// `ohanadyaya`（オハナヂャヤ）のような表記揺れを含む。station_name_r を
// 後から修理するのではなく、揺れの無いカナから決定的に導出する。
//
// 【この規則は furatora の方針であって汎用ユーティリティではない】
// 長音を縮約する／撥音を m 化しない／`ジェイアール`→`jr` にする、は
// slug の形を決める furatora の判断である。他プロジェクトへ持ち出す前提を
// 置いていない（design.md「romaji.ts は master-import に置かない」）。
//
// 実測（2026-09 実CSV突合。station-publishing/domain/romaji.test.ts の
// describe('hepburn: 回帰（実CSV155駅）') 参照）:
// 決定的規則のみで純粋なローマ字化としての正解率は約86%、
// 本モジュールが対応する置換辞書・撥音方針を含めると約90%まで上がる。
// 残る約10%は「原理的に決まらないもの」（後述）であり、
// 形態素解析器を導入せず、公開時の人の目（TASK-5.2）で拾う。

/**
 * ジェイアール接頭辞。この文字列で始まるカナは `jr-` + 残りの変換に短絡する
 * （実測13駅）。JR各社の一部駅がカナ表記に事業者名を含んでいるための救済であり、
 * 通常の五十音変換では `jeiaaru...` のような読めない文字列になってしまう。
 */
const JR_PREFIX = 'ジェイアール';

/** 促音（ッ）の直後の子音を重ねる際、`ch` の前だけ `t` にする（クッチャン→kutchan） */
function doubledConsonant(nextRomaji: string): string {
  if (nextRomaji.startsWith('ch')) return 't';
  const first = nextRomaji[0];
  return /[bcdfghjklmnpqrstvwxyz]/.test(first) ? first : '';
}

// 拗音（キャ・シャ 等）。小書きの ャュョ を伴う2文字の組。
// シ/チ/ツ/フ/ジ の行はワープロ式（si/ti/tu/hu）を採らず修正ヘボン式で書く。
const YOUON: Record<string, string> = {
  キャ: 'kya', キュ: 'kyu', キョ: 'kyo',
  シャ: 'sha', シュ: 'shu', ショ: 'sho',
  チャ: 'cha', チュ: 'chu', チョ: 'cho',
  ニャ: 'nya', ニュ: 'nyu', ニョ: 'nyo',
  ヒャ: 'hya', ヒュ: 'hyu', ヒョ: 'hyo',
  ミャ: 'mya', ミュ: 'myu', ミョ: 'myo',
  リャ: 'rya', リュ: 'ryu', リョ: 'ryo',
  ギャ: 'gya', ギュ: 'gyu', ギョ: 'gyo',
  ジャ: 'ja', ジュ: 'ju', ジョ: 'jo',
  ヂャ: 'ja', ヂュ: 'ju', ヂョ: 'jo', // ヂ→ji と同じ理由でジャ行に合流させる
  ビャ: 'bya', ビュ: 'byu', ビョ: 'byo',
  ピャ: 'pya', ピュ: 'pyu', ピョ: 'pyo',
  // 外来音（拡張カナ）
  ファ: 'fa', フィ: 'fi', フェ: 'fe', フォ: 'fo', フュ: 'fyu',
  ティ: 'ti', ディ: 'di', トゥ: 'tu', ドゥ: 'du',
  ウィ: 'wi', ウェ: 'we', ウォ: 'wo',
  ヴァ: 'va', ヴィ: 'vi', ヴェ: 've', ヴォ: 'vo',
  チェ: 'che', シェ: 'she', ジェ: 'je',
  ツァ: 'tsa', ツィ: 'tsi', ツェ: 'tse', ツォ: 'tso',
};

// 五十音（清音・濁音・半濁音）+ 撥音 + 促音・長音記号。
// シ/チ/ツ/フ/ジ/ヂ/ヅ はワープロ式を排し修正ヘボン式で書く（design.md 決定的規則）。
const GOJUON: Record<string, string> = {
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'o', ン: 'n',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  ヴ: 'vu',
};

/** 促音（小書きのッ） */
const SOKUON = 'ッ';
/** 長音記号（ー） */
const CHOUON_MARK = 'ー';
/** 拗音を作る小書きの母音（ァィゥェォ）と ャュョ */
const SMALL_KANA = new Set(['ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ャ', 'ュ', 'ョ']);

/**
 * 長音の縮約（design.md「長音の縮約」）。
 * ー記号の削除に加え、お段+ウ／お段+オ（「トウキョウ→tokyo」「オオサカ→osaka」）
 * のように「お段の直前の音を延ばす」カナが続く場合はそのカナを落とす。
 *
 * 【お段だけを対象とする】あ段+ア／い段+イ／う段+ウ／え段+イ・エ は縮約しない。
 * 実CSVの実測で「ニイガタ→niigata」「タイセイ→taisei」「シンイワクニ→shiniwakuni」の
 * ように、お段以外は形態素境界であることが多く延ばす表記自体が稀であるのに対し、
 * お段+ウ／オ（長音「オー」）は「トウキョウ→tokyo」のように縮約するのが一般的な
 * 変換規則として広く通用している。お段のみを対象にしても、なお解決できない
 * 境界（タケオ+オンセン→takeonsen 等）は design.md「原理的に決まらないもの」として
 * 許容し、形態素解析器は導入しない。
 */
function isChouonContinuation(prevChar: string, kana: string): boolean {
  if (kana === CHOUON_MARK) return true;
  return prevChar === 'o' && (kana === 'ウ' || kana === 'オ');
}

/**
 * カナ1文字列を修正ヘボン式ローマ字へ変換する（furatora の方針込み）。
 *
 * @param kana 全角カタカナ（stations.nameKana / lines.nameKana）。
 *   ひらがな・半角カナ・空白混じりは呼び出し側で正規化してから渡すこと
 *   （現状 ekidata の station_name_k は全角カタカナのみで供給される）。
 */
export function hepburn(kana: string): string {
  if (kana.startsWith(JR_PREFIX)) {
    const rest = kana.slice(JR_PREFIX.length);
    return rest.length > 0 ? `jr-${hepburn(rest)}` : 'jr';
  }

  let result = '';
  let i = 0;
  while (i < kana.length) {
    const ch = kana[i];

    if (ch === SOKUON) {
      // 次のモーラ（拗音なら2文字）を読み、その先頭子音を重ねる
      const nextMora = SMALL_KANA.has(kana[i + 2]) ? kana.slice(i + 1, i + 3) : kana[i + 1];
      const nextRomaji = YOUON[nextMora] ?? GOJUON[nextMora];
      if (nextRomaji) {
        result += doubledConsonant(nextRomaji);
      }
      i += 1;
      continue;
    }

    // 拗音（2文字）を先に試す。拗音の先頭カナ自体が長音継続になることは無いため、
    // 直前の長音縮約チェックより先に処理してよい
    const pair = kana.slice(i, i + 2);
    if (YOUON[pair]) {
      result += YOUON[pair];
      i += 2;
      continue;
    }

    // 長音縮約は「直前に出力した音の末尾」でのみ判定する。撥音（ン→'n'）を挟むと
    // 末尾は子音になり縮約は起きない。子音を越えて母音を探すと、[お段]+ン+オ／ウ で
    // 「ホンオオクボ→honkubo（正: honokubo）」のようにモーラを落としてしまう（本大久保 等）。
    const prevChar = result[result.length - 1] ?? '';
    if (prevChar && isChouonContinuation(prevChar, ch)) {
      i += 1;
      continue;
    }

    const mapped = GOJUON[ch];
    if (mapped) {
      result += mapped;
      i += 1;
      continue;
    }

    // 未知の文字（空白・記号等）はそのまま捨てる。呼び出し側で正規化する前提だが、
    // 変換不能な入力で例外を投げてインポート/公開操作を止めないための安全側の挙動
    i += 1;
  }

  return result;
}
