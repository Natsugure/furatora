import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { LineDirectionForm } from './LineDirectionForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const LINE_ID = 'line-1';
const ikebukuroDefault = { id: 'direction-default', displayName: '池袋方面' };

type Props = Parameters<typeof LineDirectionForm>[0];

function setup(props: Partial<Props> = {}) {
  render(
    <MantineProvider>
      <LineDirectionForm
        lineId={LINE_ID}
        currentDefaults={{ inbound: null, outbound: ikebukuroDefault }}
        {...props}
      />
    </MantineProvider>,
  );
}

const defaultCheckbox = () => screen.getByRole('checkbox', { name: 'この路線・方面の既定の表示名にする' });
const editingIkebukuro = (isDefault: boolean): Partial<Props> => ({
  isEdit: true,
  initialData: {
    id: isDefault ? ikebukuroDefault.id : 'direction-other',
    directionType: 'outbound',
    displayName: '池袋方面',
    displayNameEn: '',
    notes: '',
    isDefault,
  },
});
const lostDefaultWarning = () => screen.queryByText(/下りの既定の表示名が無くなります/);

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
    setup(editingIkebukuro(true));
    expect(defaultCheckbox()).toBeChecked();
    expect(screen.queryByText(/現在の既定/)).not.toBeInTheDocument();
    expect(lostDefaultWarning()).not.toBeInTheDocument();
  });

  it('既定行のチェックを外すと、元の組が既定を失うことを示す', async () => {
    setup(editingIkebukuro(true));
    await userEvent.click(defaultCheckbox());
    expect(lostDefaultWarning()).toBeInTheDocument();
  });

  it('既定行の方面タイプを変えると、元の組が既定を失うことを示す', async () => {
    setup(editingIkebukuro(true));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '方面タイプ' }), 'inbound');
    expect(lostDefaultWarning()).toBeInTheDocument();
  });

  it('既定でない行の編集では、既定を失う警告を出さない', async () => {
    setup(editingIkebukuro(false));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '方面タイプ' }), 'inbound');
    expect(lostDefaultWarning()).not.toBeInTheDocument();
  });

  it('保存で isDefault を送り、409 なら API のメッセージを表示する', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: '同じ路線・方面の既定が同時に変更されました。画面を読み込み直してください' }), {
        status: 409,
      }),
    );
    setup();
    await userEvent.type(screen.getByRole('textbox', { name: /表示名（日本語）/ }), '内回り');
    await userEvent.click(screen.getByRole('button', { name: '登録' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('同じ路線・方面の既定が同時に変更されました'));
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ directionType: 'inbound', isDefault: true });
  });

  it('代表駅・終点駅の入力が無く、送信内容にも含めない（#129）', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    setup();
    expect(screen.queryByRole('combobox', { name: /代表駅/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/終点駅/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /表示名（日本語）/ }), '内回り');
    await userEvent.click(screen.getByRole('button', { name: '登録' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty('representativeStationId');
    expect(body).not.toHaveProperty('terminalStationIds');
  });
});
