import type { Bounds } from '../domain/geometry';
import { isDoorOrderReversed } from '../domain/doorOrder';
import type { ConcourseDTO, TrainStopPatternDTO } from '../domain/types';

type Props = {
  pattern: TrainStopPatternDTO;
  physicalLength: number;
  concourses: ConcourseDTO[];
  platformSide: 'top' | 'bottom' | null;
  bounds: Bounds;
};

const FACILITY_ICONS: Record<string, string> = {
  elevator: '/icons/elevator.png',
  escalator: '/icons/escalator.png',
  stairs: '/icons/stairs.png',
  ramp: '/icons/wheelchair_ramp.png',
  stairLift: '/icons/stair_lift.png',
  sameFloor: '/icons/wheelchair.png',
};

// SVG座標系の単位はメートル。画面幅換算は viewBox + preserveAspectRatio に委ねる
// （実表示高さは PX_PER_METER * VIEW_HEIGHT で常に一定になる。docs/spec 参照）。
const PX_PER_METER = 10;

const MARGIN_Y = 1;
const FACILITY_ROW_HEIGHT = 8;
const GAP_Y = 2;
const TRAIN_ROW_HEIGHT = 10;
const VIEW_HEIGHT = MARGIN_Y * 2 + FACILITY_ROW_HEIGHT + GAP_Y + TRAIN_ROW_HEIGHT;

const ICON_SIZE = 6;
const NOSE_INSET_RATIO = 0.15;

function layoutRows(platformSide: 'top' | 'bottom' | null) {
  const isTop = platformSide === 'top';
  return {
    facilityY: isTop ? MARGIN_Y : MARGIN_Y + TRAIN_ROW_HEIGHT + GAP_Y,
    trainY: isTop ? MARGIN_Y + FACILITY_ROW_HEIGHT + GAP_Y : MARGIN_Y,
  };
}

function leadingCarPolygon(startMeters: number, endMeters: number, y: number, noseOnRight: boolean): string {
  const width = endMeters - startMeters;
  const inset = width * NOSE_INSET_RATIO;
  const bottom = y + TRAIN_ROW_HEIGHT;
  const mid = y + TRAIN_ROW_HEIGHT / 2;

  return noseOnRight
    ? `${startMeters},${y} ${endMeters - inset},${y} ${endMeters},${mid} ${endMeters - inset},${bottom} ${startMeters},${bottom}`
    : `${startMeters + inset},${y} ${endMeters},${y} ${endMeters},${bottom} ${startMeters + inset},${bottom} ${startMeters},${mid}`;
}

