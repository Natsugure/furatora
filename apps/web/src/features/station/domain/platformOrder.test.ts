import { describe, it, expect } from 'vitest';
import { sortPlatformsByNumber } from './platformOrder';
import type { PlatformDTO } from '@furatora/platform-diagram/domain';

function platform(overrides: Partial<PlatformDTO> & { id: string }): PlatformDTO {
  return {
    platformNumber: '1',
    lineId: 'line-1',
    lineName: '銀座線',
    lineColor: '#f39700',
    inboundDirectionId: null,
    inboundDirectionName: null,
    outboundDirectionId: null,
    outboundDirectionName: null,
    notes: null,
    physicalLength: 100,
    stopPatterns: [],
    concourses: [],
    ...overrides,
  };
}

describe('sortPlatformsByNumber', () => {
  it('ホーム番号の数値順に並べる (1, 2, 10の順で並ぶ)', () => {
    const p1 = platform({ id: 'p1', platformNumber: '1' });
    const p2 = platform({ id: 'p2', platformNumber: '2' });
    const p10 = platform({ id: 'p10', platformNumber: '10' });
    expect(sortPlatformsByNumber([p10, p2, p1])).toEqual([p1, p2, p10]);
  });

  it('同じ番号のホームは id の順に並べる (入力の順に左右されない)', () => {
    const a = platform({ id: 'a', platformNumber: '1', lineName: '丸ノ内線' });
    const b = platform({ id: 'b', platformNumber: '1', lineName: '銀座線' });
    expect(sortPlatformsByNumber([b, a])).toEqual([a, b]);
    expect(sortPlatformsByNumber([a, b])).toEqual([a, b]);
  });

  it('入力の配列を変更しない', () => {
    const p1 = platform({ id: 'p1', platformNumber: '1' });
    const p2 = platform({ id: 'p2', platformNumber: '2' });
    const input = [p2, p1];
    sortPlatformsByNumber(input);
    expect(input).toEqual([p2, p1]);
  });
});
