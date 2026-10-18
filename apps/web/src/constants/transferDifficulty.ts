import type { Assessment, RouteFacts } from '@furatora/transfer-difficulty/domain';

// 乗換セクションの状態ごとの見出しとアイコン。状態の分類そのものは @furatora/transfer-difficulty/domain の assessRoutes。
// 色は ADR-0018: あり = セージ、なし = アンバー（赤は路線色とぶつかる）、確認できていない = ニュートラル。
// 色だけに頼らず、記号（◎ × ＊）と文言を必ず添える（REQ-9）
type StatusKind = Exclude<Assessment<RouteFacts>['kind'], 'unevaluated'>;

export const TRANSFER_STATUS_META = {
  barrierFree: {
    label: 'バリアフリールートあり',
    iconPath: '/icons/double_circle.svg',
    iconColor: 'var(--sage-500)',
    labelClassName: 'text-route-ok-700',
  },
  // 設備未入力のルートがあるため「なし」とは言えない（ADR-0012）
  undetermined: {
    label: 'バリアフリールートを確認できていません',
    iconPath: '/icons/asterisk.svg',
    iconColor: 'var(--neutral-500)',
    labelClassName: 'text-ink-soft',
  },
  none: {
    label: 'バリアフリールートなし',
    iconPath: '/icons/cross.svg',
    iconColor: 'var(--amber-500)',
    labelClassName: 'text-route-none-700',
  },
} as const satisfies Record<StatusKind, { label: string; iconPath: string; iconColor: string; labelClassName: string }>;

// ルートの4フラグのうち、利用者に伝える側の値の文言
export const ROUTE_FLAG_LABEL = {
  isOutdoor: '屋外を通る',
  requiresExitGate: '改札外を通る',
  requiresStaff: '係員の対応が必要',
  // false のときに出す。isOfficiallyGuided は「駅の構内図・公式の案内に載っているルートか」
  notOfficiallyGuided: '駅の構内図・公式案内に載っていないルート',
} as const;
