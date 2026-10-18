import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperatorList } from './OperatorList';
import type { Line, OperatorWithLines } from '@/types';

function line(id: string, name: string): Line {
  return { id, slug: id, name, nameEn: null, lineCode: null, color: '#F39700', displayOrder: null, operatorId: 'o' };
}

function operator(id: string, name: string, lines: Line[]): OperatorWithLines {
  return { id, name, odptOperatorId: null, createdAt: null, lines };
}

const metro = operator('metro', '東京メトロ', [line('ginza', '銀座線'), line('marunouchi', '丸ノ内線')]);
const toei = operator('toei', '東京都交通局', [line('asakusa', '浅草線')]);

describe('OperatorList', () => {
  it('事業者が1つなら、最初から開いて路線を出す', () => {
    render(<OperatorList operators={[metro]} />);
    expect(screen.getByRole('button', { name: '東京メトロ' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: '銀座線' })).toHaveAttribute('href', '/lines/ginza/stations');
    expect(screen.getByRole('link', { name: '丸ノ内線' })).toBeInTheDocument();
  });

  it('事業者が複数なら、すべて閉じた状態で出す', () => {
    render(<OperatorList operators={[metro, toei]} />);
    expect(screen.getByRole('button', { name: '東京メトロ' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '東京都交通局' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('事業者を押すと開き、もう一度押すと閉じる', async () => {
    render(<OperatorList operators={[metro, toei]} />);
    const button = screen.getByRole('button', { name: '東京都交通局' });

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: '浅草線' })).toBeInTheDocument();

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: '浅草線' })).not.toBeInTheDocument();
  });

  it('別の事業者を開くと、前に開いていた事業者は閉じる', async () => {
    render(<OperatorList operators={[metro, toei]} />);
    await userEvent.click(screen.getByRole('button', { name: '東京メトロ' }));
    await userEvent.click(screen.getByRole('button', { name: '東京都交通局' }));
    expect(screen.getByRole('button', { name: '東京メトロ' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: '銀座線' })).not.toBeInTheDocument();
  });

  it('路線が無い事業者を開くと「路線がありません」を出す', () => {
    render(<OperatorList operators={[operator('x', '新しい事業者', [])]} />);
    expect(screen.getByText('路線がありません')).toBeInTheDocument();
  });
});
