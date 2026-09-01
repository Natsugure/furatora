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

// 乗換接続の由来。ekidata の station_g_cd から機械生成した行と、
// 手動で追加した行を区別する（インポートは 'manual' の行に触れない）
export type StationConnectionSource = 'ekidata_group' | 'manual';
