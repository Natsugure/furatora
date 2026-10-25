import { describe, it, expect } from 'vitest';
import { stationAdjacencyCreateSchema } from './schema';

const A = '550e8400-e29b-41d4-a716-446655440000';
const B = '550e8400-e29b-41d4-a716-446655440001';

describe('stationAdjacencyCreateSchema', () => {
  it('異なる2駅で正常にパースされる', () => {
    const result = stationAdjacencyCreateSchema.safeParse({ stationAId: A, stationBId: B });
    expect(result.success).toBe(true);
  });

  it('同じ駅どうしは失敗する', () => {
    const result = stationAdjacencyCreateSchema.safeParse({ stationAId: A, stationBId: A });
    expect(result.success).toBe(false);
  });

  it('大文字・小文字だけが違う同じ駅どうしは失敗する（#160）', () => {
    const result = stationAdjacencyCreateSchema.safeParse({ stationAId: A, stationBId: A.toUpperCase() });
    expect(result.success).toBe(false);
  });

  it('端点を小文字にして返す（#160。昇順正規化を DB の uuid の順序と一致させるため）', () => {
    const result = stationAdjacencyCreateSchema.parse({ stationAId: A.toUpperCase(), stationBId: B.toUpperCase() });
    expect(result).toEqual({ stationAId: A, stationBId: B });
  });

  it('UUID でない端点は失敗する', () => {
    const result = stationAdjacencyCreateSchema.safeParse({ stationAId: A, stationBId: 'x' });
    expect(result.success).toBe(false);
  });
});
