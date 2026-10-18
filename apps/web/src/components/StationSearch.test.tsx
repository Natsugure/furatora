import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StationSearch } from './StationSearch';
import type { StationGroup, StationInGroup, StationSearchApiResponse } from '@/types';

function stationInGroup(overrides: Partial<StationInGroup> & { id: string }): StationInGroup {
  return {
    slug: overrides.id,
    code: null,
    lineId: null,
    lineName: null,
    lineCode: null,
    lineColor: null,
    lineSlug: null,
    ...overrides,
  };
}

const ginza: StationGroup = {
  name: '銀座',
  nameEn: 'Ginza',
  stations: [
    stationInGroup({ id: 'tokyometro-ginza-ginza', code: 'G09', lineName: '東京メトロ銀座線', lineColor: '#F39700' }),
    stationInGroup({ id: 'unknown-ginza' }),
  ],
};

const fetchMock = vi.fn<typeof fetch>();

function respondWith(groups: StationGroup[]) {
  const body: StationSearchApiResponse = { stationGroups: groups, total: groups.length };
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

function typeQuery(text: string) {
  return userEvent.type(screen.getByRole('searchbox', { name: '駅名' }), text);
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('StationSearch', () => {
  it('ラベル「駅名」の検索欄を出し、入力するまで検索しない', () => {
    render(<StationSearch />);
    expect(screen.getByRole('searchbox', { name: '駅名' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('入力した駅名で検索し、駅ごとに路線の行をリンクで出す', async () => {
    respondWith([ginza]);
    render(<StationSearch />);
    await typeQuery('銀座');

    const link = await screen.findByRole('link', { name: /東京メトロ銀座線/ });
    expect(link).toHaveAttribute('href', '/stations/tokyometro-ginza-ginza');
    expect(screen.getByText('銀座')).toBeInTheDocument();
    expect(screen.getByText('Ginza')).toBeInTheDocument();
    expect(screen.getByText('G09')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/v1/stations?q=${encodeURIComponent('銀座')}`);
  });

  it('路線名が無い駅は「不明な路線」と出す', async () => {
    respondWith([ginza]);
    render(<StationSearch />);
    await typeQuery('銀座');
    expect(await screen.findByRole('link', { name: /不明な路線/ })).toHaveAttribute('href', '/stations/unknown-ginza');
  });

  it('路線名の文字には路線色を使わない（白地とのコントラストが足りない路線色があるため）', async () => {
    respondWith([ginza]);
    render(<StationSearch />);
    await typeQuery('銀座');
    expect((await screen.findByText('東京メトロ銀座線')).style.color).toBe('');
  });

  it('一致する駅が無ければ、その旨を出す', async () => {
    respondWith([]);
    render(<StationSearch />);
    await typeQuery('ない駅');
    expect(await screen.findByText('「ない駅」に一致する駅が見つかりませんでした')).toBeInTheDocument();
  });

  it('API がエラーを返したら、エラーの文言を出す', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    render(<StationSearch />);
    await typeQuery('銀座');
    expect(await screen.findByText(/検索中にエラーが発生しました/)).toBeInTheDocument();
  });

  it('通信に失敗したら、エラーの文言を出す', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    render(<StationSearch />);
    await typeQuery('銀座');
    expect(await screen.findByText(/検索中にエラーが発生しました/)).toBeInTheDocument();
  });

  it('検索に失敗した後、確定するクエリが変わらない入力をしても、前の検索の結果を出さない', async () => {
    const ginzaBody: StationSearchApiResponse = { stationGroups: [ginza], total: 1 };
    fetchMock.mockImplementation(async (input) =>
      String(input).includes(encodeURIComponent('渋谷'))
        ? new Response('', { status: 500 })
        : new Response(JSON.stringify(ginzaBody), { status: 200 }));
    render(<StationSearch />);
    const searchbox = screen.getByRole('searchbox', { name: '駅名' });

    await userEvent.type(searchbox, '銀座');
    await screen.findByRole('link', { name: /東京メトロ銀座線/ });
    await userEvent.clear(searchbox);
    await userEvent.type(searchbox, '渋谷');
    expect(await screen.findByText(/検索中にエラーが発生しました/)).toBeInTheDocument();

    // trim すると「渋谷」のままなので、再検索はされない
    await userEvent.type(searchbox, ' ');
    expect(screen.getByText(/検索中にエラーが発生しました/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /東京メトロ銀座線/ })).not.toBeInTheDocument();
  });

  it('空白だけの入力では検索しない', () => {
    vi.useFakeTimers();
    render(<StationSearch />);
    // user-event の非同期の操作は、偽のタイマーの下では RTL が setTimeout で待ったまま進まない。同期の fireEvent で入力する
    fireEvent.change(screen.getByRole('searchbox', { name: '駅名' }), { target: { value: '   ' } });
    // 入力の確定（300ms）まで時計を進めてから確かめる
    act(() => { vi.advanceTimersByTime(300); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('続けて入力したときは、入力が止まってから1回だけ検索する', async () => {
    respondWith([ginza]);
    render(<StationSearch />);
    await typeQuery('銀座');
    await screen.findByRole('link', { name: /東京メトロ銀座線/ });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
