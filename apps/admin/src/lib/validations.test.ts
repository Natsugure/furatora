import { describe, it, expect } from 'vitest';
import {
  operatorSchema,
  stationUpdateSchema,
  lineUpdateSchema,
  directionSchema,
  stationConnectionUpdateSchema,
} from './validations';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('operatorSchema', () => {
  it('必須フィールドのみで正常にパースされる', () => {
    const result = operatorSchema.safeParse({ name: 'JR東日本' });
    expect(result.success).toBe(true);
  });

  it('全フィールドで正常にパースされる', () => {
    const result = operatorSchema.safeParse({
      name: 'JR東日本',
      odptOperatorId: 'odpt.Operator:JR-East',
      displayPriority: 1,
    });
    expect(result.success).toBe(true);
  });

  it('nameが空の場合は失敗する', () => {
    const result = operatorSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('nameがない場合は失敗する', () => {
    const result = operatorSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('displayPriorityが数値でない場合は失敗する', () => {
    const result = operatorSchema.safeParse({ name: 'JR東日本', displayPriority: 'one' });
    expect(result.success).toBe(false);
  });
});

describe('stationUpdateSchema', () => {
  it('必須フィールドで正常にパースされる', () => {
    const result = stationUpdateSchema.safeParse({
      name: '渋谷',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('nameがない場合は失敗する', () => {
    const result = stationUpdateSchema.safeParse({ operatorId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('operatorIdがUUIDでない場合は失敗する', () => {
    const result = stationUpdateSchema.safeParse({ name: '渋谷', operatorId: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('lineUpdateSchema', () => {
  it('必須フィールドで正常にパースされる', () => {
    const result = lineUpdateSchema.safeParse({
      name: '山手線',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('nameがない場合は失敗する', () => {
    const result = lineUpdateSchema.safeParse({ operatorId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('operatorIdがUUIDでない場合は失敗する', () => {
    const result = lineUpdateSchema.safeParse({ name: '山手線', operatorId: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('directionSchema', () => {
  it('必須フィールドで正常にパースされる', () => {
    const result = directionSchema.safeParse({
      directionType: 'inbound',
      representativeStationId: VALID_UUID,
      displayName: '内回り',
    });
    expect(result.success).toBe(true);
  });

  it('directionTypeが不正な値の場合は失敗する', () => {
    const result = directionSchema.safeParse({
      directionType: 'clockwise',
      representativeStationId: VALID_UUID,
      displayName: '内回り',
    });
    expect(result.success).toBe(false);
  });

  it('representativeStationIdがUUIDでない場合は失敗する', () => {
    const result = directionSchema.safeParse({
      directionType: 'outbound',
      representativeStationId: 'not-uuid',
      displayName: '外回り',
    });
    expect(result.success).toBe(false);
  });

  it('displayNameがない場合は失敗する', () => {
    const result = directionSchema.safeParse({
      directionType: 'inbound',
      representativeStationId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });
});

describe('stationConnectionUpdateSchema', () => {
  it('全フィールド省略で正常にパースされる', () => {
    const result = stationConnectionUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('有効なstrollerDifficultyで正常にパースされる', () => {
    const result = stationConnectionUpdateSchema.safeParse({
      strollerDifficulty: 'optimal',
    });
    expect(result.success).toBe(true);
  });

  it('strollerDifficultyに不正な値の場合は失敗する', () => {
    const result = stationConnectionUpdateSchema.safeParse({
      strollerDifficulty: 'easy',
    });
    expect(result.success).toBe(false);
  });

  it('wheelchairDifficultyに不正な値の場合は失敗する', () => {
    const result = stationConnectionUpdateSchema.safeParse({
      wheelchairDifficulty: 'easy',
    });
    expect(result.success).toBe(false);
  });
});
