import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { CandidateRoute } from '../ports';
import { matchKey, type DuplicateMatch } from '../domain/duplicates';
import { COMBO_KEYS, type RouteDraft } from '../domain/types';
import { DuplicateRouteModal } from './DuplicateRouteModal';

function route(key: string, label: string): RouteDraft {
  return {
    key,
    routeId: null,
    label,
    isBaseline: false,
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: false,
    notes: '',
    facilities: ['elevator'],
    combos: [...COMBO_KEYS],
  };
}

const candidate: CandidateRoute = {
  routeId: 'rc',
  label: '副都心線のルート',
  minutes: null,
  isOutdoor: false,
  requiresExitGate: false,
  requiresStaff: false,
  isOfficiallyGuided: false,
  notes: null,
  facilities: ['elevator'],
  usedBy: '池袋（丸ノ内線） ↔ 池袋（副都心線）',
};

const candidateMatch: DuplicateMatch = { kind: 'candidate', key: 'a', candidate };
const cardMatch: DuplicateMatch = { kind: 'card', key: 'c', otherKey: 'b' };
const routes = [route('a', '新しいルート'), route('b', '北改札経由'), route('c', '地上経由')];

function renderModal(matches: DuplicateMatch[], handlers = { onConfirm: vi.fn(), onCancel: vi.fn() }) {
  render(
    <MantineProvider>
      <DuplicateRouteModal opened matches={matches} routes={routes} {...handlers} />
    </MantineProvider>,
  );
  return handlers;
}

describe('DuplicateRouteModal', () => {
  it('候補ルートとの一致では、どのルートが、どの接続のどのルートと一致したかを示す', () => {
    renderModal([candidateMatch]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/ルート 1「新しいルート」/)).toBeInTheDocument();
    expect(within(dialog).getByText(/池袋（丸ノ内線） ↔ 池袋（副都心線）/)).toBeInTheDocument();
    expect(within(dialog).getByText(/「副都心線のルート」/)).toBeInTheDocument();
  });

  it('カードどうしの一致では、2枚のルートを示す', () => {
    renderModal([cardMatch]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/ルート 3「地上経由」/)).toBeInTheDocument();
    expect(within(dialog).getByText(/ルート 2「北改札経由」/)).toBeInTheDocument();
  });

  it('既定の選択は「別ルートとして作る」（保存を止めず、事実を勝手に統合しない）', () => {
    renderModal([candidateMatch]);
    expect(screen.getByRole('radio', { name: /別ルートとして作る/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /既存のルートを共有する/ })).not.toBeChecked();
  });

  it('何も選ばずに反映すると、すべて「別ルートとして作る」で onConfirm が呼ばれる', async () => {
    const handlers = renderModal([candidateMatch, cardMatch]);
    await userEvent.click(screen.getByRole('button', { name: '選択を反映して保存' }));
    expect(handlers.onConfirm).toHaveBeenCalledWith({
      [matchKey(candidateMatch)]: 'separate',
      [matchKey(cardMatch)]: 'separate',
    });
  });

  it('「共有する」を選んで反映すると、その検出だけ share になる', async () => {
    const handlers = renderModal([candidateMatch, cardMatch]);
    await userEvent.click(screen.getByRole('radio', { name: /既存のルートを共有する/ }));
    await userEvent.click(screen.getByRole('button', { name: '選択を反映して保存' }));
    expect(handlers.onConfirm).toHaveBeenCalledWith({
      [matchKey(candidateMatch)]: 'share',
      [matchKey(cardMatch)]: 'separate',
    });
  });

  it('キャンセルすると onCancel が呼ばれ、onConfirm は呼ばれない', async () => {
    const handlers = renderModal([candidateMatch]);
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(handlers.onCancel).toHaveBeenCalled();
    expect(handlers.onConfirm).not.toHaveBeenCalled();
  });
});
