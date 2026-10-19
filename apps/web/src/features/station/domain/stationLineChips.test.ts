import { describe, expect, it } from 'vitest';
import { stationLineChips } from './stationLineChips';

// 第1引数がホームの路線、第2引数が乗換先の路線
const line = (lineName: string, lineColor: string | null) => ({ lineName, lineColor });

describe('stationLineChips', () => {
  it('ホームの路線を先に、乗換先の路線を後に並べる', () => {
    const chips = stationLineChips(
      [line('丸ノ内線', '#F62E36')],
      [line('有楽町線', '#C1A470'), line('副都心線', '#9C5E31')],
    );
    expect(chips).toEqual([
      { name: '丸ノ内線', color: '#F62E36' },
      { name: '有楽町線', color: '#C1A470' },
      { name: '副都心線', color: '#9C5E31' },
    ]);
  });

  it('同じ路線は最初の1つだけにする（上下のホーム、別の駅で同じ路線への乗換）', () => {
    const chips = stationLineChips(
      [line('丸ノ内線', '#F62E36'), line('丸ノ内線', '#F62E36')],
      [line('丸ノ内線', '#F62E36'), line('有楽町線', '#C1A470'), line('有楽町線', '#C1A470')],
    );
    expect(chips.map((c) => c.name)).toEqual(['丸ノ内線', '有楽町線']);
  });

  it('路線色が無い路線も残す', () => {
    expect(stationLineChips([line('新線', null)], [])).toEqual([{ name: '新線', color: null }]);
  });

  it('ホームも乗換先も無ければ空にする', () => {
    expect(stationLineChips([], [])).toEqual([]);
  });
});
