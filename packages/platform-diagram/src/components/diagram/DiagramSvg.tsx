import type { FacilityTypeCode } from '@furatora/database/enums';
import {
  CONCOURSE_TICK_HEIGHT,
  DOOR_MARK_LENGTH,
  DOOR_MARK_OPACITY,
  DOOR_MARK_THICKNESS,
  FACILITY_ICON_PITCH,
  FACILITY_ICON_SIZE,
  FACILITY_ROW_HEIGHT,
  FREE_SPACE_MARK_HALO,
  FREE_SPACE_MARK_RADIUS,
  FREE_SPACE_RING_WIDTH,
  PLATFORM_BAR_HEIGHT,
  PLATFORM_LABEL_FONT_SIZE,
  PX_PER_METER,
  TRAIN_ROW_HEIGHT,
  verticalMatrix,
  type VerticalLayout,
} from '../../domain/geometry';
import type { ConcoursePlateGroup, FacingTransferBanner } from '../../domain/concourseLayout';
import { carCornerRadii, roundedBarPath } from '../../domain/carShape';
import { doorMarks } from '../../domain/consist';
import { isDoorOrderReversed } from '../../domain/doorOrder';
import type { ConcourseDTO, StopPatternCarDTO } from '../../domain/types';

// 図の幾何だけを描く。文字はホーム両端の距離ラベルと号車番号しか持たない
// （出口名・路線名・対面乗換の文はSVG外のHTMLオーバーレイにある）。

// ファイル名だけを持つ。配信元は iconBasePath prop（既定 '/icons'）で決まる。
// public/ はアプリごとに独立配信されるため、このパッケージを使う各アプリが
// 自分の public/icons/ に同名ファイルを置く必要がある（README.md 参照）。
// キーを FacilityTypeCode にして、設備の種類の足し忘れをコンパイルエラーにする。
// それでも稼働中のコードが知らない種類が DB から来うる（ADR-0016「残るずれ」）ので、描画側のフォールバックは残す。
const FACILITY_ICON_FILES: Record<FacilityTypeCode, string> = {
  elevator: 'elevator.png',
  escalator: 'escalator.png',
  stairs: 'stairs.png',
  ramp: 'wheelchair_ramp.png',
  stairLift: 'stair_lift.png',
  sameFloor: 'wheelchair.png',
  wheelchairEscalator: 'wheelchair_escalator.png',
};

/** 号車どうしの間に空ける隙間（片側）。境目をはっきりさせる。見本の 6px */
const CAR_INSET = 0.6;
/** 号車番号の札（見本の 28px 四方・角 9px・文字 15px） */
const CAR_NUMBER_TAG_SIZE = 5;
const CAR_NUMBER_TAG_RADIUS = 1.6;
const CAR_NUMBER_FONT_SIZE = 3;
/**
 * 号車番号の札の中心を、列車の帯の中央より奥へずらす量。
 * ドアが奇数枚の号車では真ん中のドアが号車の中央に来るので、
 * 中央に置くとホーム側の縁のフリースペースの丸と重なる
 */
const CAR_NUMBER_TAG_SHIFT = 1.5;
/** 設備のアイコンを札の中で描く大きさ（見本は 32px の札に 22px のアイコン） */
const FACILITY_ICON_INNER_SIZE = FACILITY_ICON_SIZE * 0.7;
const FACILITY_TILE_RADIUS = 1.6;

type Props = {
  cars: StopPatternCarDTO[];
  concourses: ConcourseDTO[];
  physicalLength: number;
  minX: number;
  width: number;
  rows: VerticalLayout;
  plateGroups: ConcoursePlateGroup[];
  facingBanners: FacingTransferBanner[];
  /** 設備アイコンPNGの配信元パス。各アプリの public/icons/ を指す（既定 '/icons'） */
  iconBasePath?: string;
  /**
   * 縦の図は横の図を左へ90°回したもの（0m が下、列車が左。ADR-0023）。
   * 中身はいつも横の座標で描き、外側の <g> で回す。文字・アイコンだけ正立に戻す
   */
  orientation?: Orientation;
};

type Orientation = 'horizontal' | 'vertical';

/** ホームの両端の文字（0m とホーム長） */
type EndLabel = {
  key: 'start' | 'end';
  text: string;
  x: number;
  y: number;
  textAnchor: 'start' | 'middle' | 'end';
  dominantBaseline?: 'hanging';
};

