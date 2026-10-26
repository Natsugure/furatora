import { describe, it, expect } from 'vitest';
import { trainSchema } from './schema';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('trainSchema', () => {
  it('必須フィールドで正常にパースされる', () => {
    const result = trainSchema.safeParse({
      name: 'E235系',
      operatorId: VALID_UUID,
      lineIds: [VALID_UUID],
      carCount: 11,
    });
    expect(result.success).toBe(true);
  });

  it('nameがない場合は失敗する', () => {
    const result = trainSchema.safeParse({
      operatorId: VALID_UUID,
      lineIds: [],
      carCount: 10,
    });
    expect(result.success).toBe(false);
  });

  it('operatorIdがUUIDでない場合は失敗する', () => {
    const result = trainSchema.safeParse({
      name: 'E235系',
      operatorId: 'not-a-uuid',
      lineIds: [],
      carCount: 10,
    });
    expect(result.success).toBe(false);
  });

  it('carCountが0以下の場合は失敗する', () => {
    const result = trainSchema.safeParse({
      name: 'E235系',
      operatorId: VALID_UUID,
      lineIds: [],
      carCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('carStructureにcarLengthを指定して正常にパースされる', () => {
    const result = trainSchema.safeParse({
      name: 'E235系',
      operatorId: VALID_UUID,
      lineIds: [VALID_UUID],
      carCount: 11,
      carStructure: [{ carNumber: 1, doorCount: 4, carLength: 19.5 }],
    });
    expect(result.success).toBe(true);
  });

  it('carStructureのcarLengthを省略しても正常にパースされる（未指定時は標準値を使う）', () => {
    const result = trainSchema.safeParse({
      name: 'E235系',
      operatorId: VALID_UUID,
      lineIds: [VALID_UUID],
      carCount: 11,
      carStructure: [{ carNumber: 1, doorCount: 4 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('trainSchema の UUID（#160）', () => {
  const UPPER = '550e8400-e29b-41d4-a716-4466554400AB';
  const LOWER = '550e8400-e29b-41d4-a716-4466554400ab';

  it('大文字の UUID を小文字にして返す', () => {
    const result = trainSchema.parse({ name: 'E235系', operatorId: UPPER, lineIds: [UPPER], carCount: 11 });
    expect(result).toMatchObject({ operatorId: LOWER, lineIds: [LOWER] });
  });
});

describe('trainSchema の設備のドア番号（#194）', () => {
  const base = {
    name: 'E235系',
    operatorId: VALID_UUID,
    lineIds: [VALID_UUID],
    carCount: 2,
    carStructure: [{ carNumber: 1, doorCount: 4 }, { carNumber: 2, doorCount: 4 }],
  };

  it('ドア番号が号車のドア数の範囲内なら通る', () => {
    const result = trainSchema.safeParse({
      ...base,
      freeSpaces: [{ carNumber: 1, nearDoor: 4, isStandard: true }],
      prioritySeats: [{ carNumber: 2, nearDoor: 1, isStandard: true }],
    });
    expect(result.success).toBe(true);
  });

  it('フリースペースのドア番号が範囲外なら失敗し、その行の nearDoor を指す', () => {
    const result = trainSchema.safeParse({
      ...base,
      freeSpaces: [
        { carNumber: 1, nearDoor: 1, isStandard: true },
        { carNumber: 2, nearDoor: 5, isStandard: true },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['freeSpaces', 1, 'nearDoor'], message: '2号車のドアは1〜4番です' }),
    ]);
  });

  it('優先席のドア番号が 0 なら失敗し、その行の nearDoor を指す', () => {
    const result = trainSchema.safeParse({
      ...base,
      prioritySeats: [{ carNumber: 1, nearDoor: 0, isStandard: true }],
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['prioritySeats', 0, 'nearDoor'], message: '1号車のドアは1〜4番です' }),
    ]);
  });

  it('フリースペースに同じ号車・ドア番号が 2 回あれば失敗し、2 回目の行の nearDoor を指す', () => {
    const result = trainSchema.safeParse({
      ...base,
      freeSpaces: [
        { carNumber: 1, nearDoor: 2, isStandard: true },
        { carNumber: 1, nearDoor: 2, isStandard: false },
      ],
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['freeSpaces', 1, 'nearDoor'], message: '1号車のドア2番が重複しています' }),
    ]);
  });

  it('フリースペースと優先席が同じ号車・ドア番号なら通る（一意制約は設備の種別ごと）', () => {
    const result = trainSchema.safeParse({
      ...base,
      freeSpaces: [{ carNumber: 1, nearDoor: 2, isStandard: true }],
      prioritySeats: [{ carNumber: 1, nearDoor: 2, isStandard: true }],
    });
    expect(result.success).toBe(true);
  });

  it('車両構成に無い号車なら失敗し、その行の carNumber を指す', () => {
    const result = trainSchema.safeParse({
      ...base,
      freeSpaces: [{ carNumber: 3, nearDoor: 1, isStandard: true }],
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['freeSpaces', 0, 'carNumber'] }),
    ]);
  });
});

describe('trainSchema の車両構成（#194）', () => {
  const base = { name: 'E235系', operatorId: VALID_UUID, lineIds: [VALID_UUID], carCount: 2 };

  it('両数を超える号車があれば失敗し、その号車を指す', () => {
    const result = trainSchema.safeParse({
      ...base,
      carStructure: [{ carNumber: 1, doorCount: 4 }, { carNumber: 5, doorCount: 9 }],
      freeSpaces: [{ carNumber: 5, nearDoor: 9, isStandard: true }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: ['carStructure', 1, 'carNumber'] }),
    );
  });

  it('号車が 0 なら失敗する', () => {
    const result = trainSchema.safeParse({
      ...base,
      carStructure: [{ carNumber: 0, doorCount: 4 }],
    });
    expect(result.success).toBe(false);
  });

  it('ドア数が 0 なら失敗し、その号車の doorCount を指す', () => {
    const result = trainSchema.safeParse({
      ...base,
      carStructure: [{ carNumber: 1, doorCount: 0 }, { carNumber: 2, doorCount: 4 }],
    });
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: ['carStructure', 0, 'doorCount'] }),
    );
  });

  it('同じ号車が 2 回あれば失敗し、2 回目を指す', () => {
    const result = trainSchema.safeParse({
      ...base,
      carStructure: [{ carNumber: 1, doorCount: 4 }, { carNumber: 1, doorCount: 3 }],
    });
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: ['carStructure', 1, 'carNumber'], message: '1号車が重複しています' }),
    );
  });
});
