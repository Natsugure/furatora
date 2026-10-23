import type { ReactNode } from 'react';
import { DOOR_MARK_OPACITY, PX_PER_METER, layoutRows, type Bounds, type VerticalLayout } from '../domain/geometry';
import type { ConcoursePlateLayout, FacingTransferLayout } from '../domain/concourseLayout';
import { doorListGroups, type DoorListGroups } from '../domain/doorList';
import type { ConcourseDTO, TrainStopPatternDTO } from '../domain/types';
import { DoorTileList } from './DoorTileList';
import { DiagramSvg } from './diagram/DiagramSvg';
import { ConcoursePlateRow } from './overlay/ConcoursePlateRow';
import { FacingTransferTagRow } from './overlay/FacingTransferTagRow';

// 停車位置パターン1件ぶんのカード。
//
// 図は「SVGの幾何」と「HTMLのオーバーレイ2枚」の3層でできており、
// 3層すべてが同じキャンバス（幅 = 描画範囲 × PX_PER_METER）の上に乗る。
// 線路に向かって立った見え方で描くので、上から SVG → 出口・乗換プレート → 対面乗換の札 の順に固定である（ADR-0022）。
// 札をプレートの外側に置くのは、引き出し線を持たない札をプレートの引き出し線の迂回に関わらせないため。
// 層をまたぐxの対応は xFraction() の割合で取るので、キャンバスが
// コンテナ幅まで伸びても対応は崩れない。docs/adr/0006 参照。

type Props = {
  pattern: TrainStopPatternDTO;
  physicalLength: number;
  concourses: ConcourseDTO[];
  bounds: Bounds;
  /** 出口・乗換プレートの配置。ホーム単位で決まるので PlatformDisplay で算出する */
  plateLayout: ConcoursePlateLayout;
  /** 対面乗換の札の配置。同上 */
  facingLayout: FacingTransferLayout;
  /** 設備アイコンPNGの配信元パス。DiagramSvg にそのまま渡す（既定 '/icons'） */
  iconBasePath?: string;
  /**
   * 編集レイヤ（admin の DiagramEditLayer）の差し込み口。SVGの要素ボックスと
   * 完全に一致する `relative` ラッパの中に絶対配置で重なる。実際に使った rows を
   * そのまま渡すので、呼び出し側で layoutRows() を再計算する必要が無い。
   * web は未指定のまま（挙動不変）。
   */
  diagramOverlay?: (rows: VerticalLayout) => ReactNode;
};

