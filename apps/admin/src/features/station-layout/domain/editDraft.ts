import { isDoorOrderReversed } from '@furatora/platform-diagram/domain';
import type { PlatformLocationInput } from '@/features/facility/schema';
import type { TrainStopPatternInput } from '@/features/stop-pattern/schema';
import type {
  LayoutConcourseDTO, LayoutStopPatternDTO,
} from '@/features/station-layout/ports';

// 図上編集（StationLayoutEditor）が保持する未保存stateの純関数。
// Next.js非依存（'use client' に依存しない）なので node 環境でテストできる。
// この計画で確定した唯一の恒久ドメインルール: 号車境界は隣接号車が共有する。
// 向き（docs/domain/platform-coordinate-system.md「号車の向き」）によってどちらの
// フィールドが共有側かが変わる:
//   非反転（carNumber昇順でxが増加）: cars[i].endMeters === cars[i+1].startMeters
//   反転（carNumber昇順でxが減少）  : cars[i].startMeters === cars[i+1].endMeters
// 向きの判定は isDoorOrderReversed()（packages/platform-diagram）を唯一の判定源とする。
// この不変条件は moveCarBoundary 以外の経路で startMeters/endMeters を書き換えてはならない
// （docs/domain/train-stop-patterns.md）。

/** 号車を潰さない最小幅（m）。moveCarBoundary/moveCarEdge の唯一のクランプ元 */
export const MIN_CAR_METERS = 0.5;

export type ConcourseDraft = {
  cells: { id: string; xPositionMeters: number | null }[];
};

export type PatternDraft = {
  cars: { carNumber: number; startMeters: number; endMeters: number }[];
};

export function createConcourseDraft(concourse: Pick<LayoutConcourseDTO, 'cells'>): ConcourseDraft {
  return { cells: concourse.cells.map((c) => ({ id: c.id, xPositionMeters: c.xPositionMeters })) };
}

export function createPatternDraft(pattern: Pick<LayoutStopPatternDTO, 'cars'>): PatternDraft {
  return {
    cars: [...pattern.cars]
      .sort((a, b) => a.carNumber - b.carNumber)
      .map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
  };
}

/** アクセス点（cell）を1つ動かす */
export function moveCell(draft: ConcourseDraft, cellId: string, x: number): ConcourseDraft {
  return {
    cells: draft.cells.map((cell) => (cell.id === cellId ? { ...cell, xPositionMeters: x } : cell)),
  };
}

/**
 * 号車の内側の境界（cars[boundaryIndex] と cars[boundaryIndex+1] の間）を動かす。
 *
 * 重なり・隙間は物理的に起こり得ないため、隣接号車の共有フィールドを常に同値に保つ
 * （このファイル唯一の不変条件）。どちらのフィールドが共有側かは編成の向きに依存する
 * （非反転: left.endMeters=right.startMeters、反転: left.startMeters=right.endMeters。
 * ファイル冒頭コメント参照）。opts.minCarMeters は号車を潰さない最小幅で、
 * 両側の号車がこれより短くならないようクランプする。
 *
 * boundaryIndex が範囲外（両端の外側の境界）のときは無変更で返す。両端は
 * moveCarEdge を使うこと。
 */
export function moveCarBoundary(
  draft: PatternDraft,
  boundaryIndex: number,
  x: number,
  opts: { minCarMeters: number },
): PatternDraft {
  const cars = [...draft.cars].sort((a, b) => a.carNumber - b.carNumber);
  if (boundaryIndex < 0 || boundaryIndex >= cars.length - 1) return draft;

  const left = cars[boundaryIndex]!;
  const right = cars[boundaryIndex + 1]!;
  const reversed = isDoorOrderReversed(cars);

  if (!reversed) {
    const minX = left.startMeters + opts.minCarMeters;
    const maxX = right.endMeters - opts.minCarMeters;
    const clamped = Math.min(Math.max(x, minX), maxX);
    return {
      cars: cars.map((car, i) => {
        if (i === boundaryIndex) return { ...car, endMeters: clamped };
        if (i === boundaryIndex + 1) return { ...car, startMeters: clamped };
        return car;
      }),
    };
  }

  // 反転編成: left（carNumberが小さい側）が右寄り、right（carNumberが大きい側）が
  // 左寄り。共有境界は left.startMeters === right.endMeters
  const minX = right.startMeters + opts.minCarMeters;
  const maxX = left.endMeters - opts.minCarMeters;
  const clamped = Math.min(Math.max(x, minX), maxX);
  return {
    cars: cars.map((car, i) => {
      if (i === boundaryIndex) return { ...car, startMeters: clamped };
      if (i === boundaryIndex + 1) return { ...car, endMeters: clamped };
      return car;
    }),
  };
}

