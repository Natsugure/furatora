import { describe, it, expect } from 'vitest';
import {
  createConcourseDraft, createEmptyConcourseDraft, duplicateConcourseDraft,
  createPatternDraft, createPatternDraftFromPreview,
  setConcourseField, moveCell, addCell, removeCell,
  addCellFacility, removeCellFacility, updateCellFacility,
  setConnection, removeConnection,
  moveCarBoundary, moveCarEdge,
  isConcourseDirty, isPatternDirty, toPlatformLocationPayload, toStopPatternPayload,
  draftToDisplayConcourse,
  MIN_CAR_METERS,
} from './editDraft';
import type { LayoutConcourseDTO, LayoutStopPatternDTO } from '@/features/station-layout/ports';

// 3号車編成。境界は 20 と 40（1-2号車間、2-3号車間）
const pattern: LayoutStopPatternDTO = {
  patternId: 'pattern-1',
  trainId: 'train-1',
  trainLabel: '東京メトロ銀座線',
  carCount: 3,
  cars: [
    { carNumber: 1, startMeters: 0, endMeters: 20, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
    { carNumber: 2, startMeters: 20, endMeters: 40, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
    { carNumber: 3, startMeters: 40, endMeters: 60, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
  ],
};

// 反転編成（3号車編成、x=0に近い側が最終号車。茗荷谷2番線・丸ノ内線相当）。
// carNumber昇順でstartMetersが減少する。境界共有は非反転と逆側のフィールド
// （cars[i].startMeters === cars[i+1].endMeters）
const reversedPattern: LayoutStopPatternDTO = {
  patternId: 'pattern-2',
  trainId: 'train-2',
  trainLabel: '東京メトロ丸ノ内線',
  carCount: 3,
  cars: [
    { carNumber: 1, startMeters: 40, endMeters: 60, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
    { carNumber: 2, startMeters: 20, endMeters: 40, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
    { carNumber: 3, startMeters: 0, endMeters: 20, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
  ],
};

// 2アクセス点・1設備・1乗換を持つコンコース
const concourse: LayoutConcourseDTO = {
  id: 'concourse-1',
  exits: 'A3出口',
  notes: '仮設階段あり',
  cells: [
    {
      id: 'cell-1',
      xPositionMeters: 10,
      facilities: [
        {
          id: 'facility-1', typeCode: 'elevator', typeName: 'エレベーター',
          isWheelchairAccessible: true, isStrollerAccessible: null, notes: '朝は使用不可',
        },
      ],
    },
    { id: 'cell-2', xPositionMeters: null, facilities: [] },
  ],
  connections: [
    {
      stationName: '渋谷', connectedStationId: 'station-shibuya', connectedPlatformId: 'platform-shibuya-1',
      directionId: 'direction-1', lineNames: ['田園都市線'], lineColors: ['#00A650'],
      directionName: '渋谷方面', exitLabel: 'A3', xRangeStart: 5, xRangeEnd: 15,
    },
  ],
};

describe('createConcourseDraft', () => {
  it('server DTOをexits/notes/cells/connectionsを持つdraftに変換する', () => {
    expect(createConcourseDraft(concourse)).toEqual({
      exits: 'A3出口',
      notes: '仮設階段あり',
      cells: [
        {
          id: 'cell-1',
          xPositionMeters: 10,
          facilities: [
            { typeCode: 'elevator', isWheelchairAccessible: true, isStrollerAccessible: null, notes: '朝は使用不可' },
          ],
        },
        { id: 'cell-2', xPositionMeters: null, facilities: [] },
      ],
      connections: [
        {
          stationId: 'station-shibuya', connectedPlatformId: 'platform-shibuya-1', directionId: 'direction-1',
          exitLabel: 'A3', xRangeStart: 5, xRangeEnd: 15,
        },
      ],
    });
  });
});

describe('createEmptyConcourseDraft', () => {
  it('exits/notesがnull、cells/connectionsが空のdraftを作る', () => {
    expect(createEmptyConcourseDraft()).toEqual({ exits: null, notes: null, cells: [], connections: [] });
  });
});

describe('duplicateConcourseDraft', () => {
  it('座標を持つセルはoffsetMetersぶんずらし、座標を持たないセルはnullのままコピーする', () => {
    let counter = 0;
    const next = duplicateConcourseDraft(concourse, 2, () => `dup-${counter++}`);

    expect(next.exits).toBe('A3出口');
    expect(next.notes).toBe('仮設階段あり');
    expect(next.cells).toEqual([
      {
        id: 'dup-0',
        xPositionMeters: 12, // 10 + 2
        facilities: [
          { typeCode: 'elevator', isWheelchairAccessible: true, isStrollerAccessible: null, notes: '朝は使用不可' },
        ],
      },
      { id: 'dup-1', xPositionMeters: null, facilities: [] },
    ]);
    expect(next.connections).toEqual(createConcourseDraft(concourse).connections);
  });
});

describe('createPatternDraft', () => {
  it('server DTOのcarsをcarNumber昇順のdraftに変換する', () => {
    expect(createPatternDraft(pattern)).toEqual({
      cars: [
        { carNumber: 1, startMeters: 0, endMeters: 20 },
        { carNumber: 2, startMeters: 20, endMeters: 40 },
        { carNumber: 3, startMeters: 40, endMeters: 60 },
      ],
    });
  });
});

describe('createPatternDraftFromPreview', () => {
  it('buildCarSegments()相当の配列をcarNumber昇順のdraftに変換する', () => {
    const segments = [
      { carNumber: 2, startMeters: 20, endMeters: 40 },
      { carNumber: 1, startMeters: 0, endMeters: 20 },
    ];
    expect(createPatternDraftFromPreview(segments)).toEqual({
      cars: [
        { carNumber: 1, startMeters: 0, endMeters: 20 },
        { carNumber: 2, startMeters: 20, endMeters: 40 },
      ],
    });
  });
});

describe('setConcourseField', () => {
  it('exitsを更新する', () => {
    const draft = createConcourseDraft(concourse);
    expect(setConcourseField(draft, 'exits', 'B2出口').exits).toBe('B2出口');
  });

  it('notesをnullに戻せる', () => {
    const draft = createConcourseDraft(concourse);
    expect(setConcourseField(draft, 'notes', null).notes).toBeNull();
  });
});

describe('moveCell', () => {
  it('指定したcellのxPositionMetersだけを更新する', () => {
    const draft = createConcourseDraft(concourse);
    const next = moveCell(draft, 'cell-1', 12.5);

    expect(next.cells.find((c) => c.id === 'cell-1')?.xPositionMeters).toBe(12.5);
    expect(next.cells.find((c) => c.id === 'cell-2')?.xPositionMeters).toBeNull();
  });

  it('存在しないcellIdを渡しても無変更で返す', () => {
    const draft = createConcourseDraft(concourse);
    expect(moveCell(draft, 'not-exist', 1)).toEqual(draft);
  });
});

describe('addCell / removeCell', () => {
  it('addCellは座標未入力・設備なしのセルを追加する', () => {
    const draft = createConcourseDraft(concourse);
    const next = addCell(draft, 'cell-new');
    expect(next.cells).toHaveLength(3);
    expect(next.cells.at(-1)).toEqual({ id: 'cell-new', xPositionMeters: null, facilities: [] });
  });

  it('removeCellは指定したセルだけを取り除く', () => {
    const draft = createConcourseDraft(concourse);
    const next = removeCell(draft, 'cell-2');
    expect(next.cells.map((c) => c.id)).toEqual(['cell-1']);
  });
});

describe('addCellFacility / removeCellFacility / updateCellFacility', () => {
  it('addCellFacilityは既定値（車いす・ベビーカーとも対応、メモなし）で追加する', () => {
    const draft = createConcourseDraft(concourse);
    const next = addCellFacility(draft, 'cell-2', 'stairs');
    const cell2 = next.cells.find((c) => c.id === 'cell-2')!;
    expect(cell2.facilities).toEqual([
      { typeCode: 'stairs', isWheelchairAccessible: true, isStrollerAccessible: true, notes: null },
    ]);
  });

  it('addCellFacilityは同じtypeCodeが既にあれば無変更で返す', () => {
    const draft = createConcourseDraft(concourse);
    const next = addCellFacility(draft, 'cell-1', 'elevator');
    expect(next).toEqual(draft);
  });

  it('removeCellFacilityは指定したtypeCodeだけを取り除く', () => {
    const draft = createConcourseDraft(concourse);
    const next = removeCellFacility(draft, 'cell-1', 'elevator');
    expect(next.cells.find((c) => c.id === 'cell-1')?.facilities).toEqual([]);
  });

  it('updateCellFacilityは指定したフィールドだけをマージする', () => {
    const draft = createConcourseDraft(concourse);
    const next = updateCellFacility(draft, 'cell-1', 'elevator', { isStrollerAccessible: false });
    const facility = next.cells.find((c) => c.id === 'cell-1')?.facilities[0];
    expect(facility).toEqual({
      typeCode: 'elevator', isWheelchairAccessible: true, isStrollerAccessible: false, notes: '朝は使用不可',
    });
  });
});

describe('setConnection / removeConnection', () => {
  it('setConnectionは既存のstationIdの内容をpatchでマージする', () => {
    const draft = createConcourseDraft(concourse);
    const next = setConnection(draft, 'station-shibuya', { exitLabel: 'A4' });
    expect(next.connections).toEqual([
      {
        stationId: 'station-shibuya', connectedPlatformId: 'platform-shibuya-1', directionId: 'direction-1',
        exitLabel: 'A4', xRangeStart: 5, xRangeEnd: 15,
      },
    ]);
  });

  it('setConnectionは未登録のstationIdなら既定値＋patchで新規追加する', () => {
    const draft = createConcourseDraft(concourse);
    const next = setConnection(draft, 'station-omotesando', { connectedPlatformId: 'platform-omotesando-1' });
    expect(next.connections).toContainEqual({
      stationId: 'station-omotesando', connectedPlatformId: 'platform-omotesando-1', directionId: null,
      exitLabel: null, xRangeStart: null, xRangeEnd: null,
    });
  });

  it('removeConnectionは指定したstationIdだけを取り除く', () => {
    const draft = createConcourseDraft(concourse);
    const next = removeConnection(draft, 'station-shibuya');
    expect(next.connections).toEqual([]);
  });
});

describe('moveCarBoundary', () => {
  it('境界を動かすと隣接号車のend/startが同値で連動する', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarBoundary(draft, 0, 22, { minCarMeters: MIN_CAR_METERS });

    const car1 = next.cars.find((c) => c.carNumber === 1)!;
    const car2 = next.cars.find((c) => c.carNumber === 2)!;
    expect(car1.endMeters).toBe(22);
    expect(car2.startMeters).toBe(22);
    expect(car1.endMeters).toBe(car2.startMeters); // 不変条件そのもの
  });

  it('他の号車には影響しない', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarBoundary(draft, 0, 22, { minCarMeters: MIN_CAR_METERS });
    const car3 = next.cars.find((c) => c.carNumber === 3)!;
    expect(car3).toEqual({ carNumber: 3, startMeters: 40, endMeters: 60 });
  });

  it('右の号車をminCarMeters未満に潰す位置へはクランプされる', () => {
    const draft = createPatternDraft(pattern);
    // 2-3号車境界(40)を59.8へ動かそうとすると3号車が0.2mになってしまう
    const next = moveCarBoundary(draft, 1, 59.8, { minCarMeters: MIN_CAR_METERS });
    const car2 = next.cars.find((c) => c.carNumber === 2)!;
    const car3 = next.cars.find((c) => c.carNumber === 3)!;
    expect(car2.endMeters).toBe(60 - MIN_CAR_METERS);
    expect(car3.startMeters).toBe(60 - MIN_CAR_METERS);
  });

  it('左の号車をminCarMeters未満に潰す位置へはクランプされる', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarBoundary(draft, 0, 0.2, { minCarMeters: MIN_CAR_METERS });
    const car1 = next.cars.find((c) => c.carNumber === 1)!;
    expect(car1.endMeters).toBe(MIN_CAR_METERS);
  });

  it('範囲外のboundaryIndexは無変更で返す（両端は moveCarEdge を使う）', () => {
    const draft = createPatternDraft(pattern);
    expect(moveCarBoundary(draft, -1, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
    expect(moveCarBoundary(draft, 2, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
  });

  it('重なりを許容しない: どの入力でも隣接ペアのend===startが崩れない', () => {
    const draft = createPatternDraft(pattern);
    for (const x of [-100, 0, 19.9, 20, 20.1, 100]) {
      const next = moveCarBoundary(draft, 0, x, { minCarMeters: MIN_CAR_METERS });
      const car1 = next.cars.find((c) => c.carNumber === 1)!;
      const car2 = next.cars.find((c) => c.carNumber === 2)!;
      expect(car1.endMeters).toBe(car2.startMeters);
    }
  });

  describe('反転編成（carNumber昇順でxが減少する編成）', () => {
    it('境界を動かすと隣接号車のstart/endが同値で連動する（非反転と共有フィールドが逆）', () => {
      const draft = createPatternDraft(reversedPattern);
      const next = moveCarBoundary(draft, 0, 35, { minCarMeters: MIN_CAR_METERS });

      const car1 = next.cars.find((c) => c.carNumber === 1)!;
      const car2 = next.cars.find((c) => c.carNumber === 2)!;
      expect(car1.startMeters).toBe(35);
      expect(car2.endMeters).toBe(35);
      expect(car1.startMeters).toBe(car2.endMeters); // 反転側の不変条件
      expect(car1.endMeters).toBe(60); // 動かしていない側は不変
      expect(car2.startMeters).toBe(20);
    });

    it('他の号車には影響しない', () => {
      const draft = createPatternDraft(reversedPattern);
      const next = moveCarBoundary(draft, 0, 35, { minCarMeters: MIN_CAR_METERS });
      const car3 = next.cars.find((c) => c.carNumber === 3)!;
      expect(car3).toEqual({ carNumber: 3, startMeters: 0, endMeters: 20 });
    });

    it('クランプされる（右の号車＝carNumberが大きい側を潰す方向）', () => {
      const draft = createPatternDraft(reversedPattern);
      // 境界(40)を19.8へ動かそうとするとcar2が0.2mになってしまう
      const next = moveCarBoundary(draft, 0, 19.8, { minCarMeters: MIN_CAR_METERS });
      const car1 = next.cars.find((c) => c.carNumber === 1)!;
      const car2 = next.cars.find((c) => c.carNumber === 2)!;
      expect(car2.endMeters).toBe(20 + MIN_CAR_METERS);
      expect(car1.startMeters).toBe(20 + MIN_CAR_METERS);
    });

    it('重なりを許容しない: どの入力でも隣接ペアのstart===endが崩れない', () => {
      const draft = createPatternDraft(reversedPattern);
      for (const x of [-100, 0, 39.9, 40, 40.1, 100]) {
        const next = moveCarBoundary(draft, 0, x, { minCarMeters: MIN_CAR_METERS });
        const car1 = next.cars.find((c) => c.carNumber === 1)!;
        const car2 = next.cars.find((c) => c.carNumber === 2)!;
        expect(car1.startMeters).toBe(car2.endMeters);
      }
    });
  });
});

describe('moveCarEdge', () => {
  it('1号車のstart（編成の左端）を単独で動かせる', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarEdge(draft, { carNumber: 1, side: 'start' }, -5, { minCarMeters: MIN_CAR_METERS });
    const car1 = next.cars.find((c) => c.carNumber === 1)!;
    expect(car1.startMeters).toBe(-5);
    expect(car1.endMeters).toBe(20); // end は動かない
  });

  it('最終号車のend（編成の右端）を単独で動かせる', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarEdge(draft, { carNumber: 3, side: 'end' }, 65, { minCarMeters: MIN_CAR_METERS });
    const car3 = next.cars.find((c) => c.carNumber === 3)!;
    expect(car3.endMeters).toBe(65);
    expect(car3.startMeters).toBe(40);
  });

  it('内側の号車の境界を指定すると無変更で返す', () => {
    const draft = createPatternDraft(pattern);
    expect(moveCarEdge(draft, { carNumber: 2, side: 'start' }, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
    expect(moveCarEdge(draft, { carNumber: 1, side: 'end' }, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
  });

  it('号車を潰す位置へはクランプされる', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarEdge(draft, { carNumber: 1, side: 'start' }, 19.9, { minCarMeters: MIN_CAR_METERS });
    expect(next.cars.find((c) => c.carNumber === 1)!.startMeters).toBe(20 - MIN_CAR_METERS);
  });

  describe('反転編成（carNumber昇順でxが減少する編成）', () => {
    it('1号車のend（編成の右端）を単独で動かせる（非反転と自由端が逆）', () => {
      const draft = createPatternDraft(reversedPattern);
      const next = moveCarEdge(draft, { carNumber: 1, side: 'end' }, 65, { minCarMeters: MIN_CAR_METERS });
      const car1 = next.cars.find((c) => c.carNumber === 1)!;
      expect(car1.endMeters).toBe(65);
      expect(car1.startMeters).toBe(40); // start は動かない（内側境界のため）
    });

    it('最終号車のstart（編成の左端）を単独で動かせる', () => {
      const draft = createPatternDraft(reversedPattern);
      const next = moveCarEdge(draft, { carNumber: 3, side: 'start' }, -5, { minCarMeters: MIN_CAR_METERS });
      const car3 = next.cars.find((c) => c.carNumber === 3)!;
      expect(car3.startMeters).toBe(-5);
      expect(car3.endMeters).toBe(20);
    });

    it('非反転側の自由端（1号車のstart・最終号車のend）を指定すると無変更で返す（反転時は内側境界のため）', () => {
      const draft = createPatternDraft(reversedPattern);
      expect(moveCarEdge(draft, { carNumber: 1, side: 'start' }, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
      expect(moveCarEdge(draft, { carNumber: 3, side: 'end' }, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
    });
  });
});

describe('isConcourseDirty', () => {
  it('未変更のdraftはdirtyでない', () => {
    expect(isConcourseDirty(concourse, createConcourseDraft(concourse))).toBe(false);
  });

  it('xPositionMetersを変更するとdirtyになる', () => {
    const draft = moveCell(createConcourseDraft(concourse), 'cell-1', 11);
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });

  it('cell件数が変わるとdirtyになる', () => {
    const draft = createConcourseDraft(concourse);
    expect(isConcourseDirty(concourse, { ...draft, cells: draft.cells.slice(0, 1) })).toBe(true);
  });

  it('exitsを変更するとdirtyになる', () => {
    const draft = setConcourseField(createConcourseDraft(concourse), 'exits', 'B2出口');
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });

  it('notesを変更するとdirtyになる', () => {
    const draft = setConcourseField(createConcourseDraft(concourse), 'notes', null);
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });

  it('設備の属性を変更するとdirtyになる', () => {
    const draft = updateCellFacility(createConcourseDraft(concourse), 'cell-1', 'elevator', { notes: '使用可能' });
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });

  it('設備を追加するとdirtyになる', () => {
    const draft = addCellFacility(createConcourseDraft(concourse), 'cell-2', 'stairs');
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });

  it('乗換先を変更するとdirtyになる', () => {
    const draft = setConnection(createConcourseDraft(concourse), 'station-shibuya', { exitLabel: 'A4' });
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });

  it('乗換先の件数が変わるとdirtyになる', () => {
    const draft = removeConnection(createConcourseDraft(concourse), 'station-shibuya');
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });

  it('新規セル（サーバーに存在しないid）を追加するとdirtyになる', () => {
    const draft = addCell(createConcourseDraft(concourse), 'cell-new');
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });
});

describe('isPatternDirty', () => {
  it('未変更のdraftはdirtyでない', () => {
    expect(isPatternDirty(pattern, createPatternDraft(pattern))).toBe(false);
  });

  it('境界を動かすとdirtyになる', () => {
    const draft = moveCarBoundary(createPatternDraft(pattern), 0, 22, { minCarMeters: MIN_CAR_METERS });
    expect(isPatternDirty(pattern, draft)).toBe(true);
  });
});

describe('toPlatformLocationPayload', () => {
  it('draft単体からペイロードを組み立てる（exits/notes/facilities/connectionsを含む）', () => {
    const draft = moveCell(createConcourseDraft(concourse), 'cell-1', 12.5);
    const payload = toPlatformLocationPayload('platform-1', draft);

    expect(payload).toEqual({
      platformId: 'platform-1',
      exits: 'A3出口',
      notes: '仮設階段あり',
      cells: [
        {
          xPositionMeters: 12.5,
          facilities: [
            {
              typeCode: 'elevator',
              isWheelchairAccessible: true,
              isStrollerAccessible: null, // null が true に化けない（D6）
              notes: '朝は使用不可',
            },
          ],
        },
        { xPositionMeters: null, facilities: [] },
      ],
      connections: [
        {
          stationId: 'station-shibuya',
          connectedPlatformId: 'platform-shibuya-1',
          directionId: 'direction-1',
          exitLabel: 'A3',
          xRangeStart: 5,
          xRangeEnd: 15,
        },
      ],
    });
  });

  it('新規コンコース（createEmptyConcourseDraft起点）でもペイロードを組み立てられる', () => {
    let counter = 0;
    const draft = addCellFacility(
      addCell(setConcourseField(createEmptyConcourseDraft(), 'exits', 'C1出口'), `new-${counter++}`),
      'new-0',
      'elevator',
    );
    const payload = toPlatformLocationPayload('platform-1', draft);
    expect(payload).toEqual({
      platformId: 'platform-1',
      exits: 'C1出口',
      notes: null,
      cells: [
        {
          xPositionMeters: null,
          facilities: [{ typeCode: 'elevator', isWheelchairAccessible: true, isStrollerAccessible: true, notes: null }],
        },
      ],
      connections: [],
    });
  });
});

describe('toStopPatternPayload', () => {
  it('platformId・trainId・全号車のcarNumber順ペイロードを組み立てる', () => {
    const draft = moveCarBoundary(createPatternDraft(pattern), 0, 22, { minCarMeters: MIN_CAR_METERS });
    const payload = toStopPatternPayload('platform-1', pattern.trainId, draft);

    expect(payload).toEqual({
      platformId: 'platform-1',
      trainId: 'train-1',
      cars: [
        { carNumber: 1, startMeters: 0, endMeters: 22 },
        { carNumber: 2, startMeters: 22, endMeters: 40 },
        { carNumber: 3, startMeters: 40, endMeters: 60 },
      ],
    });
  });
});

describe('draftToDisplayConcourse', () => {
  const lookups = {
    facilityTypeName: (code: string) => (code === 'elevator' ? 'エレベーター' : code),
    connectedStation: (stationId: string) => (
      stationId === 'station-shibuya'
        ? {
          name: '渋谷',
          lines: [{ name: '田園都市線', color: '#00A650' }],
          directions: [{ id: 'direction-1', displayName: '渋谷方面' }],
        }
        : undefined
    ),
  };

  it('既存コンコースのdraftを表示用DTOに戻せる（facilities.idは合成id）', () => {
    const draft = createConcourseDraft(concourse);
    const dto = draftToDisplayConcourse('concourse-1', draft, lookups);

    expect(dto).toEqual({
      id: 'concourse-1',
      exits: 'A3出口',
      notes: '仮設階段あり',
      cells: [
        {
          id: 'cell-1',
          xPositionMeters: 10,
          facilities: [
            {
              id: 'cell-1:elevator', typeCode: 'elevator', typeName: 'エレベーター',
              isWheelchairAccessible: true, isStrollerAccessible: null, notes: '朝は使用不可',
            },
          ],
        },
        { id: 'cell-2', xPositionMeters: null, facilities: [] },
      ],
      connections: [
        {
          connectedStationId: 'station-shibuya', connectedPlatformId: 'platform-shibuya-1', directionId: 'direction-1',
          stationName: '渋谷', lineNames: ['田園都市線'], lineColors: ['#00A650'],
          directionName: '渋谷方面', exitLabel: 'A3', xRangeStart: 5, xRangeEnd: 15,
        },
      ],
    });
  });

  it('lookupで解決できない接続先はstationName空文字・directionName nullにフォールバックする', () => {
    const draft = setConnection(createEmptyConcourseDraft(), 'station-unknown', { exitLabel: 'X1' });
    const dto = draftToDisplayConcourse('concourse-new', draft, lookups);
    expect(dto.connections).toEqual([
      {
        connectedStationId: 'station-unknown', connectedPlatformId: null, directionId: null,
        stationName: '', lineNames: [], lineColors: [], directionName: null,
        exitLabel: 'X1', xRangeStart: null, xRangeEnd: null,
      },
    ]);
  });
});
