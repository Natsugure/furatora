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

// 乗換接続の由来。初回シードで ekidata の station_g_cd から機械生成した行（'ekidata_group'）と、
// 管理者が手で追加した行（'manual'）を区別する。詳細は docs/domain/station-master-model.md
export type StationConnectionSource = 'ekidata_group' | 'manual';
