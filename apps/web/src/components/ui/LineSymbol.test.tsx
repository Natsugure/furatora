import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineSymbol } from './LineSymbol';

describe('LineSymbol', () => {
  it('路線コードを路線記号として出す', () => {
    render(<LineSymbol lineCode="G" fallbackStationCode="X01" color="#F39700" />);
    expect(screen.getByRole('img', { name: '路線記号 G' })).toHaveTextContent('G');
  });

  it('路線コードが無ければ、駅番号の先頭の英字を路線記号にする', () => {
    render(<LineSymbol lineCode={null} fallbackStationCode="Mb03" color="#F39700" />);
    expect(screen.getByRole('img', { name: '路線記号 Mb' })).toBeInTheDocument();
  });

  it('路線コードも駅番号の英字も無ければ、何も描かない', () => {
    const { container } = render(<LineSymbol lineCode={null} fallbackStationCode="123" color="#F39700" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('駅番号も無ければ、何も描かない', () => {
    const { container } = render(<LineSymbol lineCode={null} fallbackStationCode={null} color="#F39700" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('丸を路線色で塗る', () => {
    render(<LineSymbol lineCode="G" fallbackStationCode={null} color="#F39700" />);
    expect(screen.getByRole('img')).toHaveStyle({ backgroundColor: '#F39700' });
  });

  it('路線色が無ければ、丸をニュートラルの色で塗る', () => {
    render(<LineSymbol lineCode="G" fallbackStationCode={null} color={null} />);
    expect(screen.getByRole('img').style.backgroundColor).toBe('var(--color-rail-line-fallback)');
  });
});
