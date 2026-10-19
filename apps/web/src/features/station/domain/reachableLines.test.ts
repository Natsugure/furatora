import { describe, expect, it } from 'vitest';
import { reachableLines } from './reachableLines';

const line = (lineName: string, lineColor: string | null = null) => ({ lineName, lineColor });
const partner = (connectedStationName: string, lineName: string, lineColor: string | null = null) => ({
  connectedStationName,
  lineName,
  lineColor,
});

describe('reachableLines', () => {
  it('自駅の路線を here に返す（ホームの無い駅でも、stationLines から出る）', () => {
    const result = reachableLines('春日', [line('都営三田線', '#0079C2'), line('都営大江戸線', '#B6007A')], []);
    expect(result).toEqual({
      here: [line('都営三田線', '#0079C2'), line('都営大江戸線', '#B6007A')],
      transfers: [],
    });
  });

  it('同じ駅名の乗換先の路線は、自駅の路線の後ろに here として並べる（渋谷の各社）', () => {
    const result = reachableLines(
      '渋谷',
      [line('東京メトロ銀座線')],
      [partner('渋谷', 'JR山手線'), partner('渋谷', '東急東横線')],
    );
    expect(result).toEqual({
      here: [line('東京メトロ銀座線'), line('JR山手線'), line('東急東横線')],
      transfers: [],
    });
  });

  it('別の駅名の乗換先は、駅名ごとにまとめ、最初に出た順に並べる（淡路町 → 新御茶ノ水・小川町）', () => {
    const result = reachableLines(
      '淡路町',
      [line('東京メトロ丸ノ内線')],
      [
        partner('新御茶ノ水', '東京メトロ千代田線'),
        partner('小川町', '都営新宿線'),
        partner('新御茶ノ水', '仮の路線'),
      ],
    );
    expect(result).toEqual({
      here: [line('東京メトロ丸ノ内線')],
      transfers: [
        { stationName: '新御茶ノ水', lines: [line('東京メトロ千代田線'), line('仮の路線')] },
        { stationName: '小川町', lines: [line('都営新宿線')] },
      ],
    });
  });

  it('同じ路線名は最初に出た1つだけにし、here に出た路線は transfers に出さない', () => {
    const result = reachableLines(
      'A駅',
      [line('X線'), line('X線')],
      [
        partner('A駅', 'Y線'),
        partner('B駅', 'X線'),
        partner('B駅', 'Y線'),
        partner('B駅', 'Z線'),
        partner('C駅', 'Z線'),
        partner('D駅', 'X線'),
      ],
    );
    expect(result).toEqual({
      here: [line('X線'), line('Y線')],
      transfers: [{ stationName: 'B駅', lines: [line('Z線')] }],
    });
  });

  it('自駅の路線も乗換先も無ければ、両方とも空にする', () => {
    expect(reachableLines('新駅', [], [])).toEqual({ here: [], transfers: [] });
  });
});
