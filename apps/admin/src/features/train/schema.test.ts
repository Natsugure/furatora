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
