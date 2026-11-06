import { describe, it, expect } from 'vitest';
import { trainStopPatternSchema } from './schema';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '660e8400-e29b-41d4-a716-446655440000';

const valid = {
  platformId: VALID_UUID,
  trainId: OTHER_UUID,
  carOneOuterMeters: 12.5,
  carNumbersAscendToward: 'plusX',
};

describe('trainStopPatternSchema', () => {
  it('基準点と向きで正常にパースされる', () => {
    expect(trainStopPatternSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['plusX', 'minusX'])('向き %s を受け付ける', (dir) => {
    expect(trainStopPatternSchema.safeParse({ ...valid, carNumbersAscendToward: dir }).success).toBe(true);
  });

  it('知らない向きは失敗する', () => {
    expect(trainStopPatternSchema.safeParse({ ...valid, carNumbersAscendToward: 'left' }).success).toBe(false);
  });

  it('基準点が無い場合は失敗する', () => {
    expect(trainStopPatternSchema.safeParse({ ...valid, carOneOuterMeters: undefined }).success).toBe(false);
  });

  it('負の基準点でも正常にパースされる（頭端式ホームの外側等）', () => {
    expect(trainStopPatternSchema.safeParse({ ...valid, carOneOuterMeters: -5 }).success).toBe(true);
  });

  it('decimal(6,2) の範囲（±9999.99）ちょうどなら正常にパースされる', () => {
    expect(trainStopPatternSchema.safeParse({ ...valid, carOneOuterMeters: 9999.99 }).success).toBe(true);
    expect(trainStopPatternSchema.safeParse({ ...valid, carOneOuterMeters: -9999.99 }).success).toBe(true);
  });

  it('decimal(6,2) の範囲（±9999.99）を超える場合は失敗する', () => {
    expect(trainStopPatternSchema.safeParse({ ...valid, carOneOuterMeters: 10000 }).success).toBe(false);
    expect(trainStopPatternSchema.safeParse({ ...valid, carOneOuterMeters: -10000 }).success).toBe(false);
  });

  it('platformIdがUUIDでない場合は失敗する', () => {
    expect(trainStopPatternSchema.safeParse({ ...valid, platformId: 'not-uuid' }).success).toBe(false);
  });

  // 号車の区間は保存しない（ADR-0025）。旧い形の入力を受け付けて黙って捨てないよう、cars は拒む
  it('号車の区間（cars）を送った場合は失敗する', () => {
    const result = trainStopPatternSchema.safeParse({
      ...valid,
      cars: [{ carNumber: 1, startMeters: 0, endMeters: 20 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('trainStopPatternSchema の UUID（#160）', () => {
  const UPPER = '550e8400-e29b-41d4-a716-4466554400AB';
  const LOWER = '550e8400-e29b-41d4-a716-4466554400ab';

  it('大文字の UUID を小文字にして返す', () => {
    const result = trainStopPatternSchema.parse({ ...valid, platformId: UPPER, trainId: UPPER });
    expect(result).toMatchObject({ platformId: LOWER, trainId: LOWER });
  });
});
