import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StationBadge } from './StationBadge';

describe('StationBadge', () => {
  it('駅番号を路線記号と番号に分けて表示する', () => {
    render(<StationBadge code="G01" color="#F39700" />);
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('小文字を含む路線記号（方南町支線の Mb03）も分けて表示する', () => {
    render(<StationBadge code="Mb03" color="#E60012" />);
    expect(screen.getByText('Mb')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
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

  it('路線色が無ければ、輪をニュートラルの色で描く', () => {
    render(<StationBadge code="G01" color={null} />);
    expect(screen.getByText('G').parentElement?.style.borderColor).toBe('var(--color-rail-line-fallback)');
  });
});
