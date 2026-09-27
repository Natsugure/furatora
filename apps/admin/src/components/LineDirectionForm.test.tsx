import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { LineDirectionForm } from './LineDirectionForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// 終点駅の一覧の ScrollArea（Mantine）が ResizeObserver を使う。jsdom には無いので空の実装を置く
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const LINE_ID = 'line-1';
const stations = [{ id: 'station-1', name: '池袋', nameEn: null, code: null }];
const ikebukuroDefault = { id: 'direction-default', displayName: '池袋方面' };

type Props = Parameters<typeof LineDirectionForm>[0];

function setup(props: Partial<Props> = {}) {
  render(
    <MantineProvider>
      <LineDirectionForm
        lineId={LINE_ID}
        stations={stations}
        currentDefaults={{ inbound: null, outbound: ikebukuroDefault }}
        {...props}
      />
    </MantineProvider>,
  );
}

const defaultCheckbox = () => screen.getByRole('checkbox', { name: 'この路線・方面の既定の表示名にする' });

describe('LineDirectionForm: 既定の表示名', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('新規作成で、その組に既定行が無ければ最初から既定にする', () => {
    setup();
    // 方面タイプの初期値は inbound（既定行なし）
    expect(defaultCheckbox()).toBeChecked();
  });

  it('新規作成で方面タイプを既定行のある組に切り替えると、既定にしない', async () => {
    setup();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '方面タイプ' }), 'outbound');
    expect(defaultCheckbox()).not.toBeChecked();
    expect(screen.queryByText(/現在の既定/)).not.toBeInTheDocument();
  });

  it('既定行のある組で既定にすると、置き換わる既定を示す', async () => {
    setup();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '方面タイプ' }), 'outbound');
    await userEvent.click(defaultCheckbox());
    expect(screen.getByText('現在の既定: 池袋方面（保存すると置き換わります）')).toBeInTheDocument();
  });

  it('チェックを触ったあとは、方面タイプを切り替えても変えない', async () => {
    setup();
    await userEvent.click(defaultCheckbox()); // inbound で外す
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '方面タイプ' }), 'outbound');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '方面タイプ' }), 'inbound');
    expect(defaultCheckbox()).not.toBeChecked();
  });

  it('既定行そのものを編集するときは、置き換えを示さない', () => {
    setup({
      isEdit: true,
      initialData: {
        id: ikebukuroDefault.id,
        directionType: 'outbound',
        representativeStationId: 'station-1',
        displayName: '池袋方面',
        displayNameEn: '',
        terminalStationIds: null,
        notes: '',
        isDefault: true,
      },
    });
    expect(defaultCheckbox()).toBeChecked();
    expect(screen.queryByText(/現在の既定/)).not.toBeInTheDocument();
  });

  it('保存で isDefault を送り、409 なら API のメッセージを表示する', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: '同じ路線・方面の既定が同時に変更されました。画面を読み込み直してください' }), {
        status: 409,
      }),
    );
    setup();
    await userEvent.type(screen.getByRole('textbox', { name: /表示名（日本語）/ }), '内回り');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /代表駅/ }), 'station-1');
    await userEvent.click(screen.getByRole('button', { name: '登録' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('同じ路線・方面の既定が同時に変更されました'));
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ directionType: 'inbound', isDefault: true });
  });
});
