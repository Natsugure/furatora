import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchTabs } from './SearchTabs';
import type { OperatorWithLines } from '@/types';

const operators: OperatorWithLines[] = [
  {
    id: 'metro',
    name: '東京メトロ',
    odptOperatorId: null,
    createdAt: null,
    lines: [{ id: 'ginza', slug: 'ginza', name: '銀座線', nameEn: null, lineCode: null, color: null, displayOrder: null, operatorId: 'metro' }],
  },
];

const stationTab = () => screen.getByRole('button', { name: '駅名で検索' });
const lineTab = () => screen.getByRole('button', { name: '路線から検索' });

describe('SearchTabs', () => {
  it('最初は「駅名で検索」を選んだ状態で、検索欄を出す', () => {
    render(<SearchTabs operators={operators} />);
    expect(stationTab()).toHaveAttribute('aria-pressed', 'true');
    expect(lineTab()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('searchbox', { name: '駅名' })).toBeInTheDocument();
  });

  it('「路線から検索」を押すと、事業者と路線の一覧に切り替わる', async () => {
    render(<SearchTabs operators={operators} />);
    await userEvent.click(lineTab());

    expect(lineTab()).toHaveAttribute('aria-pressed', 'true');
    expect(stationTab()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '銀座線' })).toBeInTheDocument();
  });

  it('「駅名で検索」に戻すと、検索欄に戻る', async () => {
    render(<SearchTabs operators={operators} />);
    await userEvent.click(lineTab());
    await userEvent.click(stationTab());
    expect(screen.getByRole('searchbox', { name: '駅名' })).toBeInTheDocument();
  });

  it('事業者が無ければ、路線のタブで「事業者データがありません」を出す', async () => {
    render(<SearchTabs operators={[]} />);
    await userEvent.click(lineTab());
    expect(screen.getByText('事業者データがありません')).toBeInTheDocument();
  });
});
