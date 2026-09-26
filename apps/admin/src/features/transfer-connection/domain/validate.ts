import { COMBO_KEYS, type ComboKey, type PairSaveInput } from './types';

// 駅対の保存入力の検証。クライアント（保存前）と API（422）の両方が同じ関数を通す。
// zod（schema.ts）は形だけを見る（400）。ここは意味の検証（422）と、保存を止めない警告を返す。

export type ValidationIssue = {
  code: string;
  message: string;
  /** PairSaveInput.routes の添字。toSaveInput はカードの順序を保つので、カードと1対1に対応する */
  routeIndex?: number;
  combo?: ComboKey;
};

// transfer_routes.minutes は smallint
const MINUTES_MAX = 32767;
// connection_routes.label は varchar(100)
const LABEL_MAX = 100;

export function validateSaveInput(input: PairSaveInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  input.routes.forEach((route, routeIndex) => {
    const label = route.label.trim();
    if (label === '') {
      issues.push({ code: 'label_required', message: 'ルートの名前（label）を入力してください', routeIndex });
    } else if (label.length > LABEL_MAX) {
      issues.push({ code: 'label_too_long', message: `ルートの名前は${LABEL_MAX}字以内にしてください`, routeIndex });
    }
    if (route.combos.length === 0) {
      issues.push({ code: 'combo_required', message: '適用先の方面の組み合わせを1つ以上選んでください', routeIndex });
    }
    if (route.minutes !== null && (!Number.isInteger(route.minutes) || route.minutes < 0 || route.minutes > MINUTES_MAX)) {
      issues.push({ code: 'minutes_invalid', message: '所要時分は0以上の整数で入力してください', routeIndex });
    }
  });

  // 同じ routeId のカードが複数ある = 統合し忘れ。unique_connection_route と、
  // 同じルートへの互いに食い違う UPDATE の両方を避ける
  const seenRouteIds = new Map<string, number>();
  input.routes.forEach((route, routeIndex) => {
    if (route.routeId === null) return;
    if (seenRouteIds.has(route.routeId)) {
      issues.push({
        code: 'route_id_duplicate',
        message: '同じルートが複数のカードに分かれています。カードを統合してください',
        routeIndex,
      });
    }
    seenRouteIds.set(route.routeId, routeIndex);
  });

  // label の重複と基準ルートの2本は、組み合わせ（＝接続）単位で判定する。
  // DB の unique_connection_route_label / unique_connection_baseline が接続単位のため
  for (const combo of COMBO_KEYS) {
    const labels = new Set<string>();
    let baselineCount = 0;
    input.routes.forEach((route, routeIndex) => {
      if (!route.combos.includes(combo)) return;
      const label = route.label.trim();
      if (label !== '') {
        if (labels.has(label)) {
          issues.push({
            code: 'label_duplicate',
            message: `同じ名前のルートがあります（${label}）`,
            routeIndex,
            combo,
          });
        }
        labels.add(label);
      }
      if (route.isBaseline) {
        baselineCount += 1;
        if (baselineCount === 2) {
          issues.push({
            code: 'baseline_duplicate',
            message: '基準ルートは1つの方面の組み合わせにつき1本までです',
            routeIndex,
            combo,
          });
        }
      }
    });
  }

  return issues;
}

export function collectWarnings(input: PairSaveInput): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  for (const combo of COMBO_KEYS) {
    const applied = input.routes.filter((r) => r.combos.includes(combo));
    if (applied.length > 0 && !applied.some((r) => r.isBaseline)) {
      warnings.push({
        code: 'no_baseline',
        message: '基準ルートがありません。迂回度を出せません',
        combo,
      });
    }
  }

  // 階段と階段昇降機は「同じ段差に対する代替手段」の代表例。集合は「すべて通る」を意味するので、
  // 同居させるとベビーカーが通れないルートと判定される。別ルートにすること。
  // 階段と車いす対応エスカレーターは、重い方の記録を省略できるため警告しない
  input.routes.forEach((route, routeIndex) => {
    if (route.facilities.includes('stairs') && route.facilities.includes('stairLift')) {
      warnings.push({
        code: 'alternative_facilities',
        message: '階段と階段昇降機は代替手段です。同じルートに入れず、別のルートにしてください',
        routeIndex,
      });
    }
  });

  return warnings;
}
