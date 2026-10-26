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

type Equipment = { carNumber: number; nearDoor: number; isStandard: boolean };

function setup({ freeSpaces = null, prioritySeats = null }: { freeSpaces?: Equipment[] | null; prioritySeats?: Equipment[] | null } = {}) {
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
          freeSpaces,
          prioritySeats,
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

  describe('設備のドア番号（#194）', () => {
    it('ドア番号が号車のドア数を超える行に、エラーの文を出す', () => {
      setup({ freeSpaces: [{ carNumber: 1, nearDoor: 4, isStandard: true }] });

      expect(screen.getByText('1号車のドアは1〜3番です')).toBeInTheDocument();
    });

    it('車両構成に無い号車の行に、エラーの文を出す', () => {
      setup({ prioritySeats: [{ carNumber: 2, nearDoor: 1, isStandard: true }] });

      expect(screen.getByText('2号車は車両構成にありません')).toBeInTheDocument();
    });

    it('同じ号車・ドア番号の行が 2 回あれば、2 回目の行にエラーの文を出し、送信しない', async () => {
      const user = userEvent.setup();
      setup({ freeSpaces: [
        { carNumber: 1, nearDoor: 2, isStandard: true },
        { carNumber: 1, nearDoor: 2, isStandard: true },
      ] });

      await user.click(screen.getByRole('button', { name: '更新' }));

      expect(screen.getByText('1号車のドア2番が重複しています')).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('範囲外の行があるまま更新を押しても、送信しない', async () => {
      const user = userEvent.setup();
      setup({ freeSpaces: [{ carNumber: 1, nearDoor: 4, isStandard: true }] });

      await user.click(screen.getByRole('button', { name: '更新' }));

      expect(fetch).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '更新' })).toBeEnabled();
    });

    it('ドア番号の入力は、矢印キーでは号車のドア数を超えない', async () => {
      const user = userEvent.setup();
      setup({ freeSpaces: [{ carNumber: 1, nearDoor: 3, isStandard: true }] });

      const input = screen.getByLabelText('ドア番号');
      await user.click(input);
      await user.keyboard('{ArrowUp}');

      expect(input).toHaveValue('3');
    });

    it('範囲外のドア番号は、フォーカスが外れても上限に丸めず、エラーのまま送信しない', async () => {
      // 丸めると、押した覚えのない別のドア（上限の番号）が黙って保存される
      const user = userEvent.setup();
      setup({ freeSpaces: [{ carNumber: 1, nearDoor: 1, isStandard: true }] });

      const input = screen.getByLabelText('ドア番号');
      await user.clear(input);
      await user.type(input, '9');
      await user.click(screen.getByRole('button', { name: '更新' }));

      expect(input).toHaveValue('9');
      expect(screen.getByText('1号車のドアは1〜3番です')).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('範囲外の号車は、フォーカスが外れても両数に丸めず、エラーのまま送信しない', async () => {
      // 丸めると、押した覚えのない別の号車（最後の号車）の設備が黙って保存される
      const user = userEvent.setup();
      setup({ freeSpaces: [{ carNumber: 1, nearDoor: 1, isStandard: true }] });

      const input = screen.getByLabelText('号車');
      await user.clear(input);
      await user.type(input, '12');
      await user.click(screen.getByRole('button', { name: '更新' }));

      expect(input).toHaveValue('12');
      expect(screen.getByText('12号車は車両構成にありません')).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
