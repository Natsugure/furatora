import { describe, it, expect } from 'vitest';
import { stationConnectionCreateSchema } from './schema';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('stationConnectionCreateSchema', () => {
  it('connectedStationId のみで正常にパースされる', () => {
    const result = stationConnectionCreateSchema.safeParse({ connectedStationId: UUID });
    expect(result.success).toBe(true);
  });

  it('connectedStationId が UUID でない場合は失敗する', () => {
    const result = stationConnectionCreateSchema.safeParse({ connectedStationId: 'x' });
    expect(result.success).toBe(false);
  });

  it('旧4列（難易度・備考）が送られても受け取らない（乗換難易度は駅対の編集画面で入力する。#124）', () => {
    const result = stationConnectionCreateSchema.safeParse({
      connectedStationId: UUID,
      strollerDifficulty: 'elevator_detour',
      wheelchairDifficulty: 'assistance_required',
      notesAboutStroller: '西口のエレベーターを使う',
      notesAboutWheelchair: null,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ connectedStationId: UUID });
  });
});
