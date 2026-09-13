import { isDoorOrderReversed } from '@furatora/platform-diagram/domain';
import type { PlatformLocationInput } from '@/features/facility/schema';
import type { TrainStopPatternInput } from '@/features/stop-pattern/schema';
import type {
  LayoutConcourseDTO, LayoutStopPatternDTO,
} from '@/features/station-layout/ports';

// 図上編集・インスペクタ（StationLayoutEditor）が保持する未保存stateの純関数。
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

/** 新規アクセス点に設備を追加したときの既定値（旧FacilityForm・PR5で削除、の既定と同じ） */
const DEFAULT_FACILITY_ACCESSIBILITY = { isWheelchairAccessible: true, isStrollerAccessible: true };

export type FacilityDraft = {
  typeCode: string;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
  notes: string | null;
};

export type CellDraft = {
  /** 既存セルはbaselineのid。新規セルは呼び出し側が発行する一時id（React key・保存後は破棄） */
  id: string;
  xPositionMeters: number | null;
  facilities: FacilityDraft[];
};

export type ConnectionDraft = {
  stationId: string;
  connectedPlatformId: string | null;
  directionId: string | null;
  exitLabel: string | null;
  xRangeStart: number | null;
  xRangeEnd: number | null;
};

/**
 * コンコース（platformLocations 1件）の未保存state。座標に加え、テキストフィールド
 * （exits/notes/facilities/connections）を含む全体draft。既存コンコースの編集・
 * 新規作成・複製のいずれもこのdraftを共通の作業単位として扱う（baselineが無ければ新規、あれば編集）。
 */
export type ConcourseDraft = {
  exits: string | null;
  notes: string | null;
  cells: CellDraft[];
  connections: ConnectionDraft[];
};

export type PatternDraft = {
  cars: { carNumber: number; startMeters: number; endMeters: number }[];
};