/** 縦の図で、文字・アイコンを (cx, cy) を中心に正立へ戻す transform。横の図では何もしない */
function upright(vertical: boolean, cx: number, cy: number): string | undefined {
  return vertical ? `rotate(90 ${cx} ${cy})` : undefined;
}

export function DiagramSvg({
  cars,
  concourses,
  physicalLength,
  minX,
  width,
  rows,
  plateGroups,
  facingBanners,
  iconBasePath = '/icons',
  orientation = 'horizontal',
}: Props) {
  const reversed = isDoorOrderReversed(cars);
  const cells = concourses.flatMap((c) => c.cells.map((cell) => ({ ...cell, concourseId: c.id })));
  const tileY = rows.facilityY + (FACILITY_ROW_HEIGHT - FACILITY_ICON_SIZE) / 2;

  const vertical = orientation === 'vertical';
  // 縦では両端の文字をホームの帯の延長上（0m は下の端の外、ホーム長は上の端の外）に正立で置く
  const endLabels: EndLabel[] = vertical
    ? [
        { key: 'start', text: '0m', x: -0.6, y: rows.platformBarY, textAnchor: 'middle', dominantBaseline: 'hanging' },
        { key: 'end', text: `${physicalLength}m`, x: physicalLength + 0.6, y: rows.platformBarY, textAnchor: 'middle' },
      ]
    : [
        { key: 'start', text: '0m', x: 0, y: rows.platformLabelY, textAnchor: 'start' },
        { key: 'end', text: `${physicalLength}m`, x: physicalLength, y: rows.platformLabelY, textAnchor: 'end' },
      ];

  const content = (
    <>
      {/* 対面乗換ティント。ホーム側の帯全体を覆う */}
      {facingBanners.map((banner) => (
        <rect
          key={banner.key}
          x={banner.startX}
          y={rows.facingBandY}
          width={banner.endX - banner.startX}
          height={rows.facingBandHeight}
          fill={banner.color}
          fillOpacity={0.14}
        >
          <title>{banner.text}</title>
        </rect>
      ))}

      {/* ホーム帯（[0, physicalLength] が実体） */}
      <rect
        x={0}
        y={rows.platformBarY}
        width={physicalLength}
        height={PLATFORM_BAR_HEIGHT}
        fill="var(--color-border-strong)"
      />
      {endLabels.map(({ key, text, x, y, ...attrs }) => (
        <text
          key={key}
          x={x}
          y={y}
          transform={upright(vertical, x, y)}
          fontSize={PLATFORM_LABEL_FONT_SIZE}
          fill="var(--color-text-secondary)"
          {...attrs}
        >
          {text}
        </text>
      ))}

      <CarRow cars={cars} trainY={rows.trainY} vertical={vertical} />
      <DoorMarks cars={cars} reversed={reversed} rows={rows} />

      {/* 設備アクセス点（xPositionMeters が非nullのcellのみ。
          コンコース全体のものは座標が無いのでSVG外のリストに委ねる） */}
      {cells
        .filter((cell) => cell.xPositionMeters !== null)
        .map((cell, idx) =>
          cell.facilities.map((facility, fIdx) => {
            const x = cell.xPositionMeters! + (fIdx - (cell.facilities.length - 1) / 2) * FACILITY_ICON_PITCH;
            const iconFile = facility.typeCode !== null ? FACILITY_ICON_FILES[facility.typeCode] : undefined;
            return iconFile ? (
              // 白い札に載せる（見本）。札の大きさは FACILITY_ICON_SIZE のままなので、描画範囲の算出は変わらない
              <g
                key={`${cell.concourseId}-${idx}-${fIdx}`}
                transform={upright(vertical, x, tileY + FACILITY_ICON_SIZE / 2)}
              >
                <rect
                  x={x - FACILITY_ICON_SIZE / 2}
                  y={tileY}
                  width={FACILITY_ICON_SIZE}
                  height={FACILITY_ICON_SIZE}
                  rx={FACILITY_TILE_RADIUS}
                  fill="var(--color-bg-card)"
                  stroke="var(--color-border-default)"
                  strokeWidth={0.3}
                />
                <image
                  href={`${iconBasePath}/${iconFile}`}
                  x={x - FACILITY_ICON_INNER_SIZE / 2}
                  y={tileY + (FACILITY_ICON_SIZE - FACILITY_ICON_INNER_SIZE) / 2}
                  width={FACILITY_ICON_INNER_SIZE}
                  height={FACILITY_ICON_INNER_SIZE}
                >
                  <title>{facility.typeName}</title>
                </image>
              </g>
            ) : (
              <text
                key={`${cell.concourseId}-${idx}-${fIdx}`}
                x={x}
                y={rows.facilityY + FACILITY_ROW_HEIGHT / 2 + 1}
                fontSize={FACILITY_ICON_SIZE}
                textAnchor="middle"
                transform={upright(vertical, x, rows.facilityY + FACILITY_ROW_HEIGHT / 2)}
              >
                📍
                <title>{facility.typeName}</title>
              </text>
            );
          }),
        )}

      <ConcourseLeaders groups={plateGroups} rows={rows} />
    </>
  );

  if (vertical) {
    // 左へ90°回す（verticalMatrix()。行列式が +1 の回転なので鏡写しにならない）。
    // 縦は伸び縮みさせないので、幅と高さを px で両方決める（アスペクト比が viewBox と一致し、レターボックスは出ない）
    return (
      <svg
        viewBox={`0 0 ${rows.viewHeight} ${width}`}
        width={rows.viewHeight * PX_PER_METER}
        height={width * PX_PER_METER}
        style={{ display: 'block', flexShrink: 0 }}
      >
        <g transform={`matrix(${verticalMatrix({ minX, maxX: minX + width }).join(' ')})`}>{content}</g>
      </svg>
    );
  }

  return (
    <svg
      viewBox={`${minX} 0 ${width} ${rows.viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      /* height を指定してはならない。指定すると meet がレターボックスを生み、
         HTMLオーバーレイとのx対応が無言で壊れる（docs/domain/platform-coordinate-system.md） */
      style={{ width: '100%', display: 'block' }}
    >
      {content}
    </svg>
  );
}

/**
 * 号車。1両ずつ独立した角丸の矩形として描き、間に隙間を空けて境目を示す。
 * 編成の外側の端だけ大きく丸める（carCornerRadii()）。
 *
 * 編成全体を1つの外枠で囲まないのは、号車が座標上で連続している保証が
 * データに無いため（管理画面の手入力）。隙間方式なら非連続でも破綻しない。
 */
function CarRow({
  cars,
  trainY,
  vertical,
}: {
  cars: StopPatternCarDTO[];
  trainY: number;
  vertical: boolean;
}) {
  const radii = carCornerRadii(cars);
  const tagCenterY = trainY + TRAIN_ROW_HEIGHT / 2 - CAR_NUMBER_TAG_SHIFT;

  return (
    <>
      {cars.map((car) => {
        const start = car.startMeters + CAR_INSET;
        const end = car.endMeters - CAR_INSET;
        const centerX = (car.startMeters + car.endMeters) / 2;

        return (
          <g key={car.carNumber}>
            <path
              d={roundedBarPath(
                { x: start, y: trainY, width: end - start, height: TRAIN_ROW_HEIGHT },
                radii.get(car.carNumber)!,
              )}
              fill="var(--color-train-car-bg)"
              stroke="var(--color-train-car-border)"
              strokeWidth={0.2}
            />

            {/* 号車番号の札。車体が一様な色なので、白い札で浮かせる */}
            <g transform={upright(vertical, centerX, tagCenterY)}>
              <rect
                x={centerX - CAR_NUMBER_TAG_SIZE / 2}
                y={tagCenterY - CAR_NUMBER_TAG_SIZE / 2}
                width={CAR_NUMBER_TAG_SIZE}
                height={CAR_NUMBER_TAG_SIZE}
                rx={CAR_NUMBER_TAG_RADIUS}
                fill="var(--color-car-number-bg)"
              />
              <text
                x={centerX}
                y={tagCenterY}
                dominantBaseline="central"
                fontSize={CAR_NUMBER_FONT_SIZE}
                fontWeight="bold"
                textAnchor="middle"
                fill="var(--color-text-primary)"
                style={{ fontFamily: 'var(--font-sign)', fontVariantNumeric: 'tabular-nums' }}
              >
                {car.carNumber}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );
}

/**
 * ドアの印。どのドアも号車のホーム側の縁をまたいで置く（見本）。
 *
 * - フリースペースの無いドア: 乗車位置の棒
 * - 全編成のフリースペース: ローズの丸（白い縁で号車の縁から浮かせる）
 * - 一部編成のフリースペース: ローズの輪。全編成と色ではなく形で分ける（色だけで意味を伝えない。ADR-0018）
 *
 * 号車を色で塗り分けないのは、号車の境目を潰すうえ、凡例を読まないと何の色か分からないため。
 * 「ここに立て」をドアの位置に直接示すほうが早い。
 */
function DoorMarks({
  cars,
  reversed,
  rows,
}: {
  cars: StopPatternCarDTO[];
  reversed: boolean;
  rows: VerticalLayout;
}) {
  const edgeY = rows.trainY + TRAIN_ROW_HEIGHT;

  return (
    <>
      {cars.map((car) => {
        const { boardingXs, freeSpaces } = doorMarks(car, reversed);

        return (
          <g key={car.carNumber}>
            {boardingXs.map((x) => (
              <rect
                key={x}
                x={x - DOOR_MARK_LENGTH / 2}
                y={edgeY - DOOR_MARK_THICKNESS / 2}
                width={DOOR_MARK_LENGTH}
                height={DOOR_MARK_THICKNESS}
                rx={DOOR_MARK_THICKNESS / 2}
                fill="var(--sign-boarding-mark)"
                fillOpacity={DOOR_MARK_OPACITY}
              />
            ))}
            {freeSpaces.map((mark) => (
              <g key={mark.doorNumber}>
                <circle cx={mark.x} cy={edgeY} r={FREE_SPACE_MARK_RADIUS + FREE_SPACE_MARK_HALO} fill="var(--color-bg-card)" />
                {mark.isStandard ? (
                  <circle cx={mark.x} cy={edgeY} r={FREE_SPACE_MARK_RADIUS} fill="var(--color-free-standard)" />
                ) : (
                  // 輪は線の太さの半分だけ内側に描き、外径を丸と揃える。中は下の白い縁の円が埋める
                  <circle
                    cx={mark.x}
                    cy={edgeY}
                    r={FREE_SPACE_MARK_RADIUS - FREE_SPACE_RING_WIDTH / 2}
                    fill="none"
                    stroke="var(--color-free-standard)"
                    strokeWidth={FREE_SPACE_RING_WIDTH}
                  />
                )}
                {/* <title> の子は文字列1つにする。React のサーバー描画は子が複数あると中身を出力せず、
                    ハイドレーションが不一致になる（Issue #143） */}
                <title>
                  {`${car.carNumber}号車 ${mark.doorNumber}番ドア付近のフリースペース${mark.isStandard ? '（全編成）' : '（一部編成）'}`}
                </title>
              </g>
            ))}
          </g>
        );
      })}
    </>
  );
}

/** コンコース束ね線。同一コンコースのアクセス点をまとめ、その先のプレートへ垂線を落とす */
function ConcourseLeaders({ groups, rows }: { groups: ConcoursePlateGroup[]; rows: VerticalLayout }) {
  if (rows.concourseBracketY === null || rows.concourseTickStartY === null) return null;
  const bracketY = rows.concourseBracketY;
  const tickStartY = rows.concourseTickStartY;
  // 束ね線からSVGの下端まで。この先はHTMLオーバーレイのプレートが受ける
  const edgeY = rows.viewHeight;

  return (
    <g stroke="var(--sign-leader)" strokeWidth={0.25} fill="none">
      {groups.map((group) => (
        <g key={group.concourseId}>
          {group.tickXs.map((x) => (
            <line key={x} x1={x} y1={tickStartY} x2={x} y2={bracketY} />
          ))}
          {group.bracketStartX !== group.bracketEndX && (
            <line x1={group.bracketStartX} y1={bracketY} x2={group.bracketEndX} y2={bracketY} />
          )}
          {/* プレートは anchorX を中心に置かれるので、引き出し線は垂直でよい */}
          <line
            x1={group.anchorX}
            y1={bracketY}
            x2={group.anchorX}
            y2={edgeY}
            strokeWidth={CONCOURSE_TICK_HEIGHT * 0.12}
          />
        </g>
      ))}
    </g>
  );
}
