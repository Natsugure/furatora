import { describe, expect, it } from 'vitest';
import { orientConnection } from './index';

const LOW = '00000000-0000-0000-0000-00000000000a';
const HIGH = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const row = { stationAId: LOW, directionA: 'inbound', stationBId: HIGH, directionB: 'outbound' } as const;

describe('orientConnection', () => {
  it('自駅が A 側なら、A の方面が自駅の方面になる', () => {
    expect(orientConnection(row, LOW)).toEqual({
      connectedStationId: HIGH,
      stationDirection: 'inbound',
      connectedDirection: 'outbound',
    });
  });

  it('自駅が B 側なら、B の方面が自駅の方面になる', () => {
    expect(orientConnection(row, HIGH)).toEqual({
      connectedStationId: LOW,
      stationDirection: 'outbound',
      connectedDirection: 'inbound',
    });
  });

  it('uuid の大文字小文字が違っても同じ駅として扱い、返す ID は行のまま', () => {
    expect(orientConnection(row, LOW.toUpperCase())).toEqual(orientConnection(row, LOW));
    const upperRow = { ...row, stationBId: HIGH.toUpperCase() };
    expect(orientConnection(upperRow, LOW).connectedStationId).toBe(HIGH.toUpperCase());
  });

  it('自駅が A 側にも B 側にも無い行は、向きを決めずに例外にする', () => {
    expect(() => orientConnection(row, '11111111-1111-1111-1111-111111111111')).toThrow();
  });
});
