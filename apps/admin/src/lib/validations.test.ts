import { describe, it, expect } from 'vitest';
import {
  operatorSchema,
  stationUpdateSchema,
  lineUpdateSchema,
  directionSchema,
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

  it('displayPriorityがnullの場合は失敗する（NOT NULL 化後は 0 以上の整数のみ）', () => {
    const result = operatorSchema.safeParse({ name: 'JR東日本', displayPriority: null });
    expect(result.success).toBe(false);
  });

  it('displayPriorityが負数の場合は失敗する', () => {
    const result = operatorSchema.safeParse({ name: 'JR東日本', displayPriority: -1 });
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
      displayName: '内回り',
      isDefault: false,
    });
    expect(result.success).toBe(true);
  });

  it('directionTypeが不正な値の場合は失敗する', () => {
    const result = directionSchema.safeParse({
      directionType: 'clockwise',
      displayName: '内回り',
    });
    expect(result.success).toBe(false);
  });

  it('代表駅・終点駅を送っても結果に含めない（#129 で廃止した項目）', () => {
    const result = directionSchema.safeParse({
      directionType: 'outbound',
      displayName: '外回り',
      isDefault: false,
      representativeStationId: VALID_UUID,
      terminalStationIds: [VALID_UUID],
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('representativeStationId');
    expect(result.data).not.toHaveProperty('terminalStationIds');
  });

  it('displayNameがない場合は失敗する', () => {
    const result = directionSchema.safeParse({
      directionType: 'inbound',
    });
    expect(result.success).toBe(false);
  });

  it('isDefaultを省略した場合は失敗する（PUT で既定行が黙って既定から外れないように）', () => {
    const result = directionSchema.safeParse({
      directionType: 'inbound',
      displayName: '内回り',
    });
    expect(result.success).toBe(false);
  });

  it('isDefaultに true を渡せる', () => {
    const result = directionSchema.safeParse({
      directionType: 'inbound',
      displayName: '内回り',
      isDefault: true,
    });
    expect(result.success && result.data.isDefault).toBe(true);
  });

  it('isDefaultが真偽値でない場合は失敗する', () => {
    const result = directionSchema.safeParse({
      directionType: 'inbound',
      displayName: '内回り',
      isDefault: 'true',
    });
    expect(result.success).toBe(false);
  });
});
