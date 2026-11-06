import { describe, it, expect } from 'vitest';
import {
  createConcourseDraft, createEmptyConcourseDraft, duplicateConcourseDraft,
  createPatternDraft, createPatternDraftFromPreview,
  setConcourseField, moveCell, addCell, removeCell,
  addCellFacility, removeCellFacility,
  setConnection, removeConnection,
  shiftConsistByEdge, reverseConsist,
  isConcourseDirty, isPatternDirty, toPlatformLocationPayload, toStopPatternPayload,
  draftToDisplayConcourse,
} from './editDraft';
import type { LayoutConcourseDTO, LayoutStopPatternDTO } from '@/features/station-layout/ports';

// 3号車編成。境界は 20 と 40（1-2号車間、2-3号車間）
const pattern: LayoutStopPatternDTO = {
  patternId: 'pattern-1',
  trainId: 'train-1',
  trainLabel: '東京メトロ銀座線',
  carCount: 3,
  carNumbersAscendToward: 'plusX',
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
  carNumbersAscendToward: 'minusX',
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
        },
      ],
    },
    { id: 'cell-2', xPositionMeters: null, facilities: [] },
  ],
  connections: [
    {
      connectedStationId: 'station-shibuya', connectedPlatformId: 'platform-shibuya-1',
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
            { typeCode: 'elevator' },
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
          { typeCode: 'elevator' },
        ],
      },
      { id: 'dup-1', xPositionMeters: null, facilities: [] },
    ]);
    expect(next.connections).toEqual([
      {
        stationId: 'station-shibuya', connectedPlatformId: 'platform-shibuya-1', directionId: 'direction-1',
        exitLabel: 'A3', xRangeStart: 7, xRangeEnd: 17, // 5+2 / 15+2。セルと同じ自ホーム座標系のためずれてはならない
      },
    ]);
  });

  it('xRangeStart/xRangeEndがnullの乗換はnullのままコピーする', () => {
    const concourseWithoutRange: LayoutConcourseDTO = {
      ...concourse,
      connections: [{ ...concourse.connections[0]!, xRangeStart: null, xRangeEnd: null }],
    };
    let counter = 0;
    const next = duplicateConcourseDraft(concourseWithoutRange, 2, () => `dup-${counter++}`);
    expect(next.connections[0]!.xRangeStart).toBeNull();
    expect(next.connections[0]!.xRangeEnd).toBeNull();
  });
});