export function TrainVisualization({ pattern, physicalLength, concourses, platformSide, bounds }: Props) {
  const { minX, maxX } = bounds;
  const cars = [...pattern.cars].sort((a, b) => a.carNumber - b.carNumber);
  const reversed = isDoorOrderReversed(cars);
  const leadingCar = cars.find((c) => c.carNumber === 1) ?? cars[0];
  const { facilityY, trainY } = layoutRows(platformSide);

  const cells = concourses.flatMap((c) => c.cells.map((cell) => ({ ...cell, concourseId: c.id })));
  const transferBands = concourses.flatMap((c) =>
    c.connections
      .filter((conn) => conn.xRangeStart !== null && conn.xRangeEnd !== null)
      .map((conn) => ({ ...conn, concourseId: c.id })),
  );

  const width = maxX - minX;
  const bandY = platformSide === 'top' ? trainY + TRAIN_ROW_HEIGHT : trainY - GAP_Y;

  return (
    <div className="border-2 rounded-3xl p-6" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border-default)' }}>
      {/* 列車名 */}
      <div className="mb-4 pb-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
        <h5 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>{pattern.trainLabel}</h5>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{pattern.carCount}両編成</p>
      </div>

      {/* ホーム + 列車の可視化（SVG viewBox方式。x昇順で左→右に描画する） */}
      <div className="overflow-x-auto mb-2">
        <svg
          viewBox={`${minX} 0 ${width} ${VIEW_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', minWidth: width * PX_PER_METER, display: 'block' }}
        >
          {/* ホーム（[0, physicalLength] が実体） */}
          <rect
            x={0}
            y={trainY + TRAIN_ROW_HEIGHT + 0.3}
            width={physicalLength}
            height={0.6}
            fill="var(--color-border-strong)"
          />
          <text x={0} y={trainY + TRAIN_ROW_HEIGHT + 2.2} fontSize={1.6} fill="var(--color-text-secondary)">0m</text>
          <text
            x={physicalLength}
            y={trainY + TRAIN_ROW_HEIGHT + 2.2}
            fontSize={1.6}
            fill="var(--color-text-secondary)"
            textAnchor="end"
          >
            {physicalLength}m
          </text>

          {/* 対面乗り換え帯（xRangeStart/xRangeEndが両方非nullの接続のみ） */}
          {transferBands.map((band, idx) => (
            <rect
              key={`${band.concourseId}-${idx}`}
              x={band.xRangeStart!}
              y={bandY}
              width={band.xRangeEnd! - band.xRangeStart!}
              height={GAP_Y}
              fill={band.lineColors[0] ?? '#9ca3af'}
              opacity={0.6}
            />
          ))}

          {/* 号車 */}
          {cars.map((car) => {
            const isLeading = leadingCar && car.carNumber === leadingCar.carNumber;
            const noseOnRight = reversed; // car1が右端にある場合、外向き（右）にノーズを出す
            const width2 = car.endMeters - car.startMeters;

            return (
              <g key={car.carNumber}>
                {isLeading ? (
                  <polygon
                    points={leadingCarPolygon(car.startMeters, car.endMeters, trainY, noseOnRight)}
                    fill="var(--color-train-car-bg)"
                    stroke="var(--color-train-car-border)"
                    strokeWidth={0.1}
                  />
                ) : (
                  <rect
                    x={car.startMeters}
                    y={trainY}
                    width={width2}
                    height={TRAIN_ROW_HEIGHT}
                    fill="var(--color-train-car-bg)"
                    stroke="var(--color-train-car-border)"
                    strokeWidth={0.1}
                  />
                )}

                {/* ドア帯 */}
                {Array.from({ length: car.doorCount }, (_, d) => {
                  const doorNum = reversed ? car.doorCount - d : d + 1;
                  const hasFree = car.freeSpaceDoors.some((fs) => fs.nearDoor === doorNum);
                  const hasStdFree = car.freeSpaceDoors.some((fs) => fs.nearDoor === doorNum && fs.isStandard);
                  const hasPrio = car.prioritySeatDoors.some((ps) => ps.nearDoor === doorNum);
                  const hasStdPrio = car.prioritySeatDoors.some((ps) => ps.nearDoor === doorNum && ps.isStandard);
                  if (!hasFree && !hasPrio) return null;

                  const doorX = car.startMeters + (d / car.doorCount) * width2;
                  const doorWidth = width2 / car.doorCount;
                  const split = hasFree && hasPrio;
                  const freeColor = hasStdFree ? 'var(--color-free-standard)' : 'var(--color-free-nonstandard)';
                  const prioColor = hasStdPrio ? 'var(--color-prio-standard)' : 'var(--color-prio-nonstandard)';

                  return (
                    <g key={doorNum}>
                      {hasFree && (
                        <rect
                          x={doorX}
                          y={trainY}
                          width={doorWidth}
                          height={split ? TRAIN_ROW_HEIGHT / 2 : TRAIN_ROW_HEIGHT}
                          fill={freeColor}
                        />
                      )}
                      {hasPrio && (
                        <rect
                          x={doorX}
                          y={split ? trainY + TRAIN_ROW_HEIGHT / 2 : trainY}
                          width={doorWidth}
                          height={split ? TRAIN_ROW_HEIGHT / 2 : TRAIN_ROW_HEIGHT}
                          fill={prioColor}
                        />
                      )}
                    </g>
                  );
                })}

                <text
                  x={(car.startMeters + car.endMeters) / 2}
                  y={trainY + TRAIN_ROW_HEIGHT / 2 + 0.7}
                  fontSize={2.2}
                  fontWeight="bold"
                  textAnchor="middle"
                  fill="var(--color-text-primary)"
                >
                  {car.carNumber}
                </text>
              </g>
            );
          })}

          {/* 設備アクセス点（xPositionMetersが非nullのcellのみ。コンコース全体はSVG外のリストに委ねる） */}
          {cells
            .filter((cell) => cell.xPositionMeters !== null)
            .map((cell, idx) =>
              cell.facilities.map((facility, fIdx) => {
                const x = cell.xPositionMeters! + (fIdx - (cell.facilities.length - 1) / 2) * (ICON_SIZE + 1);
                const iconHref = FACILITY_ICONS[facility.typeCode];
                return iconHref ? (
                  <image
                    key={`${cell.concourseId}-${idx}-${fIdx}`}
                    href={iconHref}
                    x={x - ICON_SIZE / 2}
                    y={facilityY + (FACILITY_ROW_HEIGHT - ICON_SIZE) / 2}
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                  >
                    <title>{facility.typeName}</title>
                  </image>
                ) : (
                  <text
                    key={`${cell.concourseId}-${idx}-${fIdx}`}
                    x={x}
                    y={facilityY + FACILITY_ROW_HEIGHT / 2 + 1}
                    fontSize={ICON_SIZE}
                    textAnchor="middle"
                  >
                    📍
                    <title>{facility.typeName}</title>
                  </text>
                );
              }),
            )}
        </svg>
      </div>

      {/* 凡例 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs pt-3" style={{ borderTop: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-md" style={{ backgroundColor: 'var(--color-free-standard)' }} />
          <span>フリースペース</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-md" style={{ backgroundColor: 'var(--color-free-nonstandard)' }} />
          <span>(一部編成)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-md" style={{ backgroundColor: 'var(--color-prio-standard)' }} />
          <span>優先席</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">↔️</span>
          <span>対面乗換</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">♿</span>
          <span>段差なし</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">🛗</span>
          <span>エレベータ</span>
        </div>
      </div>

      {/* フリースペース詳細 */}
      {cars.some((c) => c.freeSpaceDoors.length > 0) && (
        <div className="mt-3 p-3 border rounded-2xl text-xs" style={{ backgroundColor: 'var(--card-transfer-bg)', borderColor: 'var(--card-transfer-border)' }}>
          <strong className="flex items-center gap-1" style={{ color: 'var(--card-transfer-heading)' }}>
            <span className="text-sm">ℹ️</span> フリースペース詳細
          </strong>
          <ul className="mt-1.5 space-y-0.5 ml-5" style={{ color: 'var(--color-text-primary)' }}>
            {cars.flatMap((c) =>
              c.freeSpaceDoors.map((fs, idx) => (
                <li key={`${c.carNumber}-${idx}`}>
                  {c.carNumber}号車 {fs.nearDoor}番ドア付近
                  {fs.isStandard ? ' (全編成)' : ' (一部編成)'}
                </li>
              )),
            )}
          </ul>
        </div>
      )}

      {/* 優先席詳細 */}
      {cars.some((c) => c.prioritySeatDoors.length > 0) && (
        <div className="mt-2 p-3 border rounded-2xl text-xs" style={{ backgroundColor: 'var(--card-prio-bg)', borderColor: 'var(--card-prio-border)' }}>
          <strong className="flex items-center gap-1" style={{ color: 'var(--card-prio-heading)' }}>
            <span className="text-sm">ℹ️</span> 優先席
          </strong>
          <ul className="mt-1.5 space-y-0.5 ml-5" style={{ color: 'var(--color-text-primary)' }}>
            {cars.flatMap((c) =>
              c.prioritySeatDoors.map((ps, idx) => (
                <li key={`${c.carNumber}-${idx}`}>
                  {c.carNumber}号車 {ps.nearDoor}番ドア付近
                </li>
              )),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
