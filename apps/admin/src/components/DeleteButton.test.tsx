import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { DeleteButton } from './DeleteButton';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('DeleteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('デフォルトラベルのボタンがレンダリングされる', () => {
    renderWithMantine(
      <DeleteButton endpoint="/api/operators/1" redirectTo="/operators" />
    );
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument();
  });

  it('カスタムラベルのボタンがレンダリングされる', () => {
    renderWithMantine(
      <DeleteButton endpoint="/api/operators/1" redirectTo="/operators" label="削除する" />
    );
    expect(screen.getByRole('button', { name: '削除する' })).toBeInTheDocument();
  });

  it('ボタンクリックで確認モーダルが開く', async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <DeleteButton endpoint="/api/operators/1" redirectTo="/operators" />
    );

    await user.click(screen.getByRole('button', { name: '削除' }));

    // Mantine renders modal into a portal with CSS transitions - use findByText to wait
    expect(await screen.findByText('本当に削除しますか？')).toBeInTheDocument();
  });

  it('キャンセルボタンでモーダルが閉じる', async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <DeleteButton endpoint="/api/operators/1" redirectTo="/operators" />
    );

    await user.click(screen.getByRole('button', { name: '削除' }));
    await screen.findByText('本当に削除しますか？');

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));

    await waitFor(() => {
      expect(screen.queryByText('本当に削除しますか？')).not.toBeInTheDocument();
    });
  });

  it('削除確認でDELETE fetchが呼ばれる', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    renderWithMantine(
      <DeleteButton endpoint="/api/operators/1" redirectTo="/operators" />
    );

    await user.click(screen.getByRole('button', { name: '削除' }));
    await screen.findByText('本当に削除しますか？');

    // Use within(dialog) to target the modal's delete button specifically
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '削除' }));

    expect(fetch).toHaveBeenCalledWith('/api/operators/1', { method: 'DELETE' });
  });

  it('削除成功時にrouter.pushとrouter.refreshが呼ばれる', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    renderWithMantine(
      <DeleteButton endpoint="/api/operators/1" redirectTo="/operators" />
    );

    await user.click(screen.getByRole('button', { name: '削除' }));
    await screen.findByText('本当に削除しますか？');

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/operators');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
