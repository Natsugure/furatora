// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from './route';
import { RouteLabelTakenError, RouteOutOfScopeError } from '@/features/transfer-connection/ports';

const savePair = vi.fn();

vi.mock('@/di', () => ({
  transferConnectionRepository: {
    savePair: (...args: unknown[]) => savePair(...args),
  },
}));

const STATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const CONNECTED_ID = '660e8400-e29b-41d4-a716-446655440000';
const params = (over: Partial<{ stationId: string; connectedStationId: string }> = {}) => ({
  params: Promise.resolve({ stationId: STATION_ID, connectedStationId: CONNECTED_ID, ...over }),
});

const route = (over: Record<string, unknown> = {}) => ({
  routeId: null,
  label: '地上経由',
  isBaseline: true,
  minutes: null,
  isOutdoor: false,
  requiresExitGate: false,
  requiresStaff: false,
  isOfficiallyGuided: false,
  notes: null,
  facilities: ['elevator'],
  combos: ['inbound:inbound', 'inbound:outbound', 'outbound:inbound', 'outbound:outbound'],
  ...over,
});

const validBody = () => ({ routes: [route()], connectionNotes: {} });

function request(body: unknown) {
  return new Request('http://localhost/api/x/transfer', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PUT /api/stations/[stationId]/connections/[connectedStationId]/transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常な入力で保存し、成功を返す', async () => {
    savePair.mockResolvedValue(true);

    const response = await PUT(request(validBody()), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(savePair).toHaveBeenCalledWith(STATION_ID, CONNECTED_ID, validBody());
  });

  it('ルート0本（未評価に戻す）も保存できる', async () => {
    savePair.mockResolvedValue(true);

    const response = await PUT(request({ routes: [], connectionNotes: {} }), params());

    expect(response.status).toBe(200);
  });

  it('不正な JSON は 400 で、保存しない', async () => {
    const response = await PUT(
      new Request('http://localhost/x', { method: 'PUT', body: '{', headers: { 'Content-Type': 'application/json' } }),
      params(),
    );

    expect(response.status).toBe(400);
    expect(savePair).not.toHaveBeenCalled();
  });

  it('形が合わない入力（未知の設備コード）は 400', async () => {
    const response = await PUT(request({ routes: [route({ facilities: ['stair_lift'] })], connectionNotes: {} }), params());

    expect(response.status).toBe(400);
    expect(savePair).not.toHaveBeenCalled();
  });

  it('パスの id が UUID でなければ 404（500 にしない）', async () => {
    const response = await PUT(request(validBody()), params({ stationId: 'not-a-uuid' }));

    expect(response.status).toBe(404);
    expect(savePair).not.toHaveBeenCalled();
  });

  it('意味の検証に違反する入力（label が空）は 422 で、違反の一覧を返し、保存しない', async () => {
    const response = await PUT(request({ routes: [route({ label: ' ' })], connectionNotes: {} }), params());
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toEqual([expect.objectContaining({ code: 'label_required' })]);
    expect(savePair).not.toHaveBeenCalled();
  });

  it('基準ルートが同じ組み合わせに2本あると 422', async () => {
    const response = await PUT(
      request({ routes: [route({ label: 'A' }), route({ label: 'B' })], connectionNotes: {} }),
      params(),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).error).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'baseline_duplicate' })]),
    );
  });

  it('駅対が無い（Repository が null）と 404', async () => {
    savePair.mockResolvedValue(false);

    const response = await PUT(request(validBody()), params());

    expect(response.status).toBe(404);
  });

  it('範囲外の routeId は 422（メッセージを返す）', async () => {
    savePair.mockRejectedValue(new RouteOutOfScopeError());

    const response = await PUT(request(validBody()), params());

    expect(response.status).toBe(422);
    expect(typeof (await response.json()).error).toBe('string');
  });

  it('label の一意制約違反（競合）は 409「同じ名前のルートがあります」', async () => {
    savePair.mockRejectedValue(new RouteLabelTakenError());

    const response = await PUT(request(validBody()), params());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: '同じ名前のルートがあります' });
  });

  it('想定外のエラーは 500', async () => {
    savePair.mockRejectedValue(new Error('boom'));

    const response = await PUT(request(validBody()), params());

    expect(response.status).toBe(500);
  });
});
