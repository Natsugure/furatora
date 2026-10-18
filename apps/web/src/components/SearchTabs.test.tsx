import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchTabs } from './SearchTabs';
import { mantineTheme } from '@/theme/mantineTheme';
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

// SegmentedControl は MantineProvider の中でしか描けない
function Wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider theme={mantineTheme}>{children}</MantineProvider>;
}
const render = (ui: ReactNode) => rtlRender(ui, { wrapper: Wrapper });

const stationTab = () => screen.getByRole('radio', { name: '駅名で検索' });
const lineTab = () => screen.getByRole('radio', { name: '路線から検索' });

describe('SearchTabs', () => {
  it('検索方法を「検索方法」という名前の、1つを選ぶグループで出す', () => {
    render(<SearchTabs operators={operators} />);
    expect(screen.getByRole('radiogroup', { name: '検索方法' })).toBeInTheDocument();
  });

  it('最初は「駅名で検索」を選んだ状態で、検索欄を出す', () => {
    render(<SearchTabs operators={operators} />);
    expect(stationTab()).toBeChecked();
    expect(lineTab()).not.toBeChecked();
    expect(screen.getByRole('searchbox', { name: '駅名' })).toBeInTheDocument();
  });

  it('「路線から検索」を押すと、事業者と路線の一覧に切り替わる', async () => {
    render(<SearchTabs operators={operators} />);
    await userEvent.click(lineTab());

    expect(lineTab()).toBeChecked();
    expect(stationTab()).not.toBeChecked();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '銀座線' })).toBeInTheDocument();
  });

  it('「駅名で検索」に戻すと、検索欄に戻る', async () => {
    render(<SearchTabs operators={operators} />);
    await userEvent.click(lineTab());
    await userEvent.click(stationTab());
    expect(screen.getByRole('searchbox', { name: '駅名' })).toBeInTheDocument();
  });

  it('矢印キーで選び直せる', async () => {
    render(<SearchTabs operators={operators} />);
    await userEvent.click(stationTab());
    await userEvent.keyboard('{ArrowRight}');
    expect(lineTab()).toBeChecked();
    expect(screen.getByRole('link', { name: '銀座線' })).toBeInTheDocument();
  });

  it('事業者が無ければ、路線のタブで「事業者データがありません」を出す', async () => {
    render(<SearchTabs operators={[]} />);
    await userEvent.click(lineTab());
    expect(screen.getByText('事業者データがありません')).toBeInTheDocument();
  });
});
