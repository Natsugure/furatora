import { describe, it, expect } from 'vitest';
import { platformSchema } from './schema';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('platformSchema', () => {
  it('必須フィールドで正常にパースされる', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: VALID_UUID,
      physicalLength: 210,
    });
    expect(result.success).toBe(true);
  });

  it('platformNumberが空の場合は失敗する', () => {
    const result = platformSchema.safeParse({
      platformNumber: '',
      lineId: VALID_UUID,
      physicalLength: 210,
    });
    expect(result.success).toBe(false);
  });

  it('lineIdがUUIDでない場合は失敗する', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: 'not-uuid',
      physicalLength: 210,
    });
    expect(result.success).toBe(false);
  });

  it('physicalLengthが0以下の場合は失敗する', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: VALID_UUID,
      physicalLength: 0,
    });
    expect(result.success).toBe(false);
  });

  it('platformSideに不正な値が入る場合は失敗する', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: VALID_UUID,
      physicalLength: 210,
      platformSide: 'left',
    });
    expect(result.success).toBe(false);
  });
});
