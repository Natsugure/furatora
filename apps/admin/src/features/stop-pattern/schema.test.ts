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
});
