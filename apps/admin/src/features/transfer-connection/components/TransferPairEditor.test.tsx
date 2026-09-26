import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { CandidateRoute, TransferPairEditContext } from '../ports';
import { TransferPairEditor } from './TransferPairEditor';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const notificationsShow = vi.fn();
vi.mock('@mantine/notifications', () => ({
  notifications: { show: (...args: unknown[]) => notificationsShow(...args) },
}));

const fetchMock = vi.fn();

const candidate: CandidateRoute = {
  routeId: 'route-candidate',
  label: '副都心線のエレベーター経由',
  minutes: null,
  isOutdoor: false,
  requiresExitGate: false,
  requiresStaff: false,
  isOfficiallyGuided: false,
  notes: null,
  facilities: ['elevator'],
  usedBy: '池袋（丸ノ内線） ↔ 池袋（副都心線）',
};

function context(over: Partial<TransferPairEditContext> = {}): TransferPairEditContext {
  return {
    stationId: 's-id',
    connectedStationId: 't-id',
    stationName: '池袋',
    connectedStationName: '池袋',
    lineName: '丸ノ内線',
    connectedLineName: '有楽町線',
    directionHints: { station: { inbound: [], outbound: [] }, connected: { inbound: [], outbound: [] } },
    facilityTypes: [
      { code: 'sameFloor', name: '同一階層' },
      { code: 'elevator', name: 'エレベーター' },
      { code: 'ramp', name: 'スロープ' },
      { code: 'wheelchairEscalator', name: '車いす対応エスカレーター' },
      { code: 'escalator', name: 'エスカレーター' },
      { code: 'stairLift', name: '階段昇降機' },
      { code: 'stairs', name: '階段' },
    ],
    connections: [],
    routes: [],
    candidates: [candidate],
    ...over,
  };
}

function renderEditor(ctx: TransferPairEditContext) {
  render(
    <MantineProvider>
      <TransferPairEditor context={ctx} />
    </MantineProvider>,
  );
}

async function addRouteWith(label: string, facility?: string) {
  await userEvent.click(screen.getByRole('button', { name: 'ルートを追加' }));
  await userEvent.type(screen.getByRole('textbox', { name: /ルートの名前/ }), label);
  if (facility) await userEvent.click(screen.getByRole('checkbox', { name: facility }));
}

const sentBody = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

describe('TransferPairEditor: 保存と重複検出', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('未評価の駅対は「未評価です」と示す', () => {
    renderEditor(context());
    expect(screen.getByText('未評価です')).toBeInTheDocument();
  });

  it('重複が無ければモーダルを出さずに保存し、PUT の本文は駅対の最終状態になる', async () => {
    renderEditor(context({ candidates: [] }));
    await addRouteWith('地上経由', 'エレベーター');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/stations/s-id/connections/t-id/transfer');
    expect(fetchMock.mock.calls[0]![1].method).toBe('PUT');
    expect(sentBody().routes).toEqual([
      expect.objectContaining({
        routeId: null,
        label: '地上経由',
        isBaseline: true,
        facilities: ['elevator'],
        combos: ['inbound:inbound', 'inbound:outbound', 'outbound:inbound', 'outbound:outbound'],
      }),
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('候補ルートと一致すると、保存の前にモーダルを出し、まだ保存しない', async () => {
    renderEditor(context());
    await addRouteWith('地上経由', 'エレベーター');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/池袋（丸ノ内線） ↔ 池袋（副都心線）/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('モーダルで「別ルートとして作る」（既定）を選ぶと、新規ルート（routeId なし）として保存する', async () => {
    renderEditor(context());
    await addRouteWith('地上経由', 'エレベーター');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await userEvent.click(await screen.findByRole('button', { name: '選択を反映して保存' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().routes[0]).toMatchObject({ routeId: null, label: '地上経由' });
  });

  it('モーダルで「既存のルートを共有する」を選ぶと、候補の routeId に付け替えて保存する', async () => {
    renderEditor(context());
    await addRouteWith('地上経由', 'エレベーター');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await userEvent.click(await screen.findByRole('radio', { name: /既存のルートを共有する/ }));
    await userEvent.click(screen.getByRole('button', { name: '選択を反映して保存' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().routes[0]).toMatchObject({ routeId: 'route-candidate', label: '地上経由' });
  });

  it('モーダルをキャンセルすると保存しない', async () => {
    renderEditor(context());
    await addRouteWith('地上経由', 'エレベーター');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await userEvent.click(await screen.findByRole('button', { name: 'キャンセル' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('設備0件（設備未入力）のルートは、候補と一致しても検出せず、そのまま保存する（ADR-0012）', async () => {
    renderEditor(context({ candidates: [{ ...candidate, facilities: [] }] }));
    await addRouteWith('地上経由');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('検証エラー（名前が空）のときは、リクエストを送らない', async () => {
    renderEditor(context({ candidates: [] }));
    await userEvent.click(screen.getByRole('button', { name: 'ルートを追加' }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存できない項目があります')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('保存に失敗したら、サーバーのエラー本文を通知に出し、再読み込みはしない', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: '同じ名前のルートがあります' }) });
    renderEditor(context({ candidates: [] }));
    await addRouteWith('地上経由', 'エレベーター');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('保存に成功したら router.refresh() で読み込み直す', async () => {
    renderEditor(context({ candidates: [] }));
    await addRouteWith('地上経由', 'エレベーター');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('通信に失敗したら通知を出し、保存ボタンを押せる状態に戻す', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderEditor(context({ candidates: [] }));
    await addRouteWith('地上経由', 'エレベーター');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(notificationsShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: expect.stringContaining('通信できませんでした') }),
    ));
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('TransferPairEditor: 接続の備考', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  // 既存のルートが2組み合わせにだけ適用され、両方の備考が同じ（全方面共通の欄で表示される）
  const partial = () => context({
    candidates: [],
    connections: [
      { combo: 'inbound:inbound', notes: '一長一短です' },
      { combo: 'inbound:outbound', notes: '一長一短です' },
    ],
    routes: [{
      routeId: 'route-1',
      minutes: null,
      isOutdoor: false,
      requiresExitGate: false,
      requiresStaff: false,
      isOfficiallyGuided: false,
      notes: null,
      facilities: ['elevator'],
      links: [
        { combo: 'inbound:inbound', label: 'エレベーター経由', isBaseline: true },
        { combo: 'inbound:outbound', label: 'エレベーター経由', isBaseline: true },
      ],
      sharedWith: [],
    }],
  });

  it('全方面共通の欄のまま組み合わせを足すと、足した組み合わせにも表示中の備考を保存する', async () => {
    renderEditor(partial());
    expect(screen.getByRole('textbox', { name: '全方面共通の備考' })).toHaveValue('一長一短です');

    await userEvent.click(screen.getByRole('checkbox', { name: '池袋（丸ノ内線） outbound × 池袋（有楽町線） inbound' }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().connectionNotes).toEqual({
      'inbound:inbound': '一長一短です',
      'inbound:outbound': '一長一短です',
      'outbound:inbound': '一長一短です',
    });
  });
});
