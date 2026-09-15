import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { PlatformInspector } from './PlatformInspector';
import type { LineWithDirections } from '@/features/platform/ports';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const notificationsShow = vi.fn();
vi.mock('@mantine/notifications', () => ({
  notifications: { show: (...args: unknown[]) => notificationsShow(...args) },
}));

const singleLine: LineWithDirections[] = [
  { id: 'line-1', name: '銀座線', inboundDirections: [], outboundDirections: [] },
];

const twoLines: LineWithDirections[] = [
  { id: 'line-1', name: '銀座線', inboundDirections: [], outboundDirections: [] },
  { id: 'line-2', name: '丸ノ内線', inboundDirections: [], outboundDirections: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

describe('PlatformInspector', () => {
  it('路線候補が1件のみなら新規作成時に自動設定される（#32①）', () => {
    render(
      <MantineProvider>
        <PlatformInspector stationId="station-1" lines={singleLine} onCancel={vi.fn()} listState={{}} />
      </MantineProvider>,
    );
    expect(screen.getByLabelText('路線', { exact: false })).toHaveValue('line-1');
    expect(screen.getByText('この駅唯一の路線を自動設定しました。')).toBeInTheDocument();
  });

  it('路線候補が複数ある場合は自動設定せず選択を求める', () => {
    render(
      <MantineProvider>
        <PlatformInspector stationId="station-1" lines={twoLines} onCancel={vi.fn()} listState={{}} />
      </MantineProvider>,
    );
    expect(screen.getByLabelText('路線', { exact: false })).toHaveValue('');
  });

  it('新規作成: 必須項目を入力して送信するとPOSTが呼ばれる', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 'new-platform-id' }), { status: 201 }),
    );
    render(
      <MantineProvider>
        <PlatformInspector stationId="station-1" lines={singleLine} onCancel={vi.fn()} listState={{}} />
      </MantineProvider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('ホーム番号', { exact: false }), '3');
    // Mantine NumberInput（suffix付き）は user.type だとフォーマット済み表示と衝突するため
    // fireEvent.change で直接値を設定する
    fireEvent.change(screen.getByLabelText('ホームの物理長', { exact: false }), { target: { value: '150' } });
    await user.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/stations/station-1/platforms',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/stations/station-1/layout?platformId=new-platform-id');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('ホーム長が0以下だとエラー通知が出てfetchは呼ばれない', async () => {
    render(
      <MantineProvider>
        <PlatformInspector stationId="station-1" lines={singleLine} onCancel={vi.fn()} listState={{}} />
      </MantineProvider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('ホーム番号', { exact: false }), '3');
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(notificationsShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: 'ホーム長は0より大きい値を入力してください' }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('既存ホームの編集: initialDataがあればPUTで更新される', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    render(
      <MantineProvider>
        <PlatformInspector
          stationId="station-1"
          lines={singleLine}
          initialData={{
            id: 'platform-1', platformNumber: '1', lineId: 'line-1',
            inboundDirectionId: null, outboundDirectionId: null,
            physicalLength: 100, platformSide: null, notes: null,
          }}
          onCancel={vi.fn()}
          listState={{}}
        />
      </MantineProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/stations/station-1/platforms/platform-1',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  it('キャンセルボタンでonCancelが呼ばれる', async () => {
    const onCancel = vi.fn();
    render(
      <MantineProvider>
        <PlatformInspector stationId="station-1" lines={singleLine} onCancel={onCancel} listState={{}} />
      </MantineProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
