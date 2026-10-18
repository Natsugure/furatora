import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { DuplicateButton } from './DuplicateButton';
import type { TrainDTO } from '@/features/train/ports';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

const ORIGINAL: TrainDTO = {
  id: 'train-1',
  name: '10000系',
  operatorId: 'operator-1',
  lineIds: ['line-1', 'line-2'],
  carCount: 2,
  carStructure: [
    { carNumber: 1, doorCount: 4, carLength: 20.5 },
    { carNumber: 2, doorCount: 4, carLength: null },
  ],
  freeSpaces: [{ carNumber: 1, nearDoor: 2, isStandard: true }],
  prioritySeats: [{ carNumber: 2, nearDoor: 1, isStandard: false }],
};

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('DuplicateButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('複製元の DTO を、入力した名前でそのまま POST する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(ORIGINAL), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));

    renderWithMantine(<DuplicateButton trainId="train-1" trainName="10000系" />);

    await user.click(screen.getByRole('button'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '複製' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/trains/train-1');

    const [url, init] = vi.mocked(fetch).mock.calls[1]!;
    expect(url).toBe('/api/trains');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: '10000系 (コピー)',
      operatorId: 'operator-1',
      lineIds: ['line-1', 'line-2'],
      carCount: 2,
      carStructure: ORIGINAL.carStructure,
      freeSpaces: ORIGINAL.freeSpaces,
      prioritySeats: ORIGINAL.prioritySeats,
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('複製元の取得に失敗したら、POST せずにエラーを出す', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));

    renderWithMantine(<DuplicateButton trainId="train-1" trainName="10000系" />);

    await user.click(screen.getByRole('button'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '複製' }));

    expect(await screen.findByText('列車データの取得に失敗しました')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
