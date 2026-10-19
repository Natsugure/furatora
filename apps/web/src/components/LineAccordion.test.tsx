import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineAccordion } from './LineAccordion';
import type { Line } from '@/types';

function line(overrides: Partial<Line> = {}): Line {
  return {
    id: 'l1',
    slug: 'tokyometro-ginza',
    name: '東京メトロ銀座線',
    nameEn: 'Ginza Line',
    lineCode: 'G',
    color: '#F39700',
    displayOrder: 1,
    operatorId: 'o1',
    ...overrides,
  };
}

describe('LineAccordion', () => {
  it('路線の駅一覧へのリンクに、路線名と英語名を出す', () => {
    render(<LineAccordion line={line()} />);
    expect(screen.getByRole('link', { name: /東京メトロ銀座線/ })).toHaveAttribute('href', '/lines/tokyometro-ginza/stations');
    expect(screen.getByText('Ginza Line')).toBeInTheDocument();
  });

  it('路線名の文字には路線色を使わない（白地とのコントラストが足りない路線色があるため）', () => {
    render(<LineAccordion line={line()} />);
    expect(screen.getByText('東京メトロ銀座線').style.color).toBe('');
  });

  it('英語名が無ければ出さない', () => {
    render(<LineAccordion line={line({ nameEn: null })} />);
    expect(screen.queryByText('Ginza Line')).not.toBeInTheDocument();
  });
});