describe('createPatternDraft', () => {
  it('server DTOのcarsをcarNumber昇順のdraftに変換する', () => {
    expect(createPatternDraft(pattern)).toEqual({
      ascendToward: 'plusX',
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
    expect(createPatternDraftFromPreview(segments, 'plusX')).toEqual({
      ascendToward: 'plusX',
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

describe('addCellFacility / removeCellFacility', () => {
  it('addCellFacilityは設備の種類だけを追加する', () => {
    const draft = createConcourseDraft(concourse);
    const next = addCellFacility(draft, 'cell-2', 'stairs');
    const cell2 = next.cells.find((c) => c.id === 'cell-2')!;
    expect(cell2.facilities).toEqual([
      { typeCode: 'stairs' },
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

describe('shiftConsistByEdge', () => {
  const spans = (draft: { cars: { carNumber: number; startMeters: number; endMeters: number }[] }) =>
    [...draft.cars].sort((a, b) => a.carNumber - b.carNumber).map((c) => [c.startMeters, c.endMeters]);
  // 範囲の制限が掛からない既存ケース用
  const wideRange = { minX: -1000, maxX: 1000 };

  it('1号車のstart（編成の左端）を動かすと、全号車が同じだけ動く', () => {
    const next = shiftConsistByEdge(createPatternDraft(pattern), { carNumber: 1, side: 'start' }, -5, { range: wideRange });
    expect(spans(next)).toEqual([[-5, 15], [15, 35], [35, 55]]);
  });

  it('最終号車のend（編成の右端）を動かすと、全号車が同じだけ動く', () => {
    const next = shiftConsistByEdge(createPatternDraft(pattern), { carNumber: 3, side: 'end' }, 65, { range: wideRange });
    expect(spans(next)).toEqual([[5, 25], [25, 45], [45, 65]]);
  });

  it('内側の号車の境界を指定すると無変更で返す', () => {
    const draft = createPatternDraft(pattern);
    expect(shiftConsistByEdge(draft, { carNumber: 2, side: 'start' }, 10, { range: wideRange })).toEqual(draft);
    expect(shiftConsistByEdge(draft, { carNumber: 1, side: 'end' }, 10, { range: wideRange })).toEqual(draft);
  });

  it('小数の差分でも浮動小数の誤差を残さず、境界の共有が保たれる', () => {
    const next = shiftConsistByEdge(createPatternDraft(pattern), { carNumber: 1, side: 'start' }, 0.1, { range: wideRange });
    expect(spans(next)).toEqual([[0.1, 20.1], [20.1, 40.1], [40.1, 60.1]]);
  });

  describe('反転編成（carNumber昇順でxが減少する編成）', () => {
    it('1号車のend（編成の右端）を動かすと、全号車が同じだけ動く（非反転と自由端が逆）', () => {
      const next = shiftConsistByEdge(createPatternDraft(reversedPattern), { carNumber: 1, side: 'end' }, 65, { range: wideRange });
      expect(spans(next)).toEqual([[45, 65], [25, 45], [5, 25]]);
    });

    it('最終号車のstart（編成の左端）を動かすと、全号車が同じだけ動く', () => {
      const next = shiftConsistByEdge(createPatternDraft(reversedPattern), { carNumber: 3, side: 'start' }, -5, { range: wideRange });
      expect(spans(next)).toEqual([[35, 55], [15, 35], [-5, 15]]);
    });

    it('非反転側の自由端（1号車のstart・最終号車のend）を指定すると無変更で返す（反転時は内側境界のため）', () => {
      const draft = createPatternDraft(reversedPattern);
      expect(shiftConsistByEdge(draft, { carNumber: 1, side: 'start' }, 10, { range: wideRange })).toEqual(draft);
      expect(shiftConsistByEdge(draft, { carNumber: 3, side: 'end' }, 10, { range: wideRange })).toEqual(draft);
    });

    it('反転編成でも、反対側の外端が range を越えないよう差分を抑える', () => {
      // 最終号車のstart（左端、0m）を右へ引いても、1号車のend（右端、60m）は maxX=70 で止まる
      const next = shiftConsistByEdge(
        createPatternDraft(reversedPattern), { carNumber: 3, side: 'start' }, 50, { range: { minX: -5, maxX: 70 } },
      );
      expect(spans(next)).toEqual([[50, 70], [30, 50], [10, 30]]);
    });
  });

  describe('range による制限（#201 レビュー）', () => {
    const range = { minX: -5, maxX: 70 };

    it('最終号車の末尾を左へ大きく引いても、編成全体が range の左端で止まる', () => {
      // 末尾だけを range に収めると、1号車の先頭が -65 まで出てしまう
      const next = shiftConsistByEdge(createPatternDraft(pattern), { carNumber: 3, side: 'end' }, -5, { range });
      expect(spans(next)).toEqual([[-5, 15], [15, 35], [35, 55]]);
    });

    it('1号車の先頭を右へ大きく引いても、編成全体が range の右端で止まる', () => {
      const next = shiftConsistByEdge(createPatternDraft(pattern), { carNumber: 1, side: 'start' }, 50, { range });
      expect(spans(next)).toEqual([[10, 30], [30, 50], [50, 70]]);
    });

    it('decimal(6,2) の上限を range にすると、数値入力の大きな値でも最終号車の end が上限で止まる', () => {
      const next = shiftConsistByEdge(
        createPatternDraft(pattern), { carNumber: 1, side: 'start' }, 9990, { range: { minX: -9999.99, maxX: 9999.99 } },
      );
      expect(spans(next)).toEqual([[9939.99, 9959.99], [9959.99, 9979.99], [9979.99, 9999.99]]);
    });

    it('編成が range の外にはみ出している間は、range へ近づく向きにだけ動かせる', () => {
      // 新規作成中の停車パターンは bounds に含まれないため、range の外から始まり得る
      const outside = { minX: 10, maxX: 100 };
      const draft = createPatternDraft(pattern);
      expect(shiftConsistByEdge(draft, { carNumber: 1, side: 'start' }, -20, { range: outside })).toEqual(draft);
      const next = shiftConsistByEdge(draft, { carNumber: 1, side: 'start' }, 30, { range: outside });
      expect(spans(next)).toEqual([[30, 50], [50, 70], [70, 90]]);
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

describe('reverseConsist', () => {
  const spans = (draft: { cars: { carNumber: number; startMeters: number; endMeters: number }[] }) =>
    [...draft.cars].sort((a, b) => a.carNumber - b.carNumber).map((c) => [c.startMeters, c.endMeters]);

  it('編成が占める区間を保ったまま、号車番号の並びと向きを逆にする（plusX → minusX）', () => {
    const next = reverseConsist(createPatternDraft(pattern));
    expect(next.ascendToward).toBe('minusX');
    expect(spans(next)).toEqual([[40, 60], [20, 40], [0, 20]]);
  });

  it('minusX → plusX', () => {
    const next = reverseConsist(createPatternDraft(reversedPattern));
    expect(next.ascendToward).toBe('plusX');
    expect(spans(next)).toEqual([[0, 20], [20, 40], [40, 60]]);
  });

  it('号車の長さが違う編成でも、各号車の長さと占める区間を保つ', () => {
    const draft = createPatternDraftFromPreview([
      { carNumber: 1, startMeters: 10, endMeters: 35.5 },
      { carNumber: 2, startMeters: 35.5, endMeters: 53.5 },
    ], 'plusX');
    expect(spans(reverseConsist(draft))).toEqual([[28, 53.5], [10, 28]]);
  });

  it('2回反転すると元に戻る', () => {
    const draft = createPatternDraft(reversedPattern);
    expect(reverseConsist(reverseConsist(draft))).toEqual(draft);
  });

  it('保存では、反転後の1号車の外側の端を基準点にする', () => {
    const payload = toStopPatternPayload('platform-1', 'train-1', reverseConsist(createPatternDraft(pattern)));
    expect(payload).toMatchObject({ carOneOuterMeters: 60, carNumbersAscendToward: 'minusX' });
  });
});

describe('isPatternDirty', () => {
  it('未変更のdraftはdirtyでない', () => {
    expect(isPatternDirty(pattern, createPatternDraft(pattern))).toBe(false);
  });

  it('向きだけを反転してもdirtyになる（1両の編成は区間が変わらない）', () => {
    const oneCar: LayoutStopPatternDTO = { ...pattern, carCount: 1, cars: [pattern.cars[0]!] };
    expect(isPatternDirty(oneCar, reverseConsist(createPatternDraft(oneCar)))).toBe(true);
  });

  it('編成を動かすとdirtyになる', () => {
    const draft = shiftConsistByEdge(createPatternDraft(pattern), { carNumber: 1, side: 'start' }, 2, { range: { minX: -100, maxX: 100 } });
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
            { typeCode: 'elevator' },
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
          facilities: [{ typeCode: 'elevator' }],
        },
      ],
      connections: [],
    });
  });
});

describe('toStopPatternPayload', () => {
  const wideRange = { range: { minX: -100, maxX: 100 } };

  it('号車の区間ではなく、1号車の外側の端と向きを送る（plusX は1号車の start）', () => {
    const draft = shiftConsistByEdge(createPatternDraft(pattern), { carNumber: 1, side: 'start' }, 2.5, wideRange);
    expect(toStopPatternPayload('platform-1', pattern.trainId, draft)).toEqual({
      platformId: 'platform-1',
      trainId: 'train-1',
      carOneOuterMeters: 2.5,
      carNumbersAscendToward: 'plusX',
    });
  });

  it('minusX は1号車の end を基準点にする', () => {
    const draft = shiftConsistByEdge(createPatternDraft(reversedPattern), { carNumber: 3, side: 'start' }, 5, wideRange);
    expect(toStopPatternPayload('platform-1', reversedPattern.trainId, draft)).toEqual({
      platformId: 'platform-1',
      trainId: 'train-2',
      carOneOuterMeters: 65,
      carNumbersAscendToward: 'minusX',
    });
  });

  it('1号車が無い draft は基準点を戻せないので null を返す（例外を投げない）', () => {
    const draft = createPatternDraft({
      carNumbersAscendToward: 'plusX',
      cars: pattern.cars.filter((c) => c.carNumber !== 1),
    });
    expect(toStopPatternPayload('platform-1', pattern.trainId, draft)).toBeNull();
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
            },
          ],
        },
        { id: 'cell-2', xPositionMeters: null, facilities: [] },
      ],
      connections: [
        {
          connectedStationId: 'station-shibuya', connectedPlatformId: 'platform-shibuya-1', directionId: 'direction-1',
          lineNames: ['田園都市線'], lineColors: ['#00A650'],
          directionName: '渋谷方面', exitLabel: 'A3', xRangeStart: 5, xRangeEnd: 15,
        },
      ],
    });
  });

  it('lookupで解決できない接続先はlineNames空・directionName nullにフォールバックする', () => {
    const draft = setConnection(createEmptyConcourseDraft(), 'station-unknown', { exitLabel: 'X1' });
    const dto = draftToDisplayConcourse('concourse-new', draft, lookups);
    expect(dto.connections).toEqual([
      {
        connectedStationId: 'station-unknown', connectedPlatformId: null, directionId: null,
        lineNames: [], lineColors: [], directionName: null,
        exitLabel: 'X1', xRangeStart: null, xRangeEnd: null,
      },
    ]);
  });
});
