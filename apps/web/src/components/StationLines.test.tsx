import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StationLines } from './StationLines';

const line = (lineName: string, lineColor: string | null = null) => ({ lineName, lineColor });

describe('StationLines', () => {
  it('この駅で乗れる路線を「路線」のリストに並べる', () => {
    render(<StationLines lines={{ here: [line('東京メトロ丸ノ内線', '#F62E36'), line('JR山手線')], transfers: [] }} />);
    const items = within(screen.getByRole('list', { name: '路線' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['東京メトロ丸ノ内線', 'JR山手線']);
  });

  it('別の駅名の乗換先は、「乗り換え」の見出しの下に駅名ごとに並べる', () => {
    render(
      <StationLines
        lines={{
          here: [line('東京メトロ丸ノ内線')],
          transfers: [
            { stationName: '新御茶ノ水', lines: [line('東京メトロ千代田線')] },
            { stationName: '小川町', lines: [line('都営新宿線')] },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: '乗り換え' })).toBeInTheDocument();
    const lineNames = (name: string) =>
      within(screen.getByRole('list', { name })).getAllByRole('listitem').map((li) => li.textContent);
    expect(lineNames('新御茶ノ水の路線')).toEqual(['東京メトロ千代田線']);
    expect(lineNames('小川町の路線')).toEqual(['都営新宿線']);
    // 自駅の路線の段には、乗換先の路線を混ぜない
    expect(lineNames('路線')).toEqual(['東京メトロ丸ノ内線']);
  });

  it('別の駅名の乗換先が無ければ、「乗り換え」の見出しを出さない', () => {
    render(<StationLines lines={{ here: [line('都営三田線')], transfers: [] }} />);
    expect(screen.queryByRole('heading', { name: '乗り換え' })).not.toBeInTheDocument();
  });

  it('この駅の路線が無く乗換先だけがあるとき、空の「路線」のリストを出さない', () => {
    render(<StationLines lines={{ here: [], transfers: [{ stationName: '小川町', lines: [line('都営新宿線')] }] }} />);
    expect(screen.queryByRole('list', { name: '路線' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: '小川町の路線' })).toBeInTheDocument();
  });

  it('路線が1つも無ければ、何も描画しない', () => {
    const { container } = render(<StationLines lines={{ here: [], transfers: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
