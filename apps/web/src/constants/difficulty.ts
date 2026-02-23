import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';

type DifficultyMeta = {
  order: number;
  label: string;
  iconPath: string;
  iconColorHex: string;
};

export const STROLLER_DIFFICULTY_META = {
  optimal: {
    order: 1,
    label: '合理的なエレベータールートがある',
    iconPath: '/icons/double_circle.svg',
    iconColorHex: '#7CB342',
  },
  elevator_detour: {
    order: 2,
    label: '一般ユーザーより不便だが、エレベータールートは整備されている',
    iconPath: '/icons/circle.svg',
    iconColorHex: '#1E88E5',
  },
  stairs_partial: {
    order: 3,
    label: '途中に短い階段を含むルートを通る必要がある',
    iconPath: '/icons/triangle.svg',
    iconColorHex: '#FF8F00',
  },
  exit_required: {
    order: 4,
    label: 'エレベーターのみの乗り換えには改札外・地上経由が必要',
    iconPath: '/icons/asterisk.svg',
    iconColorHex: '#FF8F00',
  },
  inaccessible: {
    order: 5,
    label: 'エレベータールートが整備されていない',
    iconPath: '/icons/cross.svg',
    iconColorHex: '#E53935',
  },
} as const satisfies Record<StrollerDifficulty, DifficultyMeta>;

export const WHEELCHAIR_DIFFICULTY_META = {
  optimal: {
    order: 1,
    label: '合理的なバリアフリールートがある',
    iconPath: '/icons/double_circle.svg',
    iconColorHex: '#7CB342',
  },
  detour: {
    order: 2,
    label: '一般ユーザーより不便だが、合理的な範囲でバリアフリールートが整備されている',
    iconPath: '/icons/circle.svg',
    iconColorHex: '#1E88E5',
  },
  assistance_required: {
    order: 3,
    label: '途中に駅員による介助が必要な箇所がある',
    iconPath: '/icons/triangle.svg',
    iconColorHex: '#FF8F00',
  },
  discouraged: {
    order: 4,
    label: '車いすでの乗り換えは可能だが、非合理的で推奨できない',
    iconPath: '/icons/asterisk.svg',
    iconColorHex: '#FF8F00',
  },
  inaccessible: {
    order: 5,
    label: 'バリアフリールートが全く整備されていない',
    iconPath: '/icons/cross.svg',
    iconColorHex: '#E53935',
  },
} as const satisfies Record<WheelchairDifficulty, DifficultyMeta>;
