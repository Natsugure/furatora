import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StationTimeline } from './StationTimeline';
import type { StationWithOrder } from '@/types';

function station(code: string, name: string, nameEn: string | null): StationWithOrder {
  return {
    id: code,
    slug: `tokyometro-ginza-${code.toLowerCase()}`,
    code,
    name,
    nameEn,
    lat: null,
    lon: null,
    stationOrder: Number(code.slice(1)),
  };
}

const STATIONS = [
  station('G01', '渋谷', 'Shibuya'),
  station('G02', '表参道', 'Omote-sando'),
  station('G03', '外苑前', null),
];

function renderTimeline(stations: StationWithOrder[], lineColor: string | null = '#F39700') {
  render(<StationTimeline stations={stations} lineColor={lineColor} />);
  const rows = screen.getAllByRole('listitem');
  const segment = (row: HTMLElement, side: 'up' | 'down') =>
    row.querySelector<HTMLElement>(`[data-timeline="${side}"]`);
  return { rows, segment };
}

describe('StationTimeline', () => {
  it('駅を順序つきの一覧で並べ、それぞれを駅の詳細へのリンクにする', () => {
    const { rows } = renderTimeline(STATIONS);
    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(rows).toHaveLength(3);
    const link = within(rows[0]!).getByRole('link', { name: /渋谷/ });
    expect(link).toHaveAttribute('href', '/stations/tokyometro-ginza-g01');
    expect(within(rows[0]!).getByRole('heading', { name: '渋谷' })).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Shibuya')).toBeInTheDocument();
  });

  it('先頭は上に、末尾は下に線を描かず、途中は上下に描く', () => {
    const { rows, segment } = renderTimeline(STATIONS);
    const [first, middle, last] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(segment(first, 'up')).toBeNull();
    expect(segment(first, 'down')).not.toBeNull();
    expect(segment(middle, 'up')).not.toBeNull();
    expect(segment(middle, 'down')).not.toBeNull();
    expect(segment(last, 'up')).not.toBeNull();
    expect(segment(last, 'down')).toBeNull();
  });

  it('1駅だけの路線は、線を描かない', () => {
    const { rows, segment } = renderTimeline([STATIONS[0]!]);
    expect(segment(rows[0]!, 'up')).toBeNull();
    expect(segment(rows[0]!, 'down')).toBeNull();
  });

  it('線は読み上げの対象にしない', () => {
    const { rows, segment } = renderTimeline(STATIONS);
    expect(segment(rows[1]!, 'up')).toHaveAttribute('aria-hidden', 'true');
    expect(segment(rows[1]!, 'down')).toHaveAttribute('aria-hidden', 'true');
  });

  it('線を路線色で描く', () => {
    const { rows, segment } = renderTimeline(STATIONS);
    expect(segment(rows[1]!, 'up')).toHaveStyle({ backgroundColor: '#F39700' });
  });

  it('路線色が無ければ、線をニュートラルの色で描く', () => {
    const { rows, segment } = renderTimeline(STATIONS, null);
    expect(segment(rows[1]!, 'up')?.style.backgroundColor).toBe('var(--color-rail-line-fallback)');
  });

  // 線がバッジの中心を通ることは、次の2つで確かめる（jsdom はレイアウトを計算しないため、位置を測らない）
  it('線は列の中央から、太さの半分だけ左に置く', () => {
    const { rows, segment } = renderTimeline(STATIONS);
    const line = segment(rows[1]!, 'up')!;
    expect(line.style.left).toBe('50%');
    expect(parseFloat(line.style.marginLeft)).toBe(-parseFloat(line.style.width) / 2);
  });

  it('線の基準の列には、線のほかにバッジだけを置く（列の幅がバッジの直径になる）', () => {
    const { rows, segment } = renderTimeline(STATIONS);
    const column = segment(rows[1]!, 'up')!.parentElement!;
    expect(column).toHaveAttribute('data-timeline', 'column');
    const others = [...column.children].filter((el) => !el.hasAttribute('data-timeline'));
    expect(others).toHaveLength(1);
    expect(within(others[0] as HTMLElement).getByText('G')).toBeInTheDocument();
  });
});
