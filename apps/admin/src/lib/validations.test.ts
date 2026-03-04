import { describe, it, expect } from 'vitest';
import {
  operatorSchema,
  trainSchema,
  stationUpdateSchema,
  platformSchema,
  platformLocationSchema,
  lineUpdateSchema,
  directionSchema,
  stationConnectionUpdateSchema,
  unresolvedRailwaySchema,
  unresolvedStationSchema,
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

describe('platformSchema', () => {
  it('必須フィールドで正常にパースされる', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: VALID_UUID,
      maxCarCount: 11,
    });
    expect(result.success).toBe(true);
  });

  it('platformNumberが空の場合は失敗する', () => {
    const result = platformSchema.safeParse({
      platformNumber: '',
      lineId: VALID_UUID,
      maxCarCount: 11,
    });
    expect(result.success).toBe(false);
  });

  it('lineIdがUUIDでない場合は失敗する', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: 'not-uuid',
      maxCarCount: 11,
    });
    expect(result.success).toBe(false);
  });

  it('maxCarCountが0以下の場合は失敗する', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: VALID_UUID,
      maxCarCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('platformSideに不正な値が入る場合は失敗する', () => {
    const result = platformSchema.safeParse({
      platformNumber: '1',
      lineId: VALID_UUID,
      maxCarCount: 11,
      platformSide: 'left',
    });
    expect(result.success).toBe(false);
  });
});

describe('platformLocationSchema', () => {
  it('platformIdのみで正常にパースされる', () => {
    const result = platformLocationSchema.safeParse({ platformId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('platformIdがUUIDでない場合は失敗する', () => {
    const result = platformLocationSchema.safeParse({ platformId: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('platformIdがない場合は失敗する', () => {
    const result = platformLocationSchema.safeParse({});
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

describe('unresolvedRailwaySchema', () => {
  it('必須フィールドで正常にパースされる', () => {
    const result = unresolvedRailwaySchema.safeParse({
      odptRailwayId: 'odpt.Railway:JR-East.Yamanote',
      name: '山手線',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('odptRailwayIdがない場合は失敗する', () => {
    const result = unresolvedRailwaySchema.safeParse({
      name: '山手線',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it('nameが空の場合は失敗する', () => {
    const result = unresolvedRailwaySchema.safeParse({
      odptRailwayId: 'odpt.Railway:JR-East.Yamanote',
      name: '',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it('operatorIdがUUIDでない場合は失敗する', () => {
    const result = unresolvedRailwaySchema.safeParse({
      odptRailwayId: 'odpt.Railway:JR-East.Yamanote',
      name: '山手線',
      operatorId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('unresolvedStationSchema', () => {
  it('action=createで正常にパースされる', () => {
    const result = unresolvedStationSchema.safeParse({
      action: 'create',
      odptStationId: 'odpt.Station:JR-East.Yamanote.Shibuya',
      name: '渋谷',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('action=linkで正常にパースされる', () => {
    const result = unresolvedStationSchema.safeParse({
      action: 'link',
      odptStationId: 'odpt.Station:JR-East.Yamanote.Shibuya',
      stationId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('不正なactionの場合は失敗する', () => {
    const result = unresolvedStationSchema.safeParse({
      action: 'delete',
      odptStationId: 'odpt.Station:JR-East.Yamanote.Shibuya',
      name: '渋谷',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it('action=createでodptStationIdがない場合は失敗する', () => {
    const result = unresolvedStationSchema.safeParse({
      action: 'create',
      name: '渋谷',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it('action=linkでstationIdがUUIDでない場合は失敗する', () => {
    const result = unresolvedStationSchema.safeParse({
      action: 'link',
      odptStationId: 'odpt.Station:JR-East.Yamanote.Shibuya',
      stationId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });
});
