import { hepburn } from './romaji';

// slug = `${lines.slug}-${hepburn(nameKana)}`。路線を前置することで
// 全国で衝突しない（`(line_cd, ヘボン駅名)` の衝突ゼロを実データで確認済み）。
// 自動投入せず、公開操作の時点で管理者が確認して確定する列である。
// 設計・経緯: docs/domain/station-master-model.md「slug の導出規則」（Issue #56）。

/**
 * slug 候補を組み立てる。路線の slug が未設定、またはカナが無い場合は
 * 候補を作れないため null を返す（呼び出し側が「先に路線の slug を求める」
 * 導線を出す判断材料になる）。
 */
export function buildSlugCandidate(lineSlug: string | null, nameKana: string | null): string | null {
  if (!lineSlug || !nameKana) return null;
  const romaji = hepburn(nameKana);
  if (!romaji) return null;
  return `${lineSlug}-${romaji}`;
}

/**
 * カナ側の欠陥（漢字名に無い「駅」「停留場」がカナにだけ付いている行）の検出。
 *
 * 例: 天童南／テンドウミナミエキ、東宿郷／ヒガシシュクゴウテイリュウジョウ。
 * 末尾の `エキ`／`テイリュウジョウ` を機械的に落とす実装は採らない
 * （家城／イエキ、植木／ウエキ を巻き添えにするため）。
 *
 * この関数は romaji.ts の変換規則ではなく、**公開前に人の目を通すための
 * 検出**である。「漢字名が 駅／停留場 で終わっていないのに、カナだけ
 * エキ／テイリュウジョウ で終わっている」行を拾う。家城・植木のように
 * 漢字側もカナ側も駅名として正当な行（欠陥ではない偶然の一致）も拾ってしまうが、
 * 公開操作の確認材料としては「念のため見てもらう」方に倒すのが安全である。
 */
export function hasKanaEkiSuffixMismatch(name: string, nameKana: string | null): boolean {
  if (!nameKana) return false;
  const kanaEndsWithEki = nameKana.endsWith('エキ') || nameKana.endsWith('テイリュウジョウ');
  const nameEndsWithEki = name.endsWith('駅') || name.endsWith('停留場');
  return kanaEndsWithEki && !nameEndsWithEki;
}
