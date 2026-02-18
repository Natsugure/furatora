import type { StrollerDifficulty, WheelchairDifficulty } from '@stroller-transit-app/database/enums';

export const STROLLER_DIFFICULTY_META: Record<StrollerDifficulty, { order: number; label: string }> = {
  optimal:          { order: 1, label: '合理的なエレベーターのみルートがある' },
  elevator_detour:  { order: 2, label: '一般ユーザーより不便だが、エレベーターのみルートは整備されている' },
  stairs_partial:   { order: 3, label: '途中に短い階段を含むルートを通る必要がある' },
  exit_required:    { order: 4, label: 'エレベーターのみの乗り換えには改札外・地上経由が必要' },
  inaccessible:     { order: 5, label: 'エレベーターのみルートが整備されていない' },
};

export const WHEELCHAIR_DIFFICULTY_META: Record<WheelchairDifficulty, { order: number; label: string }> = {
  optimal:             { order: 1, label: '合理的なバリアフリールートがある' },
  detour:              { order: 2, label: '一般ユーザーより不便だが、合理的な範囲でバリアフリールートが整備されている' },
  assistance_required: { order: 3, label: '途中に駅員による介助が必要な箇所がある' },
  discouraged:         { order: 4, label: '車いすでの乗り換えは可能だが、非合理的で推奨できない' },
  inaccessible:        { order: 5, label: 'バリアフリールートが全く整備されていない' },
};
