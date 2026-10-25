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

  // ホームの側は廃止した（ADR-0022）。古い画面から送られてきても入力に含めず、書かない
  it('platformSide が送られてきても入力から捨てる', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: VALID_UUID,
      physicalLength: 210,
      platformSide: 'top',
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('platformSide');
  });
});

describe('platformSchema の UUID（#160）', () => {
  const UPPER = '550e8400-e29b-41d4-a716-4466554400AB';
  const LOWER = '550e8400-e29b-41d4-a716-4466554400ab';

  it('大文字の UUID を小文字にして返す', () => {
    const result = platformSchema.parse({
      platformNumber: '1',
      lineId: UPPER,
      inboundDirectionId: UPPER,
      outboundDirectionId: UPPER,
      physicalLength: 210,
    });
    expect(result).toMatchObject({ lineId: LOWER, inboundDirectionId: LOWER, outboundDirectionId: LOWER });
  });
});