export function createConcourseDraft(
  concourse: Pick<LayoutConcourseDTO, 'exits' | 'notes' | 'cells' | 'connections'>,
): ConcourseDraft {
  return {
    exits: concourse.exits,
    notes: concourse.notes,
    cells: concourse.cells.map((c) => ({
      id: c.id,
      xPositionMeters: c.xPositionMeters,
      facilities: c.facilities.map((f) => ({
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

/** 新規コンコース作成（US-1「+ コンコースを追加」導線）の空draft */
export function createEmptyConcourseDraft(): ConcourseDraft {
  return { exits: null, notes: null, cells: [], connections: [] };
}

/**
 * 複製（#31）: 既存コンコースの内容をコピーし、各アクセス点の座標を offsetMeters ぶん
 * ずらした新規未保存draftを作る。座標を持たない（null）セルはそのままnullを保つ
 * （ずらす対象が無いため）。cellのidは makeId() で呼び出し側から発行させる
 * （crypto.randomUUID() 等。関数を純粋に保つため、乱数生成は外側の責務にする）。
 *
 * connections の xRangeStart/xRangeEnd（対面乗り換え帯）も cells と同じ自ホーム座標系
 * のため、同じ offsetMeters でずらす。ここを放置すると、複製後のセルは動くのに
 * 乗り換え帯だけ元の位置に取り残される。
 */
export function duplicateConcourseDraft(
  concourse: Pick<LayoutConcourseDTO, 'exits' | 'notes' | 'cells' | 'connections'>,
  offsetMeters: number,
  makeId: () => string,
): ConcourseDraft {
  const draft = createConcourseDraft(concourse);
  return {
    ...draft,
    cells: draft.cells.map((cell) => ({
      ...cell,
      id: makeId(),
      xPositionMeters: cell.xPositionMeters !== null ? cell.xPositionMeters + offsetMeters : null,
    })),
    connections: draft.connections.map((connection) => ({
      ...connection,
      xRangeStart: connection.xRangeStart !== null ? connection.xRangeStart + offsetMeters : null,
      xRangeEnd: connection.xRangeEnd !== null ? connection.xRangeEnd + offsetMeters : null,
    })),
  };
}

/**
 * 保存不可な状態ならエラーメッセージを返す（旧FacilityForm.tsxのsubmit時アラート相当）。
 * インスペクタのボタン無効化と、保存実行前のガードの両方から呼ばれる単一の判定源にする。
 */
export function concourseDraftValidationError(draft: ConcourseDraft): string | null {
  if (draft.cells.length === 0) return 'アクセス点を1つ以上追加してください';
  if (draft.cells.some((cell) => cell.facilities.length === 0)) {
    return '各アクセス点に設備タイプを1つ以上選択してください';
  }
  return null;
}

export function createPatternDraft(pattern: Pick<LayoutStopPatternDTO, 'cars'>): PatternDraft {
  return {
    cars: [...pattern.cars]
      .sort((a, b) => a.carNumber - b.carNumber)
      .map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
  };
}

/**
 * 新規停車パターン作成（US-3）: buildCarSegments() のプレビュー結果からdraftを作る。
 * createPatternDraft と処理は同じだが、CarSegment（stop-pattern featureのdomain型）は
 * StopPatternCarDTO（doorCount等を含む表示用の広い型）のサブセットのため別関数にする。
 */
export function createPatternDraftFromPreview(
  segments: { carNumber: number; startMeters: number; endMeters: number }[],
): PatternDraft {
  return {
    cars: [...segments]
      .sort((a, b) => a.carNumber - b.carNumber)
      .map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
  };
}

/** コンコースのテキストフィールド（出口・場所メモ）を更新する */
export function setConcourseField(
  draft: ConcourseDraft,
  field: 'exits' | 'notes',
  value: string | null,
): ConcourseDraft {
  return { ...draft, [field]: value };
}

/**
 * アクセス点（cell）を1つ動かす。ドラッグ（DiagramEditLayer）からは常に number で
 * 呼ばれるが、インスペクタの数値入力を空にする操作（「コンコース全体」に戻す）に
 * も同じ関数を使うため null も受け付ける。
 */
export function moveCell(draft: ConcourseDraft, cellId: string, x: number | null): ConcourseDraft {
  return {
    ...draft,
    cells: draft.cells.map((cell) => (cell.id === cellId ? { ...cell, xPositionMeters: x } : cell)),
  };
}

/** アクセス点を1件追加する（既定は座標未入力＝コンコース全体）。idは呼び出し側が発行する */
export function addCell(draft: ConcourseDraft, id: string): ConcourseDraft {
  return { ...draft, cells: [...draft.cells, { id, xPositionMeters: null, facilities: [] }] };
}

/** アクセス点を1件削除する */
export function removeCell(draft: ConcourseDraft, cellId: string): ConcourseDraft {
  return { ...draft, cells: draft.cells.filter((c) => c.id !== cellId) };
}

/**
 * アクセス点に設備タイプを追加する（既存FacilityFormのチェックボックスON相当）。
 * 既に同じtypeCodeがあれば何もしない（トグルの対になる removeCellFacility を使うこと）。
 */
export function addCellFacility(draft: ConcourseDraft, cellId: string, typeCode: string): ConcourseDraft {
  return {
    ...draft,
    cells: draft.cells.map((cell) => {
      if (cell.id !== cellId || cell.facilities.some((f) => f.typeCode === typeCode)) return cell;
      return {
        ...cell,
        facilities: [...cell.facilities, { typeCode, ...DEFAULT_FACILITY_ACCESSIBILITY, notes: null }],
      };
    }),
  };
}

/** アクセス点から設備タイプを1件外す */
export function removeCellFacility(draft: ConcourseDraft, cellId: string, typeCode: string): ConcourseDraft {
  return {
    ...draft,
    cells: draft.cells.map((cell) => (
      cell.id === cellId
        ? { ...cell, facilities: cell.facilities.filter((f) => f.typeCode !== typeCode) }
        : cell
    )),
  };
}

/** 設備タイプの属性（車いす対応・ベビーカー対応・メモ）を更新する */
export function updateCellFacility(
  draft: ConcourseDraft,
  cellId: string,
  typeCode: string,
  patch: Partial<Omit<FacilityDraft, 'typeCode'>>,
): ConcourseDraft {
  return {
    ...draft,
    cells: draft.cells.map((cell) => {
      if (cell.id !== cellId) return cell;
      return {
        ...cell,
        facilities: cell.facilities.map((f) => (f.typeCode === typeCode ? { ...f, ...patch } : f)),
      };
    }),
  };
}

/**
 * 乗換可能な駅を1件登録・更新する（既存FacilityFormのチェックボックスON＋詳細入力相当）。
 * 同じstationIdが既にあれば内容をpatchで更新、無ければ既定値＋patchで新規追加する。
 */
export function setConnection(
  draft: ConcourseDraft,
  stationId: string,
  patch: Partial<Omit<ConnectionDraft, 'stationId'>>,
): ConcourseDraft {
  const exists = draft.connections.some((c) => c.stationId === stationId);
  if (exists) {
    return {
      ...draft,
      connections: draft.connections.map((c) => (c.stationId === stationId ? { ...c, ...patch } : c)),
    };
  }
  return {
    ...draft,
    connections: [
      ...draft.connections,
      {
        stationId,
        connectedPlatformId: null,
        directionId: null,
        exitLabel: null,
        xRangeStart: null,
        xRangeEnd: null,
        ...patch,
      },
    ],
  };
}

/** 乗換可能な駅を1件外す（チェックボックスOFF相当） */
export function removeConnection(draft: ConcourseDraft, stationId: string): ConcourseDraft {
  return { ...draft, connections: draft.connections.filter((c) => c.stationId !== stationId) };
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
 * moveCarEdge を使うこと。テキスト入力（境界ベースの数値入力）からも同じ関数を呼ぶ
 * ことで、ドラッグと数値入力の両経路で隙間・重なりを構造的に作れなくする。
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
 * 編成の向きに応じた自由端の側を返す。非反転編成では1号車の start・最終号車の end、
 * 反転編成ではこれが入れ替わる（moveCarBoundary の境界共有規則の裏返し）。
 * moveCarEdge とインスペクタのラベル表示（StopPatternInspector）の両方が
 * この判定を共有することで、向きの判定を1箇所に閉じる。
 */
export function freeEdgeSides(reversed: boolean): { first: 'start' | 'end'; last: 'start' | 'end' } {
  return reversed ? { first: 'end', last: 'start' } : { first: 'start', last: 'end' };
}

/**
 * 編成の外端（他のどの号車とも境界を共有しない、編成全体としての自由端）を動かす。
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
  const { first: freeSideOfFirst, last: freeSideOfLast } = freeEdgeSides(reversed);

  const isLeadEdge = index === 0 && edge.side === freeSideOfFirst;
  const isTrailEdge = index === cars.length - 1 && edge.side === freeSideOfLast;
  if (!isLeadEdge && !isTrailEdge) return draft;

  const car = cars[index]!;
  const nextCar = edge.side === 'start'
    ? { ...car, startMeters: Math.min(x, car.endMeters - opts.minCarMeters) }
    : { ...car, endMeters: Math.max(x, car.startMeters + opts.minCarMeters) };

  return { cars: cars.map((c, i) => (i === index ? nextCar : c)) };
}

/**
 * コンコースdraftがサーバー値から変更されているか。cell/connection は id・stationId
 * で対応づけて内容を比較するため、順序が変わっただけでは dirty にならない。
 * サーバー側に存在しないid（新規追加分）は無条件で dirty とみなす。
 */
export function isConcourseDirty(
  server: Pick<LayoutConcourseDTO, 'exits' | 'notes' | 'cells' | 'connections'>,
  draft: ConcourseDraft,
): boolean {
  if (server.exits !== draft.exits) return true;
  if (server.notes !== draft.notes) return true;
  if (server.cells.length !== draft.cells.length) return true;
  if (server.connections.length !== draft.connections.length) return true;

  const serverCellById = new Map(server.cells.map((c) => [c.id, c]));
  for (const cell of draft.cells) {
    const serverCell = serverCellById.get(cell.id);
    if (!serverCell) return true;
    if (serverCell.xPositionMeters !== cell.xPositionMeters) return true;
    if (serverCell.facilities.length !== cell.facilities.length) return true;

    const serverFacilityByType = new Map(serverCell.facilities.map((f) => [f.typeCode, f]));
    for (const facility of cell.facilities) {
      const serverFacility = serverFacilityByType.get(facility.typeCode);
      if (!serverFacility) return true;
      if (serverFacility.isWheelchairAccessible !== facility.isWheelchairAccessible) return true;
      if (serverFacility.isStrollerAccessible !== facility.isStrollerAccessible) return true;
      if (serverFacility.notes !== facility.notes) return true;
    }
  }

  const serverConnectionByStation = new Map(server.connections.map((c) => [c.connectedStationId, c]));
  for (const connection of draft.connections) {
    const serverConnection = serverConnectionByStation.get(connection.stationId);
    if (!serverConnection) return true;
    if (serverConnection.connectedPlatformId !== connection.connectedPlatformId) return true;
    if (serverConnection.directionId !== connection.directionId) return true;
    if (serverConnection.exitLabel !== connection.exitLabel) return true;
    if (serverConnection.xRangeStart !== connection.xRangeStart) return true;
    if (serverConnection.xRangeEnd !== connection.xRangeEnd) return true;
  }

  return false;
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
 * draftを持ち、baselineから変更されている項目のidだけを返す。
 * draft未作成（未編集）の項目は必ずcleanなので候補にすら入れない。
 */
export function dirtyIds<B, D>(
  baselines: B[],
  idOf: (baseline: B) => string,
  drafts: Map<string, D>,
  isDirty: (baseline: B, draft: D) => boolean,
): string[] {
  return baselines
    .filter((b) => {
      const draft = drafts.get(idOf(b));
      return draft !== undefined && isDirty(b, draft);
    })
    .map(idOf);
}

/**
 * PUT/POST の platform-locations ペイロードを組み立てる。
 * draftが全体状態を持つため、draft単体から組み立てられる（新規作成でも既存編集でも同じ関数を使える）。
 */
export function toPlatformLocationPayload(
  platformId: string,
  draft: ConcourseDraft,
): PlatformLocationInput {
  return {
    platformId,
    exits: draft.exits,
    notes: draft.notes,
    cells: draft.cells.map((cell) => ({
      xPositionMeters: cell.xPositionMeters,
      facilities: cell.facilities.map((f) => ({
        typeCode: f.typeCode,
        isWheelchairAccessible: f.isWheelchairAccessible,
        isStrollerAccessible: f.isStrollerAccessible,
        notes: f.notes,
      })),
    })),
    connections: draft.connections.map((c) => ({
      stationId: c.stationId,
      connectedPlatformId: c.connectedPlatformId,
      directionId: c.directionId,
      exitLabel: c.exitLabel,
      xRangeStart: c.xRangeStart,
      xRangeEnd: c.xRangeEnd,
    })),
  };
}

/**
 * PUT/POST の train-stop-patterns ペイロードを組み立てる。
 * cars は全置換なので draft の全号車を送る（doorCount 等の列車由来の値は
 * この PUT では扱わないので失われない）。
 */
export function toStopPatternPayload(
  platformId: string,
  trainId: string,
  draft: PatternDraft,
): TrainStopPatternInput {
  return {
    platformId,
    trainId,
    cars: [...draft.cars]
      .sort((a, b) => a.carNumber - b.carNumber)
      .map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
  };
}

export type ConcourseDisplayLookups = {
  facilityTypeName: (code: string) => string;
  connectedStation: (stationId: string) => {
    name: string;
    lines: { name: string; color: string | null }[];
    directions: { id: string; displayName: string }[];
  } | undefined;
};

/**
 * draft（新規作成・複製中の未保存コンコースを含む）を図の表示用DTO（LayoutConcourseDTO）
 * に変換する。draftはtypeName・接続先駅名・路線名/色・方面名などの表示専用フィールドを
 * 持たないため、選択肢データ（facilityTypes/connectedStations）からlookupで解決する。
 * facilities.id はReactキー・DOM用の合成id（`${cellId}:${typeCode}`）で、保存には使わない。
 */
export function draftToDisplayConcourse(
  id: string,
  draft: ConcourseDraft,
  lookups: ConcourseDisplayLookups,
): LayoutConcourseDTO {
  return {
    id,
    exits: draft.exits,
    notes: draft.notes,
    cells: draft.cells.map((cell) => ({
      id: cell.id,
      xPositionMeters: cell.xPositionMeters,
      facilities: cell.facilities.map((f) => ({
        id: `${cell.id}:${f.typeCode}`,
        typeCode: f.typeCode,
        typeName: lookups.facilityTypeName(f.typeCode),
        isWheelchairAccessible: f.isWheelchairAccessible,
        isStrollerAccessible: f.isStrollerAccessible,
        notes: f.notes,
      })),
    })),
    connections: draft.connections.map((c) => {
      const station = lookups.connectedStation(c.stationId);
      return {
        connectedStationId: c.stationId,
        connectedPlatformId: c.connectedPlatformId,
        directionId: c.directionId,
        stationName: station?.name ?? '',
        lineNames: station?.lines.map((l) => l.name) ?? [],
        lineColors: station?.lines.map((l) => l.color) ?? [],
        directionName: station?.directions.find((d) => d.id === c.directionId)?.displayName ?? null,
        exitLabel: c.exitLabel,
        xRangeStart: c.xRangeStart,
        xRangeEnd: c.xRangeEnd,
      };
    }),
  };
}
