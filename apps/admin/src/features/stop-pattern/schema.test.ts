import { describe, it, expect } from 'vitest';
import { trainStopPatternSchema } from './schema';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '660e8400-e29b-41d4-a716-446655440000';

describe('trainStopPatternSchema', () => {
  it('必須フィールドで正常にパースされる', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [{ carNumber: 1, startMeters: 0, endMeters: 20 }],
    });
    expect(result.success).toBe(true);
  });

  it('carsが空の場合は失敗する', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [],
    });
    expect(result.success).toBe(false);
  });

  it('startMetersがendMeters以上の場合は失敗する', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [{ carNumber: 1, startMeters: 20, endMeters: 20 }],
    });
    expect(result.success).toBe(false);
  });

  it('platformIdがUUIDでない場合は失敗する', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: 'not-uuid',
      trainId: OTHER_UUID,
      cars: [{ carNumber: 1, startMeters: 0, endMeters: 20 }],
    });
    expect(result.success).toBe(false);
  });

  it('負の開始位置でも終了位置より小さければ正常にパースされる（頭端式ホームの外側等）', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [{ carNumber: 1, startMeters: -5, endMeters: 15 }],
    });
    expect(result.success).toBe(true);
  });

  it('decimal(6,2) の範囲（±9999.99）ちょうどなら正常にパースされる', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [
        { carNumber: 1, startMeters: -9999.99, endMeters: -9979.99 },
        { carNumber: 2, startMeters: 9979.99, endMeters: 9999.99 },
      ],
    });
    // 境界の共有違反は出るが、範囲の違反は出ない
    const rangeIssues = result.error?.issues.filter((i) => i.path.at(-1) === 'startMeters' || i.path.at(-1) === 'endMeters') ?? [];
    expect(rangeIssues).toEqual([]);
  });

  it('endMeters が decimal(6,2) の上限 9999.99 を超える場合は失敗する', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [{ carNumber: 1, startMeters: 9990, endMeters: 10010 }],
    });
    expect(result.success).toBe(false);
  });

  it('startMeters が decimal(6,2) の下限 -9999.99 を下回る場合は失敗する', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [{ carNumber: 1, startMeters: -10010, endMeters: -9990 }],
    });
    expect(result.success).toBe(false);
  });

  it('隣接号車が境界を共有していれば正常にパースされる（非反転編成）', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [
        { carNumber: 1, startMeters: 0, endMeters: 20 },
        { carNumber: 2, startMeters: 20, endMeters: 40 },
        { carNumber: 3, startMeters: 40, endMeters: 60 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('隣接号車が境界を共有していれば正常にパースされる（反転編成。茗荷谷2番線・丸ノ内線相当）', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [
        { carNumber: 1, startMeters: 40, endMeters: 60 },
        { carNumber: 2, startMeters: 20, endMeters: 40 },
        { carNumber: 3, startMeters: 0, endMeters: 20 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('隣接号車の間に隙間があると失敗する（非反転編成）', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [
        { carNumber: 1, startMeters: 0, endMeters: 20 },
        { carNumber: 2, startMeters: 25, endMeters: 45 }, // 20と25の間に隙間
      ],
    });
    expect(result.success).toBe(false);
  });

  it('隣接号車の間に隙間があると失敗する（反転編成。向きを考慮しないと誤って正常判定してしまう）', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [
        { carNumber: 1, startMeters: 45, endMeters: 65 }, // 反転側の共有座標は45だが2号車endは40
        { carNumber: 2, startMeters: 20, endMeters: 40 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('号車が1件のみなら境界チェックは対象外で正常にパースされる', () => {
    const result = trainStopPatternSchema.safeParse({
      platformId: VALID_UUID,
      trainId: OTHER_UUID,
      cars: [{ carNumber: 1, startMeters: 0, endMeters: 20 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('trainStopPatternSchema の UUID（#160）', () => {
  const UPPER = '550e8400-e29b-41d4-a716-4466554400AB';
  const LOWER = '550e8400-e29b-41d4-a716-4466554400ab';

  it('大文字の UUID を小文字にして返す', () => {
    const result = trainStopPatternSchema.parse({
      platformId: UPPER,
      trainId: UPPER,
      cars: [{ carNumber: 1, startMeters: 0, endMeters: 20 }],
    });
    expect(result).toMatchObject({ platformId: LOWER, trainId: LOWER });
  });
});
