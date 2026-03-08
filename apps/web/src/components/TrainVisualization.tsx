import Image from 'next/image';
import type { CarStopPosition, FreeSpace, PrioritySeat, CarStructure } from '@furatora/database/schema';

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
  lineColors: (string | null)[];
  directionName: string | null;
  exitLabel: string | null;
};

type Facility = {
  id: string;
  typeCode: string;
  typeName: string;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
};

type PlatformLocationCell = {
  nearPlatformCell: number | null;
  facilities: Facility[];
};

type PlatformLocation = {
  id: string;
  exits: string | null;
  cells: PlatformLocationCell[];
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

// 対面乗り換えかどうかを判定
function isSameFloorLocation(loc: PlatformLocation): boolean {
  return loc.cells.some(cell => cell.facilities.some(f => f.typeCode === 'sameFloor'));
}

// 横レイアウト用: 対面乗り換えラベルを列車の反対側に表示
function HorizontalSameFloorLabels({
  sameFloorLocations,
  platformMaxCarCount,
  side,
}: {
  sameFloorLocations: PlatformLocation[];
  platformMaxCarCount: number;
  side: 'top' | 'bottom';
}) {
  const SECTION_HEIGHT = 52;

  const activeLocations = sameFloorLocations
    .map(loc => {
      const cellNums = loc.cells
        .filter(c => c.facilities.some(f => f.typeCode === 'sameFloor'))
        .map(c => c.nearPlatformCell)
        .filter((n): n is number => n !== null && n >= 1 && n <= platformMaxCarCount);
      const labels = loc.connections.map(conn => ({
        text: [
          conn.lineNames.join('・'),
          conn.directionName ? `${conn.directionName}` : '',
          '（対面乗り換え）',
        ].filter(Boolean).join(''),
        color: conn.lineColors[0] ?? '#9ca3af',
      }));
      return { id: loc.id, cellNums, labels };
    })
    .filter(loc => loc.cellNums.length > 0 && loc.labels.length > 0);

  if (activeLocations.length === 0) return null;

  const cellXPct = (cellNum: number) =>
    ((cellNum - 0.5) / platformMaxCarCount) * 100;

  const stripEdgeY = side === 'bottom' ? 0 : SECTION_HEIGHT;
  // ボックスはストリップに近い側（外側ラベルとの間に配置されるため、ストリップ側に寄せる）
  const boxApproxCenterY = side === 'bottom' ? SECTION_HEIGHT * 0.3 : SECTION_HEIGHT * 0.7;
  const boxCSSEdge = side === 'bottom' ? { top: '4px' } : { bottom: '4px' };

  return (
    <div className="relative" style={{ height: `${SECTION_HEIGHT}px` }}>
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: `${SECTION_HEIGHT}px` }}
      >
        {activeLocations.flatMap(loc => {
          const avgCell = loc.cellNums.reduce((s, c) => s + c, 0) / loc.cellNums.length;
          const boxXPct = cellXPct(avgCell);
          const strokeColor = loc.labels[0]?.color ?? '#9ca3af';
          return loc.cellNums.map(cellNum => (
            <line
              key={`${loc.id}-${cellNum}`}
              x1={`${boxXPct}%`}
              y1={boxApproxCenterY}
              x2={`${cellXPct(cellNum)}%`}
              y2={stripEdgeY}
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          ));
        })}
      </svg>
      {activeLocations.map(loc => {
        const avgCell = loc.cellNums.reduce((s, c) => s + c, 0) / loc.cellNums.length;
        return (
          <div
            key={loc.id}
            className="absolute -translate-x-1/2 z-10 flex flex-col items-center gap-0.5"
            style={{ left: `${cellXPct(avgCell)}%`, ...boxCSSEdge }}
          >
            {loc.labels.map((label, i) => (
              <div
                key={i}
                className="rounded px-1.5 py-0.5 text-[9px] font-medium leading-tight whitespace-nowrap text-white text-center"
                style={{ backgroundColor: label.color }}
              >
                {label.text}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// 縦レイアウト用: 対面乗り換えラベルを列車の反対側に表示
function VerticalSameFloorLabels({
  sameFloorLocations,
  platformMaxCarCount,
  platformCells,
  side,
}: {
  sameFloorLocations: PlatformLocation[];
  platformMaxCarCount: number;
  platformCells: number[];
  side: 'top' | 'bottom';
}) {
  const ROW_HEIGHT = 144;
  const GAP = 2;

  const activeLocations = sameFloorLocations
    .map(loc => {
      const cellNums = loc.cells
        .filter(c => c.facilities.some(f => f.typeCode === 'sameFloor'))
        .map(c => c.nearPlatformCell)
        .filter((n): n is number => n !== null && n >= 1 && n <= platformMaxCarCount);
      const labels = loc.connections.map(conn => ({
        text: [
          conn.lineNames.join('・'),
          conn.directionName ? `${conn.directionName}` : '',
          '（対面乗り換え）',
        ].filter(Boolean).join(''),
        color: conn.lineColors[0] ?? '#9ca3af',
      }));
      return { id: loc.id, cellNums, labels };
    })
    .filter(loc => loc.cellNums.length > 0 && loc.labels.length > 0);

  if (activeLocations.length === 0) return null;

  const totalHeight = platformCells.length * ROW_HEIGHT + Math.max(0, platformCells.length - 1) * GAP;

  const cellCenterY = (cellNum: number) => {
    const idx = platformCells.indexOf(cellNum);
    if (idx === -1) return 0;
    return idx * (ROW_HEIGHT + GAP) + ROW_HEIGHT / 2;
  };

  // top (ラベル列が左): ストリップは右端, bottom (ラベル列が右): ストリップは左端
  const stripEdgeX = side === 'top' ? '100%' : '0%';
  // ボックスはストリップに近い側に配置（外側ラベルとの間に配置されるため）
  const boxAnchorXPct = side === 'top' ? 70 : 30;
  const boxCSSEdge = side === 'top' ? { right: '4px' } : { left: '4px' };

  return (
    <div className="flex-1 relative" style={{ height: totalHeight, minWidth: '80px' }}>
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: totalHeight }}
      >
        {activeLocations.flatMap(loc => {
          const avgY = loc.cellNums.reduce((s, c) => s + cellCenterY(c), 0) / loc.cellNums.length;
          const strokeColor = loc.labels[0]?.color ?? '#9ca3af';
          return loc.cellNums.map(cellNum => (
            <line
              key={`${loc.id}-${cellNum}`}
              x1={`${boxAnchorXPct}%`}
              y1={avgY}
              x2={stripEdgeX}
              y2={cellCenterY(cellNum)}
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          ));
        })}
      </svg>
      {activeLocations.map(loc => {
        const avgY = loc.cellNums.reduce((s, c) => s + cellCenterY(c), 0) / loc.cellNums.length;
        return (
          <div
            key={loc.id}
            className="absolute -translate-y-1/2 z-10 flex flex-col gap-0.5"
            style={{ top: avgY, ...boxCSSEdge }}
          >
            {loc.labels.map((label, i) => (
              <div
                key={i}
                className="rounded px-1.5 py-0.5 text-[9px] font-medium leading-tight text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.text}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// 横レイアウト用: 施設ラベルをPlatformLocation単位でまとめて表示
function HorizontalFacilityLabels({
  locations,
  platformMaxCarCount,
  side,
}: {
  locations: PlatformLocation[];
  platformMaxCarCount: number;
  side: 'top' | 'bottom';
}) {
  const SECTION_HEIGHT = 60;

  const activeLocations = locations
    .map(loc => {
      const cellNums = loc.cells
        .map(c => c.nearPlatformCell)
        .filter((n): n is number => n !== null && n >= 1 && n <= platformMaxCarCount);
      const labels: string[] = [];
      if (loc.exits) labels.push(loc.exits);
      for (const conn of loc.connections) {
        if (conn.lineNames.length > 0) labels.push(conn.lineNames.join('・'));
      }
      return { id: loc.id, cellNums, labels };
    })
    .filter(loc => loc.cellNums.length > 0 && loc.labels.length > 0);

  if (activeLocations.length === 0) return <div className="py-1" />;

  const cellXPct = (cellNum: number) =>
    ((cellNum - 0.5) / platformMaxCarCount) * 100;

  // bottom: ストリップはラベルセクションの上端(y=0)
  // top: ストリップはラベルセクションの下端(y=SECTION_HEIGHT)
  const stripEdgeY = side === 'bottom' ? 0 : SECTION_HEIGHT;
  const boxApproxCenterY = side === 'bottom' ? SECTION_HEIGHT * 0.75 : SECTION_HEIGHT * 0.25;
  const boxCSSEdge = side === 'bottom'
    ? { bottom: '4px' }
    : { top: '4px' };

  return (
    <div className="relative" style={{ height: `${SECTION_HEIGHT}px` }}>
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: `${SECTION_HEIGHT}px` }}
      >
        {activeLocations.flatMap(loc => {
          const avgCell = loc.cellNums.reduce((s, c) => s + c, 0) / loc.cellNums.length;
          const boxXPct = cellXPct(avgCell);
          return loc.cellNums.map(cellNum => (
            <line
              key={`${loc.id}-${cellNum}`}
              x1={`${boxXPct}%`}
              y1={boxApproxCenterY}
              x2={`${cellXPct(cellNum)}%`}
              y2={stripEdgeY}
              stroke="#9ca3af"
              strokeWidth="1"
            />
          ));
        })}
      </svg>
      {activeLocations.map(loc => {
        const avgCell = loc.cellNums.reduce((s, c) => s + c, 0) / loc.cellNums.length;
        return (
          <div
            key={loc.id}
            className="absolute -translate-x-1/2 border border-gray-400 rounded px-1.5 py-0.5 bg-white text-[9px] leading-tight text-gray-600 z-10 text-center"
            style={{ left: `${cellXPct(avgCell)}%`, ...boxCSSEdge }}
          >
            {loc.labels.map((label, i) => (
              <div key={i} className="whitespace-nowrap">{label}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// 縦レイアウト用: 施設ラベルをPlatformLocation単位でまとめて表示
function VerticalFacilityLabels({
  locations,
  platformMaxCarCount,
  platformCells,
  side,
}: {
  locations: PlatformLocation[];
  platformMaxCarCount: number;
  platformCells: number[];
  side: 'top' | 'bottom'; // 'top' = ラベル列が左側, 'bottom' = ラベル列が右側
}) {
  const ROW_HEIGHT = 144; // h-36 = 144px
  const GAP = 2; // gap-0.5 = 2px

  const activeLocations = locations
    .map(loc => {
      const cellNums = loc.cells
        .map(c => c.nearPlatformCell)
        .filter((n): n is number => n !== null && n >= 1 && n <= platformMaxCarCount);
      const labels: string[] = [];
      if (loc.exits) labels.push(loc.exits);
      for (const conn of loc.connections) {
        if (conn.lineNames.length > 0) labels.push(conn.lineNames.join('・'));
      }
      return { id: loc.id, cellNums, labels };
    })
    .filter(loc => loc.cellNums.length > 0 && loc.labels.length > 0);

  if (activeLocations.length === 0) return <div className="w-16 flex-shrink-0" />;

  const totalHeight = platformCells.length * ROW_HEIGHT + Math.max(0, platformCells.length - 1) * GAP;

  const cellCenterY = (cellNum: number) => {
    const idx = platformCells.indexOf(cellNum);
    if (idx === -1) return 0;
    return idx * (ROW_HEIGHT + GAP) + ROW_HEIGHT / 2;
  };

  // top (ラベル列が左): ストリップは右端 → x="100%"
  // bottom (ラベル列が右): ストリップは左端 → x="0%"
  const stripEdgeX = side === 'top' ? '100%' : '0%';
  const boxAnchorXPct = side === 'top' ? 30 : 70;
  const boxCSSEdge = side === 'top' ? { left: '4px' } : { right: '4px' };

  return (
    <div className="flex-1 relative" style={{ height: totalHeight, minWidth: '80px' }}>
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: totalHeight }}
      >
        {activeLocations.flatMap(loc => {
          const avgY = loc.cellNums.reduce((s, c) => s + cellCenterY(c), 0) / loc.cellNums.length;
          return loc.cellNums.map(cellNum => (
            <line
              key={`${loc.id}-${cellNum}`}
              x1={`${boxAnchorXPct}%`}
              y1={avgY}
              x2={stripEdgeX}
              y2={cellCenterY(cellNum)}
              stroke="#9ca3af"
              strokeWidth="1"
            />
          ));
        })}
      </svg>
      {activeLocations.map(loc => {
        const avgY = loc.cellNums.reduce((s, c) => s + cellCenterY(c), 0) / loc.cellNums.length;
        return (
          <div
            key={loc.id}
            className="absolute -translate-y-1/2 border border-gray-400 rounded px-1.5 py-0.5 bg-white text-[9px] leading-tight text-gray-600 z-10"
            style={{ top: avgY, ...boxCSSEdge }}
          >
            {loc.labels.map((label, i) => (
              <div key={i} className="break-words">{label}</div>
            ))}
          </div>
        );
      })}
    </div>
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

  // 対面乗り換えと通常施設の分離
  const sameFloorLocations = locations.filter(isSameFloorLocation);
  const regularLocations = locations.filter(loc => !isSameFloorLocation(loc));

  // セル番号 → 対面乗り換えロケーションのマップ
  const sameFloorCellMap = new Map<number, PlatformLocation[]>();
  for (const loc of sameFloorLocations) {
    for (const cell of loc.cells) {
      if (cell.nearPlatformCell !== null && cell.facilities.some(f => f.typeCode === 'sameFloor')) {
        const existing = sameFloorCellMap.get(cell.nearPlatformCell) ?? [];
        sameFloorCellMap.set(cell.nearPlatformCell, [...existing, loc]);
      }
    }
  }

  // ホーム枠番号 → フラットなセルエントリのマップ
  type FlatCell = {
    locationId: string;
    facilities: Facility[];
    exits: string | null;
    connections: FacilityConnection[];
  };
  const locationsByCell: Record<number, FlatCell[]> = {};
  for (const location of locations) {
    for (const cell of location.cells) {
      if (cell.nearPlatformCell !== null) {
        const cellNum = cell.nearPlatformCell;
        if (cellNum >= 1 && cellNum <= platformMaxCarCount) {
          if (!locationsByCell[cellNum]) locationsByCell[cellNum] = [];
          locationsByCell[cellNum].push({
            locationId: location.id,
            facilities: cell.facilities,
            exits: location.exits,
            connections: location.connections,
          });
        }
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


  // ホーム外縁のストライプ方向（列車と反対側の端）
  const stripOuterEdge = effectivePlatformSide === 'bottom' ? 'bottom-0' : 'top-0';

  const platformStrip = (
    <div className="relative h-15 bg-stone-200">
      {platformCells.map((cellNumber) => {
        const cellLocations = locationsByCell[cellNumber] ?? [];
        const sameFloorLocs = sameFloorCellMap.get(cellNumber) ?? [];
        if (cellLocations.length === 0 && sameFloorLocs.length === 0) return null;

        const leftPercent = ((cellNumber - 0.5) / platformMaxCarCount) * 100;
        const cellLeftPercent = ((cellNumber - 1) / platformMaxCarCount) * 100;
        const cellWidthPercent = (1 / platformMaxCarCount) * 100;
        const sameFloorColors = sameFloorLocs.flatMap(loc =>
          loc.connections.map(conn => conn.lineColors[0] ?? '#9ca3af')
        );

        return (
          <div key={cellNumber}>
            {/* 対面乗り換えラインカラーストライプ（ホーム外縁） */}
            {sameFloorColors.length > 0 && (
              <div
                className={`absolute ${stripOuterEdge} h-1.5 flex`}
                style={{ left: `${cellLeftPercent}%`, width: `${cellWidthPercent}%` }}
              >
                {sameFloorColors.map((color, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                ))}
              </div>
            )}
            {/* 施設アイコン */}
            {cellLocations.length > 0 && (
              <div
                className="absolute top-0 bottom-0 flex items-center gap-0.5 -translate-x-1/2"
                style={{ left: `${leftPercent}%` }}
              >
                {cellLocations.flatMap((loc) =>
                  loc.facilities.filter(f => f.typeCode !== 'sameFloor').map((f, idx) =>
                    FACILITY_ICONS[f.typeCode] ? (
                      <Image
                        key={`${loc.locationId}-${idx}`}
                        src={FACILITY_ICONS[f.typeCode]}
                        alt={f.typeName}
                        title={loc.exits || f.typeName}
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    ) : (
                      <span key={`${loc.locationId}-${idx}`} title={loc.exits || f.typeName} className="text-sm leading-none">📍</span>
                    )
                  )
                )}
              </div>
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
        <div className="md:hidden flex gap-0.5 items-start">
          {/* top側ホーム: 外側（通常ラベル）→ ホームに近い側（対面乗り換えラベル）→ ストリップ → 車両 */}
          {effectivePlatformSide === 'top' && (
            <>
              <VerticalFacilityLabels
                locations={regularLocations}
                platformMaxCarCount={platformMaxCarCount}
                platformCells={platformCells}
                side="top"
              />
              <VerticalSameFloorLabels
                sameFloorLocations={sameFloorLocations}
                platformMaxCarCount={platformMaxCarCount}
                platformCells={platformCells}
                side="top"
              />
            </>
          )}
          <div className="flex flex-col gap-0.5">
            {platformCells.map((cellNumber) => {
              const isTrainCar = carPositions.includes(cellNumber);
              const displayCarNumber = isTrainCar ? occupiedCells.indexOf(cellNumber) + 1 : null;
              const physicalCarNumber = isTrainCar ? carPositions.indexOf(cellNumber) + 1 : null;
              const isLeadingCar = isTrainCar && cellNumber === carPositions[0];
              const cellLocations = locationsByCell[cellNumber] ?? [];

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

              // 対面乗り換えストライプ（ホームの外縁＝列車と反対側の端）
              const sameFloorColors = (sameFloorCellMap.get(cellNumber) ?? []).flatMap(loc =>
                loc.connections.map(conn => conn.lineColors[0] ?? '#9ca3af')
              );
              // ホーム外縁: bottom側ホームなら右端、top側ホームなら左端
              const stripOuterEdgeV = effectivePlatformSide === 'bottom' ? 'right-0' : 'left-0';

              const stripCell = (
                <div className="w-16 flex-shrink-0 h-36 bg-stone-200 relative flex flex-col items-center justify-center gap-1">
                  {sameFloorColors.length > 0 && (
                    <div className={`absolute top-0 bottom-0 ${stripOuterEdgeV} w-1.5 flex flex-col z-10`}>
                      {sameFloorColors.map((color, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  )}
                  {cellLocations.flatMap((loc) =>
                    loc.facilities.filter(f => f.typeCode !== 'sameFloor').map((f, idx) =>
                      FACILITY_ICONS[f.typeCode] ? (
                        <Image key={`${loc.locationId}-${idx}`} src={FACILITY_ICONS[f.typeCode]} alt={f.typeName} title={loc.exits || f.typeName} width={28} height={28} className="w-7 h-7" />
                      ) : (
                        <span key={`${loc.locationId}-${idx}`} className="text-base leading-none">📍</span>
                      )
                    )
                  )}
                </div>
              );

              return (
                <div key={cellNumber} className="flex items-stretch gap-0.5">
                  {effectivePlatformSide === 'top' ? (
                    <>{stripCell}{carCell}</>
                  ) : (
                    <>{carCell}{stripCell}</>
                  )}
                </div>
              );
            })}
          </div>
          {/* bottom側ホーム: 車両 → ストリップ → ホームに近い側（対面乗り換えラベル）→ 外側（通常ラベル） */}
          {effectivePlatformSide === 'bottom' && (
            <>
              <VerticalSameFloorLabels
                sameFloorLocations={sameFloorLocations}
                platformMaxCarCount={platformMaxCarCount}
                platformCells={platformCells}
                side="bottom"
              />
              <VerticalFacilityLabels
                locations={regularLocations}
                platformMaxCarCount={platformMaxCarCount}
                platformCells={platformCells}
                side="bottom"
              />
            </>
          )}
        </div>

        {/* 横レイアウト（デスクトップ: md以上） */}
        <div className="hidden md:block">
          {effectivePlatformSide === 'top' && (
            <>
              {/* 通常施設ラベル（外側）→ 対面乗り換えラベル（ホームに近い側）→ ストリップ の順 */}
              <HorizontalFacilityLabels locations={regularLocations} platformMaxCarCount={platformMaxCarCount} side="top" />
              <HorizontalSameFloorLabels sameFloorLocations={sameFloorLocations} platformMaxCarCount={platformMaxCarCount} side="top" />
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
              {/* ストリップ → 対面乗り換えラベル（ホームに近い側）→ 通常施設ラベル（外側）の順 */}
              {platformStrip}
              <HorizontalSameFloorLabels sameFloorLocations={sameFloorLocations} platformMaxCarCount={platformMaxCarCount} side="bottom" />
              <HorizontalFacilityLabels locations={regularLocations} platformMaxCarCount={platformMaxCarCount} side="bottom" />
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
