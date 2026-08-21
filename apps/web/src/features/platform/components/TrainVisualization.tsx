import {
  CONCOURSE_LABEL_FONT_SIZE,
  CONCOURSE_LABEL_LINE_HEIGHT,
  CONCOURSE_SLOT_HEIGHT,
  FACILITY_ROW_HEIGHT,
  GAP_Y,
  PLATFORM_BAR_HEIGHT,
  PLATFORM_LABEL_FONT_SIZE,
  TRAIN_ROW_HEIGHT,
  layoutRows,
  type Bounds,
} from '../domain/geometry';
import {
  CHIP_GAP,
  CHIP_RADIUS,
  type ConcourseLabel,
  type ConcourseLayout,
} from '../domain/concourseLayout';
import { connectionLabels } from '../domain/concourse';
import { isDoorOrderReversed } from '../domain/doorOrder';
import type { ConcourseDTO, TrainStopPatternDTO } from '../domain/types';

type Props = {
  pattern: TrainStopPatternDTO;
  physicalLength: number;
  concourses: ConcourseDTO[];
  platformSide: 'top' | 'bottom' | null;
  bounds: Bounds;
  /** コンコース束ね線とラベルの配置。ホーム単位で決まるので PlatformDisplay で算出する */
  concourseLayout: ConcourseLayout;
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
// （実表示高さは PX_PER_METER * layoutRows().viewHeight。コンコースラベルの段数ぶんだけ伸びる。
// docs/domain/platform-coordinate-system.md 参照）。
// 5px/m は「一度に見える両数」と「viewBox単位の文字の判読性」の折衷点。
// 320mホームで幅1600px・高さ110px（ラベル無し時）、号車番号(2.2m)が11px相当になる。
// これ以上大きくするとモバイルで2両弱しか収まらない。
const PX_PER_METER = 5;

const ICON_SIZE = 6;
const NOSE_INSET_RATIO = 0.15;

function leadingCarPolygon(startMeters: number, endMeters: number, y: number, noseOnRight: boolean): string {
  const width = endMeters - startMeters;
  const inset = width * NOSE_INSET_RATIO;
  const bottom = y + TRAIN_ROW_HEIGHT;
  const mid = y + TRAIN_ROW_HEIGHT / 2;

  return noseOnRight
    ? `${startMeters},${y} ${endMeters - inset},${y} ${endMeters},${mid} ${endMeters - inset},${bottom} ${startMeters},${bottom}`
    : `${startMeters + inset},${y} ${endMeters},${y} ${endMeters},${bottom} ${startMeters + inset},${bottom} ${startMeters},${mid}`;
}

/**
 * コンコースのラベルブロック（出口行 / 乗換行）。
 * slotTop から常に下向きに積む。上下反転は layoutRows() が吸収済み。
 */
function ConcourseLabelBlock({ label, slotTop }: { label: ConcourseLabel; slotTop: number }) {
  const kinds = [
    ...(label.exitText !== null ? (['exit'] as const) : []),
    ...(label.transferText !== null ? (['transfer'] as const) : []),
  ];
  const baselineOf = (index: number) =>
    slotTop + CONCOURSE_LABEL_FONT_SIZE + index * CONCOURSE_LABEL_LINE_HEIGHT;
  // 乗換行はチップ列とテキストの合計幅で中央寄せするため、左端から組み立てる
  const transferStartX = label.labelX - label.transferLineWidth / 2;

  return (
    <g>
      <title>{label.title}</title>
      {kinds.map((kind, index) =>
        kind === 'exit' ? (
          <text
            key="exit"
            x={label.labelX}
            y={baselineOf(index)}
            fontSize={CONCOURSE_LABEL_FONT_SIZE}
            fontWeight="bold"
            textAnchor="middle"
            fill="var(--color-text-primary)"
          >
            {label.exitText}
          </text>
        ) : (
          <g key="transfer">
            {label.lineColors.map((color, chipIndex) => (
              <circle
                key={chipIndex}
                cx={transferStartX + CHIP_RADIUS + chipIndex * (CHIP_RADIUS * 2 + CHIP_GAP)}
                cy={baselineOf(index) - CONCOURSE_LABEL_FONT_SIZE * 0.35}
                r={CHIP_RADIUS}
                fill={color}
              />
            ))}
            <text
              x={transferStartX + label.chipsWidth}
              y={baselineOf(index)}
              fontSize={CONCOURSE_LABEL_FONT_SIZE}
              fill="var(--color-text-secondary)"
            >
              {label.transferText}
            </text>
          </g>
        ),
      )}
    </g>
  );
}

export function TrainVisualization({
  pattern,
  physicalLength,
  concourses,
  platformSide,
  bounds,
  concourseLayout,
}: Props) {
  const { minX, maxX } = bounds;
  const cars = [...pattern.cars].sort((a, b) => a.carNumber - b.carNumber);
  const reversed = isDoorOrderReversed(cars);
  const leadingCar = cars.find((c) => c.carNumber === 1) ?? cars[0];
  const {
    facilityY,
    trainY,
    bandY,
    platformBarY,
    platformLabelY,
    viewHeight,
    concourseBracketY,
    concourseTickStartY,
    concourseSlotTops,
  } = layoutRows(platformSide, concourseLayout.rowCount);

  const cells = concourses.flatMap((c) => c.cells.map((cell) => ({ ...cell, concourseId: c.id })));
  // connectionLabels は connections と同じ並びを返すので、帯に添える <title> を添字で取る
  const transferBands = concourses.flatMap((c) => {
    const labels = connectionLabels(c);
    return c.connections
      .map((conn, idx) => ({ ...conn, concourseId: c.id, label: labels[idx] }))
      .filter((conn) => conn.xRangeStart !== null && conn.xRangeEnd !== null);
  });

  const width = maxX - minX;

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
          viewBox={`${minX} 0 ${width} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', minWidth: width * PX_PER_METER, display: 'block' }}
        >
          {/* ホーム（[0, physicalLength] が実体） */}
          <rect
            x={0}
            y={platformBarY}
            width={physicalLength}
            height={PLATFORM_BAR_HEIGHT}
            fill="var(--color-border-strong)"
          />
          <text x={0} y={platformLabelY} fontSize={PLATFORM_LABEL_FONT_SIZE} fill="var(--color-text-secondary)">0m</text>
          <text
            x={physicalLength}
            y={platformLabelY}
            fontSize={PLATFORM_LABEL_FONT_SIZE}
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
            >
              {/* 帯の高さは GAP_Y しかなく文字が入らないため、行き先は <title> に持たせる */}
              <title>対面乗換: {band.label}</title>
            </rect>
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

          {/* コンコース束ね線。同一コンコースのアクセス点をまとめ、その先に出口・乗換を示す。
              引き出し線が他段のラベルを横切りうるので、線を先に引いて文字を必ず上に置く */}
          {concourseBracketY !== null && concourseTickStartY !== null && (
            <g stroke="var(--color-border-strong)" strokeWidth={0.25} fill="none">
              {concourseLayout.labels.map((label) => {
                const slotTop = concourseSlotTops[label.row];
                // ラベルブロックの、束ね線に近い側の端。ここに繋がないと引き出し線が文字を貫く。
                // 上下どちらに積んでも成り立つよう、距離が近い方の端を選ぶ
                const slotBottom = slotTop + CONCOURSE_SLOT_HEIGHT;
                const leaderEndY =
                  Math.abs(slotTop - concourseBracketY) <= Math.abs(slotBottom - concourseBracketY)
                    ? slotTop
                    : slotBottom;

                return (
                  <g key={label.concourseId}>
                    {label.tickXs.map((x) => (
                      <line key={x} x1={x} y1={concourseTickStartY} x2={x} y2={concourseBracketY} />
                    ))}
                    {label.bracketStartX !== label.bracketEndX && (
                      <line
                        x1={label.bracketStartX}
                        y1={concourseBracketY}
                        x2={label.bracketEndX}
                        y2={concourseBracketY}
                      />
                    )}
                    {/* ラベルはクランプで束ね線の中点からずれることがあるので斜めに引く */}
                    <line
                      x1={(label.bracketStartX + label.bracketEndX) / 2}
                      y1={concourseBracketY}
                      x2={label.labelX}
                      y2={leaderEndY}
                      opacity={0.5}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {concourseLayout.labels.map((label) => (
            <ConcourseLabelBlock
              key={label.concourseId}
              label={label}
              slotTop={concourseSlotTops[label.row]}
            />
          ))}
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
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-shrink-0">
            <path d="M3 13 V7 H13 V13" fill="none" stroke="var(--color-border-strong)" strokeWidth="1.5" />
          </svg>
          <span>同じ出口・乗換へ</span>
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
