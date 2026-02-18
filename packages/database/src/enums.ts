export type StrollerDifficulty =
  | 'optimal'
  | 'elevator_detour'
  | 'stairs_partial'
  | 'exit_required'
  | 'inaccessible';

export type WheelchairDifficulty =
  | 'optimal'
  | 'detour'
  | 'assistance_required'
  | 'discouraged'
  | 'inaccessible';

export type DirectionType = 'inbound' | 'outbound';

export type PlatformSide = 'top' | 'bottom';
