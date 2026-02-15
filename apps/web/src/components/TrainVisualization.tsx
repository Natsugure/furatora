import type { CarStopPosition, FreeSpace, PrioritySeat } from '@stroller-transit-app/database/schema';

type Train = {
  id: string;
  name: string;
  carCount: number;
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
};

type Facility = {
  id: string;
  typeCode: string;
  typeName: string;
  nearPlatformCell: number | null;
  exits: string | null;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
};

type Props = {
  train: Train;
  platformMaxCarCount: number;
  carStopPositions: CarStopPosition[] | null;
  facilities: Facility[];
  platformSide: 'top' | 'bottom' | null;
};

const FACILITY_ICONS: Record<string, string> = {
  elevator: '🛗',
  escalator: '⚡',
  stairs: '🚶',
  ramp: '♿',
  stairLift: '🦽',
  sameFloor: '↔️',
};

export function TrainVisualization({
  train,
  platformMaxCarCount,
  carStopPositions,
  facilities,
  platformSide,
}: Props) {
  // この列車の編成に対応する停車位置情報を取得
  const stopPosition = carStopPositions?.find(
    (pos) => pos.carCount === train.carCount
  );

  // 列車の各車両の位置を計算（platformMaxCarCount基準）
  // carPositions[i] = 号車番号(i+1)が停車するホーム枠番号
  const carPositions = Array.from({ length: train.carCount }, (_, i) => {
    if (!stopPosition) {
      return i + 1;
    }
    const { referenceCarNumber, referencePlatformCell, direction } = stopPosition;
    const carNumber = i + 1;
    if (direction === 'ascending') {
      return referencePlatformCell + (carNumber - referenceCarNumber);
    } else {
      return referencePlatformCell - (carNumber - referenceCarNumber);
    }
  });

  // フリースペースの位置をセット化（標準装備のみ）
  const freeSpacePositions = new Set(
    train.freeSpaces?.filter((fs) => fs.isStandard).map((fs) => fs.carNumber) || []
  );

  // 優先席の位置をセット化
  const prioritySeatPositions = new Set(
    train.prioritySeats?.map((ps) => ps.carNumber) || []
  );

  // ホーム全体の長さ（maxCarCount基準）
  const platformCells = Array.from({ length: platformMaxCarCount }, (_, i) => i + 1);

  // ホーム枠番号 → 設備リスト のマップを構築
  // nearPlatformCell はホーム枠番号を直接指定する
  const facilitiesByCell: Record<number, Facility[]> = {};
  for (const facility of facilities) {
    if (facility.nearPlatformCell !== null) {
      const cell = facility.nearPlatformCell;
      if (cell >= 1 && cell <= platformMaxCarCount) {
        if (!facilitiesByCell[cell]) facilitiesByCell[cell] = [];
        facilitiesByCell[cell].push(facility);
      }
    }
  }

  // 占有セルを昇順に並べた配列（左→右の視覚順）
  const occupiedCells = [...carPositions].sort((a, b) => a - b);

  const direction = stopPosition?.direction ?? 'ascending';
  const effectivePlatformSide = platformSide ?? 'bottom';

  // 先頭車両(1号車)のclip-path: ascending=左向き台形, descending=右向き台形
  const leadingCarClipPath =
    direction === 'ascending'
      ? 'polygon(15% 0%, 100% 0%, 100% 100%, 15% 100%, 0% 50%)'
      : 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)';

  // ホームの帯（設備アイコン付き）
  // セル区切りは表示せず、1本の帯としてレンダリング。
  // 設備アイコンはセル中央 ((cellNumber - 0.5) / platformMaxCarCount * 100%) に絶対配置。
  const platformStrip = (
    <div className="relative h-15 bg-stone-200">
      {platformCells.map((cellNumber) => {
        const cellFacilities = facilitiesByCell[cellNumber] ?? [];
        if (cellFacilities.length === 0) return null;
        const leftPercent = ((cellNumber - 0.5) / platformMaxCarCount) * 100;
        return (
          <div
            key={cellNumber}
            className="absolute top-0 bottom-0 flex items-center gap-0.5 -translate-x-1/2"
            style={{ left: `${leftPercent}%` }}
          >
            {cellFacilities.map((f, idx) => (
              <span
                key={idx}
                title={f.exits || f.typeName}
                className="text-sm leading-none"
              >
                {FACILITY_ICONS[f.typeCode] ?? '📍'}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="border border-gray-300 rounded p-4 bg-gray-50">
      {/* 列車名 */}
      <div className="mb-3">
        <h5 className="font-semibold text-gray-800">{train.name}</h5>
        <p className="text-xs text-gray-600">{train.carCount}両編成</p>
      </div>

      {/* ホーム + 列車の可視化 */}
      <div className="mb-2">
        {/* ホーム帯 — 上側 */}
        {effectivePlatformSide === 'top' && platformStrip}

        {/* 列車の車両列 */}
        <div className="flex items-center gap-1 my-1">
          {platformCells.map((cellNumber) => {
            const isTrainCar = carPositions.includes(cellNumber);
            // 表示用号車番号: 常に左から1,2,...,N
            const displayCarNumber = isTrainCar ? occupiedCells.indexOf(cellNumber) + 1 : null;
            // 実際の号車番号: フリースペース・優先席の判定に使用
            const physicalCarNumber = isTrainCar ? carPositions.indexOf(cellNumber) + 1 : null;
            const hasFreeSpace = physicalCarNumber
              ? freeSpacePositions.has(physicalCarNumber)
              : false;
            const hasPrioritySeat = physicalCarNumber
              ? prioritySeatPositions.has(physicalCarNumber)
              : false;
            // 先頭車両: carPositions[0] が物理的な1号車の停車枠
            const isLeadingCar = isTrainCar && cellNumber === carPositions[0];

            const bgColor = isTrainCar
              ? hasFreeSpace
                ? '#bfdbfe' // blue-200
                : hasPrioritySeat
                  ? '#fde68a' // amber-200
                  : '#d1d5db' // gray-300
              : '#f9fafb'; // gray-50

            return (
              <div
                key={cellNumber}
                className="relative flex-1 h-12 border border-gray-300 flex items-center justify-center text-xs font-mono"
                style={{
                  backgroundColor: bgColor,
                  clipPath: isLeadingCar && isTrainCar ? leadingCarClipPath : undefined,
                  borderRadius: isLeadingCar && isTrainCar ? 0 : undefined,
                }}
              >
                {isTrainCar && displayCarNumber && (
                  <div className="text-center">
                    <div className="font-bold">{displayCarNumber}</div>
                    {hasFreeSpace && (
                      <div className="text-[10px] text-blue-700">🚼</div>
                    )}
                    {!hasFreeSpace && hasPrioritySeat && (
                      <div className="text-[10px] text-amber-700">🪑</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ホーム帯 — 下側 */}
        {effectivePlatformSide === 'bottom' && platformStrip}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600 mt-3">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-300 border border-gray-300 rounded" />
          <span>列車</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-200 border border-gray-300 rounded" />
          <span>フリースペース</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-amber-200 border border-gray-300 rounded" />
          <span>優先席</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-stone-300 border border-stone-500" />
          <span>ホーム設備</span>
        </div>
      </div>

      {/* フリースペース詳細 */}
      {train.freeSpaces && train.freeSpaces.length > 0 && (
        <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
          <strong className="text-blue-900">フリースペース詳細:</strong>
          <ul className="mt-1 space-y-0.5">
            {train.freeSpaces.map((fs, idx) => (
              <li key={idx} className="text-blue-800">
                {fs.carNumber}号車 {fs.nearDoor}番ドア付近
                {fs.isStandard ? ' (全編成装備)' : ' (一部編成のみ)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 優先席詳細 */}
      {train.prioritySeats && train.prioritySeats.length > 0 && (
        <div className="mt-2 p-2 bg-amber-50 rounded text-xs">
          <strong className="text-amber-900">優先席:</strong>
          <ul className="mt-1 space-y-0.5">
            {train.prioritySeats.map((ps, idx) => (
              <li key={idx} className="text-amber-800">
                {ps.carNumber}号車 {ps.nearDoor}番ドア付近
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
