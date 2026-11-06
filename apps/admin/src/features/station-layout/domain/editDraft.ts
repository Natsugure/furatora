import { carOneAnchorOf, roundToDecimal2 } from '@furatora/platform-diagram/domain';
import type { CarNumbersAscendToward, FacilityTypeCode } from '@furatora/database/enums';
import type { PlatformLocationInput } from '@/features/facility/schema';
import type { TrainStopPatternInput } from '@/features/stop-pattern/schema';
import type {
  LayoutConcourseDTO, LayoutStopPatternDTO,
} from '@/features/station-layout/ports';

// 図上編集・インスペクタ（StationLayoutEditor）が保持する未保存stateの純関数。
// Next.js非依存（'use client' に依存しない）なので node 環境でテストできる。
//
// 停車位置パターンは「1号車の外側の端」と「号車番号の向き」だけで保存する（ADR-0025）。
// 号車の長さは列車の号車構成で決まり、パターンでは変えない。したがって停車位置の編集は
// 編成全体の平行移動（shiftConsistByEdge）と、占める区間を保った向きの反転（reverseConsist）だけで、
// draft の cars はそれ以外の経路で書き換えない。どちらも号車ごとの長さを保つので、
// 隣接号車が境界を共有することも保たれる。

export type FacilityDraft = {
  typeCode: FacilityTypeCode;
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

/**
 * 停車位置パターンの未保存state。cars は図に描く区間で、保存時に carOneAnchorOf() で
 * 基準点（1号車の外側の端）へ戻す。向きは編集では変わらないが、1両の編成では区間から
 * 読み取れないため draft に持ち回る
 */
export type PatternDraft = {
  ascendToward: CarNumbersAscendToward;
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
      facilities: c.facilities.map((f) => ({ typeCode: f.typeCode })),
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
 * 保存不可な状態ならエラーメッセージを返す。
 * インスペクタのボタン無効化と、保存実行前のガードの両方から呼ばれる単一の判定源にする。
 */
export function concourseDraftValidationError(draft: ConcourseDraft): string | null {
  if (draft.cells.length === 0) return 'アクセス点を1つ以上追加してください';
  if (draft.cells.some((cell) => cell.facilities.length === 0)) {
    return '各アクセス点に設備タイプを1つ以上選択してください';
  }
  return null;
}

export function createPatternDraft(
  pattern: Pick<LayoutStopPatternDTO, 'cars' | 'carNumbersAscendToward'>,
): PatternDraft {
  return createPatternDraftFromPreview(pattern.cars, pattern.carNumbersAscendToward);
}

/**
 * 新規停車パターン作成（US-3）: プレビューの区間（carSegmentsFromCarOne の結果）からdraftを作る。
 * StopPatternCarDTO（doorCount 等を含む表示用の広い型）からは区間だけを取り出す。
 */
export function createPatternDraftFromPreview(
  segments: { carNumber: number; startMeters: number; endMeters: number }[],
  ascendToward: CarNumbersAscendToward,
): PatternDraft {
  return {
    ascendToward,
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
 * アクセス点に設備タイプを追加する。
 * 既に同じtypeCodeがあれば何もしない（トグルの対になる removeCellFacility を使うこと）。
 */
export function addCellFacility(draft: ConcourseDraft, cellId: string, typeCode: FacilityTypeCode): ConcourseDraft {
  return {
    ...draft,
    cells: draft.cells.map((cell) => {
      if (cell.id !== cellId || cell.facilities.some((f) => f.typeCode === typeCode)) return cell;
      return {
        ...cell,
        facilities: [...cell.facilities, { typeCode }],
      };
    }),
  };
}

/** アクセス点から設備タイプを1件外す */
export function removeCellFacility(draft: ConcourseDraft, cellId: string, typeCode: FacilityTypeCode): ConcourseDraft {
  return {
    ...draft,
    cells: draft.cells.map((cell) => (
      cell.id === cellId
        ? { ...cell, facilities: cell.facilities.filter((f) => f.typeCode !== typeCode) }
        : cell
    )),
  };
}

/**
 * 乗換可能な駅を1件登録・更新する。
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
 * 編成の向きに応じた自由端の側を返す。非反転編成では1号車の start・最終号車の end、
 * 反転編成（minusX）ではこれが入れ替わる。
 * shiftConsistByEdge とインスペクタのラベル表示（StopPatternInspector）の両方が
 * この判定を共有することで、向きの判定を1箇所に閉じる。
 */
export function freeEdgeSides(reversed: boolean): { first: 'start' | 'end'; last: 'start' | 'end' } {
  return reversed ? { first: 'end', last: 'start' } : { first: 'start', last: 'end' };
}

/**
 * 編成の外端（他のどの号車とも境界を共有しない、編成全体としての自由端）が x に来るよう、
 * 全号車を同じ差分だけ動かす（#201）。号車の長さと境界の共有は変わらない。
 * 号車の長さは列車の号車構成で決まり、パターンの編集では変えない（ADR-0025）。
 * edge が内側の号車・逆側のフィールドを指す場合は無変更で返す。
 *
 * opts.range は編成全体（つかんだ外端だけでなく反対側の外端も）を収める範囲で、差分をこれで
 * 抑える。ドラッグは凍結した bounds（画面の外に出さない）、数値入力は decimal(6,2) の上限
 * （保存時に溢れさせない）を渡す。編成が range の外にはみ出しているとき（bounds に含まれない
 * 新規作成中の停車パターン）は、range へ近づく向きにだけ動かせる。
 */
export function shiftConsistByEdge(
  draft: PatternDraft,
  edge: { carNumber: number; side: 'start' | 'end' },
  x: number,
  opts: { range: { minX: number; maxX: number } },
): PatternDraft {
  const cars = [...draft.cars].sort((a, b) => a.carNumber - b.carNumber);
  const index = cars.findIndex((c) => c.carNumber === edge.carNumber);
  if (index === -1) return draft;

  const { first: freeSideOfFirst, last: freeSideOfLast } = freeEdgeSides(draft.ascendToward === 'minusX');

  const isLeadEdge = index === 0 && edge.side === freeSideOfFirst;
  const isTrailEdge = index === cars.length - 1 && edge.side === freeSideOfLast;
  if (!isLeadEdge && !isTrailEdge) return draft;

  const car = cars[index]!;
  const consistMin = Math.min(...cars.map((c) => c.startMeters));
  const consistMax = Math.max(...cars.map((c) => c.endMeters));
  // 差分の範囲に 0 を必ず含め、range の外にいる編成が勝手に range へ引き戻されないようにする
  const minDelta = Math.min(0, opts.range.minX - consistMin);
  const maxDelta = Math.max(0, opts.range.maxX - consistMax);
  const rawDelta = x - (edge.side === 'start' ? car.startMeters : car.endMeters);
  const delta = Math.min(Math.max(rawDelta, minDelta), maxDelta);
  if (delta === 0) return draft;
  // 丸めないと浮動小数の誤差で隣接号車の共有フィールドがずれ、境界の共有が崩れる
  return {
    ascendToward: draft.ascendToward,
    cars: cars.map((c) => ({
      ...c,
      startMeters: roundToDecimal2(c.startMeters + delta),
      endMeters: roundToDecimal2(c.endMeters + delta),
    })),
  };
}

/**
 * 号車番号の向きを反転する。編成が占める区間 [min, max] は保ったまま、号車の並びだけを逆にする
 * （各区間を区間の中心で折り返す）。向きを間違えて登録したパターンを、位置を合わせ直さずに直すため。
 * 号車ごとの長さは保たれ、1号車は反対側の端に来る。保存では反転後の1号車の外側の端が基準点になる。
 */
export function reverseConsist(draft: PatternDraft): PatternDraft {
  const consistMin = Math.min(...draft.cars.map((c) => c.startMeters));
  const consistMax = Math.max(...draft.cars.map((c) => c.endMeters));
  // 丸めないと浮動小数の誤差で隣接号車の境界がずれる（shiftConsistByEdge と同じ理由）
  const mirror = (x: number) => roundToDecimal2(consistMin + consistMax - x);
  return {
    ascendToward: draft.ascendToward === 'plusX' ? 'minusX' : 'plusX',
    cars: [...draft.cars]
      .sort((a, b) => a.carNumber - b.carNumber)
      .map((c) => ({ carNumber: c.carNumber, startMeters: mirror(c.endMeters), endMeters: mirror(c.startMeters) })),
  };
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

    const serverTypeCodes = new Set(serverCell.facilities.map((f) => f.typeCode));
    if (cell.facilities.some((f) => !serverTypeCodes.has(f.typeCode))) return true;
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

export function isPatternDirty(
  server: Pick<LayoutStopPatternDTO, 'cars' | 'carNumbersAscendToward'>,
  draft: PatternDraft,
): boolean {
  // 1両の編成は向きを反転しても区間が変わらないので、向きも比べる
  if (server.carNumbersAscendToward !== draft.ascendToward) return true;
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
      facilities: cell.facilities.map((f) => ({ typeCode: f.typeCode })),
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
 * 号車の区間は送らず、draft の区間から基準点（1号車の外側の端）を戻して送る（ADR-0025）。
 * 1号車が無く基準点を戻せないときは null を返す。読み取りは号車構成を 1..carCount で補うので
 * 通常は起きないが、呼び出し側は保存せずに通知する（例外にすると async の外で捕まらない）。
 */
export function toStopPatternPayload(
  platformId: string,
  trainId: string,
  draft: PatternDraft,
): TrainStopPatternInput | null {
  const carOneOuterMeters = carOneAnchorOf(draft.cars, draft.ascendToward);
  if (carOneOuterMeters === null) return null;
  return { platformId, trainId, carOneOuterMeters, carNumbersAscendToward: draft.ascendToward };
}

export type ConcourseDisplayLookups = {
  facilityTypeName: (code: FacilityTypeCode) => string;
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
      })),
    })),
    connections: draft.connections.map((c) => {
      const station = lookups.connectedStation(c.stationId);
      return {
        connectedStationId: c.stationId,
        connectedPlatformId: c.connectedPlatformId,
        directionId: c.directionId,
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
