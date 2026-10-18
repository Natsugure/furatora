import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StationCard } from './StationCard';
import type { StationWithOrder } from '@/types';

const station: StationWithOrder = {
  id: 's1',
  slug: 'tokyometro-ginza-shibuya',
  code: 'G01',
  name: '渋谷',
  nameEn: 'Shibuya',
  lat: null,
  lon: null,
  stationOrder: 1,
};

function renderCard({ isFirst, isLast, lineColor = '#F39700' }: { isFirst: boolean; isLast: boolean; lineColor?: string | null }) {
  const { container } = render(
    <StationCard station={station} lineColor={lineColor} isFirst={isFirst} isLast={isLast} />,
  );
  const segment = (side: 'up' | 'down') => container.querySelector<HTMLElement>(`[data-timeline="${side}"]`);
  return { segment };
}

describe('StationCard', () => {
  it('駅の詳細へのリンクに、駅名と英語名を出す', () => {
    renderCard({ isFirst: false, isLast: false });
    const link = screen.getByRole('link', { name: /渋谷/ });
    expect(link).toHaveAttribute('href', '/stations/tokyometro-ginza-shibuya');
    expect(screen.getByRole('heading', { name: '渋谷' })).toBeInTheDocument();
    expect(screen.getByText('Shibuya')).toBeInTheDocument();
  });

  it('途中の駅は、上下の両方に線を描く', () => {
    const { segment } = renderCard({ isFirst: false, isLast: false });
    expect(segment('up')).not.toBeNull();
    expect(segment('down')).not.toBeNull();
  });

  it('先頭の駅は、上に線を描かない', () => {
    const { segment } = renderCard({ isFirst: true, isLast: false });
    expect(segment('up')).toBeNull();
    expect(segment('down')).not.toBeNull();
  });

  it('末尾の駅は、下に線を描かない', () => {
    const { segment } = renderCard({ isFirst: false, isLast: true });
    expect(segment('up')).not.toBeNull();
    expect(segment('down')).toBeNull();
  });

  it('1駅だけの路線は、線を描かない', () => {
    const { segment } = renderCard({ isFirst: true, isLast: true });
    expect(segment('up')).toBeNull();
    expect(segment('down')).toBeNull();
  });

  it('線は読み上げの対象にしない', () => {
    const { segment } = renderCard({ isFirst: false, isLast: false });
    expect(segment('up')).toHaveAttribute('aria-hidden', 'true');
    expect(segment('down')).toHaveAttribute('aria-hidden', 'true');
  });

  it('線を路線色で描く', () => {
    const { segment } = renderCard({ isFirst: false, isLast: false });
    expect(segment('up')).toHaveStyle({ backgroundColor: '#F39700' });
  });

  it('路線色が無ければ、線をニュートラルの色で描く', () => {
    const { segment } = renderCard({ isFirst: false, isLast: false, lineColor: null });
    expect(segment('up')?.style.backgroundColor).toBe('var(--color-rail-line-fallback)');
  });
});
