import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { TrainForm } from './TrainForm';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

const OPERATOR_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const LINE_ID = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

function setup() {
  render(
    <MantineProvider>
      <TrainForm
        isEdit
        initialData={{
          id: 'train-1',
          name: '銀座線',
          operatorId: OPERATOR_ID,
          lineIds: [LINE_ID],
          carCount: 1,
          carStructure: [{ carNumber: 1, doorCount: 3, carLength: null }],
          freeSpaces: null,
          prioritySeats: null,
        }}
        operators={[{ id: OPERATOR_ID, name: '東京メトロ' }]}
        lines={[{ id: LINE_ID, name: '東京メトロ銀座線', nameEn: 'Ginza Line', operatorId: OPERATOR_ID }]}
      />
    </MantineProvider>,
  );
}

describe('TrainForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('alert', vi.fn());
    // MultiSelect が使う ResizeObserver は jsdom に無い
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  it('保存できたら一覧へ戻る', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    setup();
    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/trains');
    });
    expect(fetch).toHaveBeenCalledWith('/api/trains/train-1', expect.objectContaining({ method: 'PUT' }));
    expect(alert).not.toHaveBeenCalled();
  });

  it('通信が失敗しても、エラーを出して更新ボタンを押せる状態に戻す', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    setup();
    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith('保存に失敗しました');
    });
    expect(screen.getByRole('button', { name: '更新' })).toBeEnabled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
