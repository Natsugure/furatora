import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { STATION_BADGE_SIZE, StationBadge } from './StationBadge';

describe('StationBadge', () => {
  it('駅番号を路線記号と番号に分けて表示する', () => {
    render(<StationBadge code="G01" color="#F39700" />);
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('英字と数字に分けられない駅番号は、そのまま表示する', () => {
    render(<StationBadge code="A-11" color="#E85298" />);
    expect(screen.getByText('A-11')).toBeInTheDocument();
  });

  it('駅番号が無ければ「-」を表示する', () => {
    render(<StationBadge code={null} color="#F39700" />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('輪を路線色で描く', () => {
    render(<StationBadge code="G01" color="#F39700" />);
    expect(screen.getByText('G').parentElement).toHaveStyle({ borderColor: '#F39700' });
  });

  it('直径を STATION_BADGE_SIZE にする（駅一覧の線の位置がこれを参照する）', () => {
    render(<StationBadge code="G01" color="#F39700" />);
    expect(screen.getByText('G').parentElement).toHaveStyle({
      width: `${STATION_BADGE_SIZE}px`,
      height: `${STATION_BADGE_SIZE}px`,
    });
  });

  it('路線色が無ければ、輪をニュートラルの色で描く', () => {
    render(<StationBadge code="G01" color={null} />);
    expect(screen.getByText('G').parentElement?.style.borderColor).toBe('var(--color-rail-line-fallback)');
  });
});
