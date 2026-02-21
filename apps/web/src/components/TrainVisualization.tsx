import Image from 'next/image';
import type { CarStopPosition, FreeSpace, PrioritySeat, CarStructure } from '@railease-navi/database/schema';

type Train = {
  id: string;
  name: string;
  carCount: number;
  carStructure: CarStructure[] | null;
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
};

type FacilityConnection = {
  stationName: string;
  lineNames: string[];
  exitLabel: string | null;
};

type Facility = {
  id: string;
  typeCode: string;
  typeName: string;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
};

type PlatformLocation = {
  id: string;
  nearPlatformCell: number | null;
  exits: string | null;
  facilities: Facility[];
  connections: FacilityConnection[];
};

type Props = {
  train: Train;
  platformMaxCarCount: number;
  carStopPositions: CarStopPosition[] | null;
  locations: PlatformLocation[];
  platformSide: 'top' | 'bottom' | null;
};

const FACILITY_ICONS: Record<string, string> = {
  elevator: '/icons/elevator.png',
  escalator: '/icons/escalator.png',
  stairs: '/icons/stairs.png',
  ramp: '/icons/wheelchair_ramp.png',
  stairLift: '/icons/stair_lift.png',
  sameFloor: '/icons/wheelchair.png',
};

// ドアバンド: 横レイアウト用（垂直ストライプ）
function HorizontalDoorBands({
  stdFreeDoors,
  nonStdFreeDoors,
  stdPrioDoors,
  nonStdPrioDoors,
  doorCount,
  reversed,
}: {
  stdFreeDoors: Set<number>;
  nonStdFreeDoors: Set<number>;
  stdPrioDoors: Set<number>;
  nonStdPrioDoors: Set<number>;
  doorCount: number;
  reversed: boolean;
}) {
  return (
    <>
      {Array.from({ length: doorCount }, (_, d) => {
        const doorNum = reversed ? doorCount - d : d + 1;
        const hasStdFree = stdFreeDoors.has(doorNum);
        const hasNonStdFree = nonStdFreeDoors.has(doorNum);
        const hasStdPrio = stdPrioDoors.has(doorNum);
        const hasNonStdPrio = nonStdPrioDoors.has(doorNum);
        const hasFree = hasStdFree || hasNonStdFree;
        const hasPrio = hasStdPrio || hasNonStdPrio;
        if (!hasFree && !hasPrio) return null;
        const split = hasFree && hasPrio;
        const freeBg = hasStdFree ? '#42A5F5' : '#BBDEFB';
        const freeLabel = hasStdFree ? 'F' : '(F)';
        const freeTextColor = hasStdFree ? 'white' : '#1565C0';
        const freeFontSize = split ? (hasStdFree ? 7 : 5) : (hasStdFree ? 8 : 6);
        const prioBg = hasStdPrio ? '#FFA726' : '#FFE0B2';
        const prioLabel = hasStdPrio ? '優' : '(優)';
        const prioTextColor = hasStdPrio ? 'white' : '#E65100';
        const prioFontSize = split ? (hasStdPrio ? 7 : 5) : (hasStdPrio ? 8 : 6);
        const leftPct = (d / doorCount) * 100;
        const widthPct = (1 / doorCount) * 100;
        return (
          <div
            key={doorNum}
            className="absolute top-0 bottom-0"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          >
            {split ? (
              <>
                <div
                  className="absolute left-0 right-0 top-0 bottom-1/2 flex items-center justify-center"
                  style={{ backgroundColor: freeBg }}
                >
                  <span className="font-bold leading-none" style={{ fontSize: freeFontSize, color: freeTextColor }}>{freeLabel}</span>
                </div>
                <div
                  className="absolute left-0 right-0 top-1/2 bottom-0 flex items-center justify-center"
                  style={{ backgroundColor: prioBg }}
                >
                  <span className="font-bold leading-none" style={{ fontSize: prioFontSize, color: prioTextColor }}>{prioLabel}</span>
                </div>
              </>
            ) : hasFree ? (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: freeBg }}>
                <span className="font-bold leading-none" style={{ fontSize: freeFontSize, color: freeTextColor }}>{freeLabel}</span>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: prioBg }}>
                <span className="font-bold leading-none" style={{ fontSize: prioFontSize, color: prioTextColor }}>{prioLabel}</span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ドアバンド: 縦レイアウト用（水平ストライプ）
function VerticalDoorBands({
  stdFreeDoors,
  nonStdFreeDoors,
  stdPrioDoors,
  nonStdPrioDoors,
  doorCount,
  reversed,
}: {
  stdFreeDoors: Set<number>;
  nonStdFreeDoors: Set<number>;
  stdPrioDoors: Set<number>;
  nonStdPrioDoors: Set<number>;
  doorCount: number;
  reversed: boolean;
}) {
  return (
    <>
      {Array.from({ length: doorCount }, (_, d) => {
        const doorNum = reversed ? doorCount - d : d + 1;
        const hasStdFree = stdFreeDoors.has(doorNum);
        const hasNonStdFree = nonStdFreeDoors.has(doorNum);
        const hasStdPrio = stdPrioDoors.has(doorNum);
        const hasNonStdPrio = nonStdPrioDoors.has(doorNum);
        const hasFree = hasStdFree || hasNonStdFree;
        const hasPrio = hasStdPrio || hasNonStdPrio;
        if (!hasFree && !hasPrio) return null;
        const split = hasFree && hasPrio;
        const freeBg = hasStdFree ? '#42A5F5' : '#BBDEFB';
        const freeLabel = hasStdFree ? 'F' : '(F)';
        const freeTextColor = hasStdFree ? 'white' : '#1565C0';
        const freeFontSize = split ? (hasStdFree ? 7 : 5) : (hasStdFree ? 8 : 6);
        const prioBg = hasStdPrio ? '#FFA726' : '#FFE0B2';
        const prioLabel = hasStdPrio ? '優' : '(優)';
        const prioTextColor = hasStdPrio ? 'white' : '#E65100';
        const prioFontSize = split ? (hasStdPrio ? 7 : 5) : (hasStdPrio ? 8 : 6);
        const topPct = (d / doorCount) * 100;
        const heightPct = (1 / doorCount) * 100;
        return (
          <div
            key={doorNum}
            className="absolute left-0 right-0"
            style={{ top: `${topPct}%`, height: `${heightPct}%` }}
          >
            {split ? (
              <>
                <div
                  className="absolute top-0 bottom-0 left-0 right-1/2 flex items-center justify-center"
                  style={{ backgroundColor: freeBg }}
                >
                  <span className="font-bold leading-none" style={{ fontSize: freeFontSize, color: freeTextColor }}>{freeLabel}</span>
                </div>
                <div
                  className="absolute top-0 bottom-0 left-1/2 right-0 flex items-center justify-center"
                  style={{ backgroundColor: prioBg }}
                >
                  <span className="font-bold leading-none" style={{ fontSize: prioFontSize, color: prioTextColor }}>{prioLabel}</span>
                </div>
              </>
            ) : hasFree ? (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: freeBg }}>
                <span className="font-bold leading-none" style={{ fontSize: freeFontSize, color: freeTextColor }}>{freeLabel}</span>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: prioBg }}>
                <span className="font-bold leading-none" style={{ fontSize: prioFontSize, color: prioTextColor }}>{prioLabel}</span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function TrainVisualization({
  train,
  platformMaxCarCount,
  carStopPositions,
  locations,
  platformSide,
}: Props) {
  // この列車の編成に対応する停車位置情報を取得
  const stopPosition = carStopPositions?.find(
    (pos) => pos.carCount === train.carCount
  );

  // 列車の各車両の位置を計算（platformMaxCarCount基準）
  const carPositions = Array.from({ length: train.carCount }, (_, i) => {
    if (!stopPosition) return i + 1;
    const { referenceCarNumber, referencePlatformCell, direction } = stopPosition;
    const carNumber = i + 1;
    return direction === 'ascending'
      ? referencePlatformCell + (carNumber - referenceCarNumber)
      : referencePlatformCell - (carNumber - referenceCarNumber);
  });

  // carStructure から号車ごとのドア数マップを構築
  const carStructureArray = train.carStructure ?? [];
  const doorCountByCarNumber = new Map(carStructureArray.map((cs) => [cs.carNumber, cs.doorCount]));
  const getDoorCount = (carNum: number) => doorCountByCarNumber.get(carNum) ?? 4;

  // 号車 → ドア番号セット (標準フリースペース: isStandard === true のみ)
  const stdFreeSpaceDoorsByCarNumber = new Map<number, Set<number>>();
  for (const fs of train.freeSpaces?.filter((f) => f.isStandard === true) ?? []) {
    if (!stdFreeSpaceDoorsByCarNumber.has(fs.carNumber)) stdFreeSpaceDoorsByCarNumber.set(fs.carNumber, new Set());
    stdFreeSpaceDoorsByCarNumber.get(fs.carNumber)!.add(fs.nearDoor);
  }

  // 号車 → ドア番号セット (一部編成のみのフリースペース: isStandard === false のみ)
  const nonStdFreeSpaceDoorsByCarNumber = new Map<number, Set<number>>();
  for (const fs of train.freeSpaces?.filter((f) => f.isStandard === false) ?? []) {
    if (!nonStdFreeSpaceDoorsByCarNumber.has(fs.carNumber)) nonStdFreeSpaceDoorsByCarNumber.set(fs.carNumber, new Set());
    nonStdFreeSpaceDoorsByCarNumber.get(fs.carNumber)!.add(fs.nearDoor);
  }

  // 号車 → ドア番号セット (標準優先席: isStandard === true)
  const stdPrioSeatDoorsByCarNumber = new Map<number, Set<number>>();
  for (const ps of train.prioritySeats?.filter((p) => p.isStandard === true) ?? []) {
    if (!stdPrioSeatDoorsByCarNumber.has(ps.carNumber)) stdPrioSeatDoorsByCarNumber.set(ps.carNumber, new Set());
    stdPrioSeatDoorsByCarNumber.get(ps.carNumber)!.add(ps.nearDoor);
  }

  // 号車 → ドア番号セット (一部編成のみの優先席: isStandard === false のみ)
  const nonStdPrioSeatDoorsByCarNumber = new Map<number, Set<number>>();
  for (const ps of train.prioritySeats?.filter((p) => p.isStandard === false) ?? []) {
    if (!nonStdPrioSeatDoorsByCarNumber.has(ps.carNumber)) nonStdPrioSeatDoorsByCarNumber.set(ps.carNumber, new Set());
    nonStdPrioSeatDoorsByCarNumber.get(ps.carNumber)!.add(ps.nearDoor);
  }

  // ホーム全体の長さ（maxCarCount基準）
  const platformCells = Array.from({ length: platformMaxCarCount }, (_, i) => i + 1);

  // ホーム枠番号 → 場所リスト のマップ
  const locationsByCell: Record<number, PlatformLocation[]> = {};
  for (const location of locations) {
    if (location.nearPlatformCell !== null) {
      const cell = location.nearPlatformCell;
      if (cell >= 1 && cell <= platformMaxCarCount) {
        if (!locationsByCell[cell]) locationsByCell[cell] = [];
        locationsByCell[cell].push(location);
      }
    }
  }

  // 占有セルを昇順に並べた配列（左→右の視覚順）
  const occupiedCells = [...carPositions].sort((a, b) => a - b);

  const direction = stopPosition?.direction ?? 'ascending';
  const effectivePlatformSide = platformSide ?? 'bottom';

  const leadingCarClipPath =
    direction === 'ascending'
      ? 'polygon(15% 0%, 100% 0%, 100% 100%, 15% 100%, 0% 50%)'
      : 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)';

  const verticalLeadingCarClipPath =
    direction === 'ascending'
      ? 'polygon(0% 20%, 50% 0%, 100% 20%, 100% 100%, 0% 100%)'
      : 'polygon(0% 0%, 100% 0%, 100% 80%, 50% 100%, 0% 80%)';

  const facilityLabelRow = (
    <div className="flex gap-1 py-0.5 min-h-8">
      {platformCells.map((cellNumber) => {
        const cellLocations = locationsByCell[cellNumber] ?? [];
        const labels: string[] = [];
        for (const loc of cellLocations) {
          if (loc.exits) labels.push(loc.exits);
          for (const conn of loc.connections) {
            if (conn.lineNames.length > 0) labels.push(conn.lineNames.join('・'));
          }
        }
        return (
          <div
            key={cellNumber}
            className={`flex-1 flex flex-col items-center gap-px text-[9px] leading-tight text-gray-500 ${effectivePlatformSide === 'top' ? 'justify-end' : 'justify-start'}`}
          >
            {labels.map((label, i) => (
              <span key={i} className="break-all">{label}</span>
            ))}
          </div>
        );
      })}
    </div>
  );

  const platformStrip = (
    <div className="relative h-15 bg-stone-200">
      {platformCells.map((cellNumber) => {
        const cellLocations = locationsByCell[cellNumber] ?? [];
        if (cellLocations.length === 0) return null;
        const leftPercent = ((cellNumber - 0.5) / platformMaxCarCount) * 100;
        return (
          <div
            key={cellNumber}
            className="absolute top-0 bottom-0 flex items-center gap-0.5 -translate-x-1/2"
            style={{ left: `${leftPercent}%` }}
          >
            {cellLocations.flatMap((loc) =>
              loc.facilities.map((f, idx) =>
                FACILITY_ICONS[f.typeCode] ? (
                  <Image
                    key={`${loc.id}-${idx}`}
                    src={FACILITY_ICONS[f.typeCode]}
                    alt={f.typeName}
                    title={loc.exits || f.typeName}
                    width={24}
                    height={24}
                    className="w-6 h-6"
                  />
                ) : (
                  <span key={`${loc.id}-${idx}`} title={loc.exits || f.typeName} className="text-sm leading-none">📍</span>
                )
              )
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      {/* 列車名 */}
      <div className="mb-3">
        <h5 className="font-semibold text-gray-900 text-sm">{train.name}</h5>
        <p className="text-xs text-gray-500">{train.carCount}両編成</p>
      </div>

      {/* ホーム + 列車の可視化 */}
      <div className="mb-2">
        {/* 縦レイアウト（モバイル: md未満） */}
        <div className="md:hidden flex flex-col gap-0.5">
          {platformCells.map((cellNumber) => {
            const isTrainCar = carPositions.includes(cellNumber);
            const displayCarNumber = isTrainCar ? occupiedCells.indexOf(cellNumber) + 1 : null;
            const physicalCarNumber = isTrainCar ? carPositions.indexOf(cellNumber) + 1 : null;
            const isLeadingCar = isTrainCar && cellNumber === carPositions[0];
            const cellLocations = locationsByCell[cellNumber] ?? [];
            const labels: string[] = [];
            for (const loc of cellLocations) {
              if (loc.exits) labels.push(loc.exits);
              for (const conn of loc.connections) {
                if (conn.lineNames.length > 0) labels.push(conn.lineNames.join('・'));
              }
            }

            const stdFreeDoors = physicalCarNumber ? (stdFreeSpaceDoorsByCarNumber.get(physicalCarNumber) ?? new Set<number>()) : new Set<number>();
            const nonStdFreeDoors = physicalCarNumber ? (nonStdFreeSpaceDoorsByCarNumber.get(physicalCarNumber) ?? new Set<number>()) : new Set<number>();
            const stdPrioDoors = physicalCarNumber ? (stdPrioSeatDoorsByCarNumber.get(physicalCarNumber) ?? new Set<number>()) : new Set<number>();
            const nonStdPrioDoors = physicalCarNumber ? (nonStdPrioSeatDoorsByCarNumber.get(physicalCarNumber) ?? new Set<number>()) : new Set<number>();
            const doorCount = physicalCarNumber ? getDoorCount(physicalCarNumber) : 4;

            const carCell = (
              <div
                className="w-12 flex-shrink-0 h-36 border border-gray-300 relative overflow-hidden"
                style={{
                  backgroundColor: isTrainCar ? '#d1d5db' : '#f9fafb',
                  clipPath: isLeadingCar ? verticalLeadingCarClipPath : undefined,
                  borderRadius: isLeadingCar ? 0 : undefined,
                }}
              >
                {isTrainCar && physicalCarNumber && (
                  <VerticalDoorBands
                    stdFreeDoors={stdFreeDoors}
                    nonStdFreeDoors={nonStdFreeDoors}
                    stdPrioDoors={stdPrioDoors}
                    nonStdPrioDoors={nonStdPrioDoors}
                    doorCount={doorCount}
                    reversed={direction === 'descending'}
                  />
                )}
                {isTrainCar && displayCarNumber && (
                  <div className="absolute inset-0 flex items-end justify-center pb-1 z-10 pointer-events-none">
                    <span className="font-bold text-sm text-gray-800 bg-white/60 px-0.5 rounded-sm leading-none">
                      {displayCarNumber}
                    </span>
                  </div>
                )}
              </div>
            );

            const stripCell = (
              <div className="w-16 flex-shrink-0 h-36 bg-stone-200 flex flex-col items-center justify-center gap-1">
                {cellLocations.flatMap((loc) =>
                  loc.facilities.map((f, idx) =>
                    FACILITY_ICONS[f.typeCode] ? (
                      <Image key={`${loc.id}-${idx}`} src={FACILITY_ICONS[f.typeCode]} alt={f.typeName} title={loc.exits || f.typeName} width={28} height={28} className="w-7 h-7" />
                    ) : (
                      <span key={`${loc.id}-${idx}`} className="text-base leading-none">📍</span>
                    )
                  )
                )}
              </div>
            );

            const labelCell = (
              <div className={`flex-1 min-w-0 flex flex-col justify-center gap-1.5 text-xs leading-snug text-gray-600 px-2 py-1 ${effectivePlatformSide === 'top' ? 'items-end text-right' : 'items-start'}`}>
                {labels.map((label, i) => (
                  <span key={i} className="break-words">{label}</span>
                ))}
              </div>
            );

            return (
              <div key={cellNumber} className="flex items-stretch gap-0.5">
                {effectivePlatformSide === 'top' ? (
                  <>{labelCell}{stripCell}{carCell}</>
                ) : (
                  <>{carCell}{stripCell}{labelCell}</>
                )}
              </div>
            );
          })}
        </div>

        {/* 横レイアウト（デスクトップ: md以上） */}
        <div className="hidden md:block">
          {effectivePlatformSide === 'top' && (
            <>
              {facilityLabelRow}
              {platformStrip}
            </>
          )}

          <div className="flex items-center gap-1 my-1">
            {platformCells.map((cellNumber) => {
              const isTrainCar = carPositions.includes(cellNumber);
              const displayCarNumber = isTrainCar ? occupiedCells.indexOf(cellNumber) + 1 : null;
              const physicalCarNumber = isTrainCar ? carPositions.indexOf(cellNumber) + 1 : null;
              const isLeadingCar = isTrainCar && cellNumber === carPositions[0];

              const stdFreeDoors = physicalCarNumber ? (stdFreeSpaceDoorsByCarNumber.get(physicalCarNumber) ?? new Set<number>()) : new Set<number>();
              const nonStdFreeDoors = physicalCarNumber ? (nonStdFreeSpaceDoorsByCarNumber.get(physicalCarNumber) ?? new Set<number>()) : new Set<number>();
              const stdPrioDoors = physicalCarNumber ? (stdPrioSeatDoorsByCarNumber.get(physicalCarNumber) ?? new Set<number>()) : new Set<number>();
              const nonStdPrioDoors = physicalCarNumber ? (nonStdPrioSeatDoorsByCarNumber.get(physicalCarNumber) ?? new Set<number>()) : new Set<number>();
              const doorCount = physicalCarNumber ? getDoorCount(physicalCarNumber) : 4;

              return (
                <div
                  key={cellNumber}
                  className="relative flex-1 h-12 border border-gray-300 overflow-hidden"
                  style={{
                    backgroundColor: isTrainCar ? '#d1d5db' : '#f9fafb',
                    clipPath: isLeadingCar && isTrainCar ? leadingCarClipPath : undefined,
                    borderRadius: isLeadingCar && isTrainCar ? 0 : undefined,
                  }}
                >
                  {isTrainCar && physicalCarNumber && (
                    <HorizontalDoorBands
                      stdFreeDoors={stdFreeDoors}
                      nonStdFreeDoors={nonStdFreeDoors}
                      stdPrioDoors={stdPrioDoors}
                      nonStdPrioDoors={nonStdPrioDoors}
                      doorCount={doorCount}
                      reversed={direction === 'descending'}
                    />
                  )}
                  {isTrainCar && displayCarNumber && (
                    <div className="absolute inset-0 flex items-end justify-center pb-0.5 z-10 pointer-events-none">
                      <span className="font-bold text-xs text-gray-800 bg-white/60 px-0.5 rounded-sm leading-none">
                        {displayCarNumber}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {effectivePlatformSide === 'bottom' && (
            <>
              {platformStrip}
              {facilityLabelRow}
            </>
          )}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: '#42A5F5' }} />
          <span>F = フリースペース</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: '#BBDEFB' }} />
          <span>(F) = フリースペース(一部編成)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: '#FFA726' }} />
          <span>優 = 優先席</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: '#FFE0B2' }} />
          <span>(優) = 優先席(一部編成)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-stone-300" />
          <span>ホーム</span>
        </div>
      </div>

      {/* フリースペース詳細 */}
      {train.freeSpaces && train.freeSpaces.length > 0 && (
        <div className="mt-3 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs">
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
        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-xs">
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