/**
 * 編成の外端（他のどの号車とも境界を共有しない、編成全体としての自由端）を動かす。
 *
 * 非反転編成では1号車の start・最終号車の end が外端。反転編成ではこれが入れ替わり、
 * 1号車の end・最終号車の start が外端になる（moveCarBoundary の境界共有規則の裏返し）。
 * 内側の境界は moveCarBoundary を使うこと（edge が内側の号車・逆側のフィールドを
 * 指す場合は無変更で返す）。
 */
export function moveCarEdge(
  draft: PatternDraft,
  edge: { carNumber: number; side: 'start' | 'end' },
  x: number,
  opts: { minCarMeters: number },
): PatternDraft {
  const cars = [...draft.cars].sort((a, b) => a.carNumber - b.carNumber);
  const index = cars.findIndex((c) => c.carNumber === edge.carNumber);
  if (index === -1) return draft;

  const reversed = isDoorOrderReversed(cars);
  const freeSideOfFirst: 'start' | 'end' = reversed ? 'end' : 'start';
  const freeSideOfLast: 'start' | 'end' = reversed ? 'start' : 'end';

  const isLeadEdge = index === 0 && edge.side === freeSideOfFirst;
  const isTrailEdge = index === cars.length - 1 && edge.side === freeSideOfLast;
  if (!isLeadEdge && !isTrailEdge) return draft;

  const car = cars[index]!;
  const nextCar = edge.side === 'start'
    ? { ...car, startMeters: Math.min(x, car.endMeters - opts.minCarMeters) }
    : { ...car, endMeters: Math.max(x, car.startMeters + opts.minCarMeters) };

  return { cars: cars.map((c, i) => (i === index ? nextCar : c)) };
}

export function isConcourseDirty(server: Pick<LayoutConcourseDTO, 'cells'>, draft: ConcourseDraft): boolean {
  if (server.cells.length !== draft.cells.length) return true;
  const byId = new Map(server.cells.map((c) => [c.id, c.xPositionMeters]));
  return draft.cells.some((c) => byId.get(c.id) !== c.xPositionMeters);
}

export function isPatternDirty(server: Pick<LayoutStopPatternDTO, 'cars'>, draft: PatternDraft): boolean {
  if (server.cars.length !== draft.cars.length) return true;
  const byNumber = new Map(server.cars.map((c) => [c.carNumber, c]));
  return draft.cars.some((c) => {
    const s = byNumber.get(c.carNumber);
    return !s || s.startMeters !== c.startMeters || s.endMeters !== c.endMeters;
  });
}

/**
 * PUT /api/stations/{sid}/platform-locations/{lid} のペイロードを組み立てる。
 *
 * このPUTはコンコース全体をdelete→insertする全置換なので、draftに無いフィールド
 * （exits/notes/facilities/connections）はすべてserver DTOからそのまま引き継ぐ。
 * このコンコースの往復に必要な全フィールドをここ1箇所に閉じ込めることで、
 * 抜けをeditDraft.test.tsだけで機械的に検出できるようにする。
 */
export function toPlatformLocationPayload(
  platformId: string,
  concourse: LayoutConcourseDTO,
  draft: ConcourseDraft,
): PlatformLocationInput {
  const draftById = new Map(draft.cells.map((c) => [c.id, c.xPositionMeters]));

  return {
    platformId,
    exits: concourse.exits,
    notes: concourse.notes,
    cells: concourse.cells.map((cell) => ({
      xPositionMeters: draftById.has(cell.id) ? draftById.get(cell.id)! : cell.xPositionMeters,
      facilities: cell.facilities.map((f) => ({
        typeCode: f.typeCode,
        isWheelchairAccessible: f.isWheelchairAccessible,
        isStrollerAccessible: f.isStrollerAccessible,
        notes: f.notes,
      })),
    })),
    connections: concourse.connections.map((c) => ({
      stationId: c.connectedStationId,
      connectedPlatformId: c.connectedPlatformId,
      directionId: c.directionId,
      exitLabel: c.exitLabel,
      xRangeStart: c.xRangeStart,
      xRangeEnd: c.xRangeEnd,
    })),
  };
}

/**
 * PUT /api/stations/{sid}/train-stop-patterns/{pid} のペイロードを組み立てる。
 * cars は全置換なので draft の全号車を送る（doorCount 等の列車由来の値は
 * この PUT では扱わないので失われない）。
 */
export function toStopPatternPayload(
  platformId: string,
  pattern: LayoutStopPatternDTO,
  draft: PatternDraft,
): TrainStopPatternInput {
  return {
    platformId,
    trainId: pattern.trainId,
    cars: [...draft.cars]
      .sort((a, b) => a.carNumber - b.carNumber)
      .map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
  };
}
