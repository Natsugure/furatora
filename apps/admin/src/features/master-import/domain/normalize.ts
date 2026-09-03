/**
 * 駅名の同一性を判定するための正規化。
 *
 * インポートは正規化した名前を**保存しない**。保存するのは CSV の原文である。
 * ここで作るのは突合（ODPT 由来の既存行と ekidata の駅を対応づける Phase 3）と
 * 重複検出のためのキーであり、表示にも使わない。
 *
 * ekidata が消えても「駅名の同一性」という関心は残るため domain に置く
 * （docs/spec/design.md「domain に何を置くかの基準」）。
 */

/**
 * 括弧は中身ごと落とす。`押上〈スカイツリー前〉` と `押上（スカイツリー前）` は
 * 同じ駅であり、ekidata の内部でも山括弧と丸括弧が混在している。
 * 実データ（現役10,625駅）に現れるのは `〈〉` 5件と `（）` 32件のみだが、
 * 半角 `()` も同じ意味で使われうるため併せて対象にする。
 */
const BRACKETED = /[（(〈][^）)〉]*[）)〉]/g;

/**
 * 突合用のキーを作る。
 * - 括弧とその中身を除去する
 * - `ヶ` を `ケ` に寄せる（市ケ谷 / 市ヶ谷）
 *
 * 除去の結果が空になる場合は、原文を（`ヶ` の置換だけ行って）返す。
 * 名前全体が括弧に包まれた駅は実データに無いが、キーが空文字になると
 * 無関係な駅どうしが一致してしまうため、その経路を作らない。
 */
export function normalizeStationName(name: string): string {
  const withoutBrackets = name.replace(BRACKETED, '').trim();
  const base = withoutBrackets === '' ? name.trim() : withoutBrackets;
  return base.replace(/ヶ/g, 'ケ');
}
