import type { CandidateRoute, PairRouteRecord } from '../ports';
import { mergeCards, mergeIntoCandidate } from './draft';
import type { PairDraft, RouteBody, RouteDraft } from './types';

// 重複ルートの検出。「設備の種類の集合＋4フラグ」が一致するルートを見つけ、「共有する」か「別ルートとして作る」かを
// 選ばせる。**保存は止めない**（中身が一致しても別の物理経路でありうる。例: 池袋の各線のエレベーター経由）。
// 範囲は候補ルート（S か T を端点に持つ接続のルートで、この駅対に結ばれていないもの）と同じ画面のカード。
// 設備0件（未入力）のルートは対象外（ADR-0012）。docs/domain/station-master-model.md「不変条件」参照。

export type DuplicateChoice = 'share' | 'separate';

export type DuplicateMatch =
  /** key のカードが、候補ルートと一致する */
  | { kind: 'candidate'; key: string; candidate: CandidateRoute }
  /** key のカードが、otherKey のカードと一致する（統合するときは key を otherKey に畳む） */
  | { kind: 'card'; key: string; otherKey: string };

type Shape = Pick<RouteBody, 'facilities' | 'isOutdoor' | 'requiresExitGate' | 'requiresStaff' | 'isOfficiallyGuided'>;

// 一致判定の形。所要時分・備考・label は含めない（同じ経路でも書き方が違いうる）
function signature(shape: Shape): string {
  return JSON.stringify([
    [...new Set(shape.facilities)].sort(),
    shape.isOutdoor,
    shape.requiresExitGate,
    shape.requiresStaff,
    shape.isOfficiallyGuided,
  ]);
}

export function matchKey(match: DuplicateMatch): string {
  return match.kind === 'candidate'
    ? `${match.key}|candidate:${match.candidate.routeId}`
    : `${match.key}|card:${match.otherKey}`;
}

export function findDuplicates(
  draft: PairDraft,
  originals: readonly PairRouteRecord[],
  candidates: readonly CandidateRoute[],
): DuplicateMatch[] {
  const originalById = new Map(originals.map((r) => [r.routeId, r]));
  const checkable = (r: RouteDraft) => r.facilities.length > 0;
  // 検査の対象: 新規、または設備・フラグが変わった既存ルート。変更の無い既存ルートは、
  // すでに存在している事実なので検出しない
  const isSubject = (r: RouteDraft) => {
    if (!checkable(r)) return false;
    if (r.routeId === null) return true;
    const original = originalById.get(r.routeId);
    return !original || signature(original) !== signature(r);
  };

  const matches: DuplicateMatch[] = [];

  for (const route of draft.routes) {
    if (!isSubject(route)) continue;
    const found = candidates.find(
      (c) => c.routeId !== route.routeId && c.facilities.length > 0 && signature(c) === signature(route),
    );
    if (found) matches.push({ kind: 'candidate', key: route.key, candidate: found });
  }

  // カードどうし。後ろのカードごとに、最初に一致した前のカードとの1件だけを報告する
  draft.routes.forEach((later, j) => {
    for (let i = 0; i < j; i += 1) {
      const earlier = draft.routes[i]!;
      if (!checkable(earlier) || !checkable(later)) continue;
      if (signature(earlier) !== signature(later)) continue;
      if (!isSubject(earlier) && !isSubject(later)) continue;
      if (earlier.routeId !== null && earlier.routeId === later.routeId) continue;
      // routeId を持つ側（既存ルート）を残す。両方持つ／持たないときは前のカードを残す
      const keepLater = later.routeId !== null && earlier.routeId === null;
      matches.push(
        keepLater
          ? { kind: 'card', key: earlier.key, otherKey: later.key }
          : { kind: 'card', key: later.key, otherKey: earlier.key },
      );
      break;
    }
  });

  return matches;
}

// 入力者の選択を下書きに反映する。選択が無い・「別ルートとして作る」の検出は変えない。
// 統合で先に消えたカードを含む検出は無視する（同一内容が3枚以上あるとき）
export function applyDuplicateChoices(
  draft: PairDraft,
  matches: readonly DuplicateMatch[],
  choices: Readonly<Record<string, DuplicateChoice>>,
): PairDraft {
  let next = draft;
  for (const match of matches) {
    if (choices[matchKey(match)] !== 'share') continue;
    const exists = (key: string) => next.routes.some((r) => r.key === key);
    if (!exists(match.key)) continue;
    if (match.kind === 'candidate') {
      next = mergeIntoCandidate(next, match.key, match.candidate);
    } else if (exists(match.otherKey)) {
      next = mergeCards(next, match.otherKey, match.key);
    }
  }
  return next;
}
