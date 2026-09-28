import type { Assessment, RouteFacts } from '@furatora/transfer-difficulty/domain';

// 乗換セクションの状態ごとの見出しとアイコン。状態の分類そのものは @furatora/transfer-difficulty/domain の assessRoutes。
type StatusKind = Exclude<Assessment<RouteFacts>['kind'], 'unevaluated'>;

export const TRANSFER_STATUS_META = {
  barrierFree: {
    label: 'バリアフリールートあり',
    iconPath: '/icons/double_circle.svg',
    iconColorHex: '#7CB342',
  },
  // 設備未入力のルートがあるため「なし」とは言えない（ADR-0012）
  undetermined: {
    label: 'バリアフリールートを確認できていません',
    iconPath: '/icons/asterisk.svg',
    iconColorHex: '#757575',
  },
  none: {
    label: 'バリアフリールートなし',
    iconPath: '/icons/cross.svg',
    iconColorHex: '#E53935',
  },
} as const satisfies Record<StatusKind, { label: string; iconPath: string; iconColorHex: string }>;

// ルートの4フラグのうち、利用者に伝える側の値の文言
export const ROUTE_FLAG_LABEL = {
  isOutdoor: '屋外を通る',
  requiresExitGate: '改札外を通る',
  requiresStaff: '係員の対応が必要',
  // false のときに出す。isOfficiallyGuided は「駅の構内図・公式の案内に載っているルートか」
  notOfficiallyGuided: '駅の構内図・公式案内に載っていないルート',
} as const;