export function PlatformDiagram({
  pattern,
  physicalLength,
  concourses,
  bounds,
  plateLayout,
  facingLayout,
  iconBasePath,
  diagramOverlay,
}: Props) {
  const { minX, maxX } = bounds;
  const width = maxX - minX;
  const cars = [...pattern.cars].sort((a, b) => a.carNumber - b.carNumber);
  const rows = layoutRows({ hasConcourseLeaders: plateLayout.groups.length > 0 });
  const freeSpace = doorListGroups(cars.map((c) => ({ carNumber: c.carNumber, doors: c.freeSpaceDoors })));
  const prioritySeat = doorListGroups(cars.map((c) => ({ carNumber: c.carNumber, doors: c.prioritySeatDoors })));

  return (
    <div
      className="rounded-3xl border-2 p-6"
      style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border-default)' }}
    >
      {/* 列車名 */}
      <div className="mb-4 pb-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
        <h5 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {pattern.trainLabel}
        </h5>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {pattern.carCount}両編成
        </p>
      </div>

      <div className="mb-2 overflow-x-auto">
        {/* キャンバス。min-width（width ではない）にすることで、コンテナが広いときは
            伸びて余白を埋め、狭いときは横スクロールになる。伸縮しても各層は
            割合で位置を決めているのでxがずれない */}
        <div className="flex flex-col" style={{ minWidth: width * PX_PER_METER }}>
          {/* relative 以外のクラスを足さないこと。h-full やgridのstretchを与えると
              SVGの要素ボックスがviewBoxのアスペクト比から外れ、内部の絶対配置オーバーレイの
              y座標が実測pxとずれる（x はxFractionの割合なので影響しない）。 */}
          <div className="relative">
            <DiagramSvg
              cars={cars}
              concourses={concourses}
              physicalLength={physicalLength}
              minX={minX}
              width={width}
              rows={rows}
              plateGroups={plateLayout.groups}
              facingBanners={facingLayout.banners}
              iconBasePath={iconBasePath}
            />
            {diagramOverlay?.(rows)}
          </div>
          <ConcoursePlateRow
            groups={plateLayout.groups}
            laneCount={plateLayout.laneCount}
            bounds={bounds}
          />
          <FacingTransferTagRow
            banners={facingLayout.banners}
            laneCount={facingLayout.laneCount}
            bounds={bounds}
          />
        </div>
      </div>

      {/* 凡例 */}
      <div
        className="grid grid-cols-2 gap-2 pt-3 text-xs md:grid-cols-3"
        style={{ borderTop: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}
      >
        <div className="flex items-center gap-1.5">
          <FreeSpaceMark />
          <span>フリースペース</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FreeSpaceMark partial />
          <span>フリースペース（一部編成）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DoorMark />
          <span>乗車位置（ドア）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-4 flex-shrink-0 rounded"
            style={{ backgroundColor: 'var(--sign-exit-bg)', border: '1px solid var(--sign-exit-edge)' }}
          />
          <span>出口</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-4 flex-shrink-0 rounded"
            style={{ backgroundColor: 'var(--sign-transfer-bg)', border: '1.5px solid var(--sign-transfer-edge)' }}
          />
          <span>乗換</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-shrink-0">
            <path d="M3 13 V7 H13 V13" fill="none" stroke="var(--sign-leader)" strokeWidth="1.5" />
          </svg>
          <span>同じ出口・乗換へ</span>
        </div>
      </div>

      {/* フリースペースの一覧。図はドア位置を示すが、号車とドア番号の一覧は
          読み上げ・テキスト検索のために残す（車両情報ページができるまでの受け皿でもある） */}
      <DoorCategoryLists
        title="フリースペース"
        groups={freeSpace}
        markers={{
          standard: <FreeSpaceMark />,
          partial: <FreeSpaceMark partial />,
        }}
        tileBg="var(--card-transfer-bg)"
        tileInk="var(--card-transfer-heading)"
      />

      {/* 優先席は乗ってから探すもので立ち位置を左右しないため図には出さないが、
          情報は失わせない（車両情報ページの新設までここが受け皿）。
          印は四角（赤い路線色と形で分ける。ADR-0018 決定2） */}
      <DoorCategoryLists
        title="優先席"
        groups={prioritySeat}
        markers={{
          standard: <Square color="var(--card-prio-heading)" />,
          partial: <Square color="var(--card-prio-heading)" />,
        }}
        tileBg="var(--card-prio-bg)"
        tileInk="var(--card-prio-heading)"
      />
    </div>
  );
}

// 1つの設備の一覧を「全編成」「一部編成」の見出しで分けて出す。印以外（題・タイルの色）は設備で共通
function DoorCategoryLists({
  title,
  groups,
  markers,
  tileBg,
  tileInk,
}: {
  title: string;
  groups: DoorListGroups;
  markers: { standard: ReactNode; partial: ReactNode };
  tileBg: string;
  tileInk: string;
}) {
  const common = { title, tileBg, tileInk };
  return (
    <>
      <DoorTileList {...common} coverage="全編成" marker={markers.standard} doors={groups.standard} />
      <DoorTileList {...common} coverage="一部編成" marker={markers.partial} doors={groups.partial} />
    </>
  );
}

// 凡例と一覧の見出しの頭に出す印。図のフリースペースの印と同じ形（全編成は丸、一部編成は輪）
function FreeSpaceMark({ partial = false }: { partial?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-shrink-0">
      {partial ? (
        <circle cx={8} cy={8} r={5.75} fill="none" stroke="var(--color-free-standard)" strokeWidth={2.5} />
      ) : (
        <circle cx={8} cy={8} r={7} fill="var(--color-free-standard)" />
      )}
    </svg>
  );
}

// 凡例の乗車位置。図のドアの棒と同じ色と透過
function DoorMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-shrink-0">
      <rect x={2} y={6} width={12} height={4} rx={2} fill="var(--sign-boarding-mark)" fillOpacity={DOOR_MARK_OPACITY} />
    </svg>
  );
}

function Square({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: color }} />;
}
