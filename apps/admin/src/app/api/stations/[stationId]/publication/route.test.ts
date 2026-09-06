// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from './route';

const publish = vi.fn();
const unpublish = vi.fn();

vi.mock('@/di', () => ({
  stationPublishingRepository: {
    publish: (...args: unknown[]) => publish(...args),
    unpublish: (...args: unknown[]) => unpublish(...args),
  },
}));

const STATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const mockParams = Promise.resolve({ stationId: STATION_ID });

function request(body: unknown) {
  return new Request(`http://localhost/api/stations/${STATION_ID}/publication`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function rawRequest(rawBody: string) {
  return new Request(`http://localhost/api/stations/${STATION_ID}/publication`, {
    method: 'PATCH',
    body: rawBody,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PATCH /api/stations/[stationId]/publication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publish: 正常なリクエストで公開し成功を返す', async () => {
    publish.mockResolvedValue(true);

    const response = await PATCH(request({ action: 'publish', slug: 'jr-east-yamanote-shinjuku' }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(publish).toHaveBeenCalledWith(STATION_ID, 'jr-east-yamanote-shinjuku');
  });

  it('unpublish: 正常なリクエストで非公開に戻す', async () => {
    unpublish.mockResolvedValue(true);

    const response = await PATCH(request({ action: 'unpublish' }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(unpublish).toHaveBeenCalledWith(STATION_ID);
  });

  it('slug が不正な形式の場合は400を返す', async () => {
    const response = await PATCH(request({ action: 'publish', slug: 'Shinjuku_駅' }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(publish).not.toHaveBeenCalled();
  });

  it('action が不正な場合は400を返す', async () => {
    const response = await PATCH(request({ action: 'delete' }), { params: mockParams });

    expect(response.status).toBe(400);
  });

  it('slug の先頭・末尾・連続ハイフンは400を返す', async () => {
    for (const slug of ['-shinjuku', 'shinjuku-', 'jr--east', '---']) {
      const response = await PATCH(request({ action: 'publish', slug }), { params: mockParams });
      expect(response.status).toBe(400);
    }
    expect(publish).not.toHaveBeenCalled();
  });

  it('ボディが空の場合は500ではなく400を返す', async () => {
    const response = await PATCH(rawRequest(''), { params: mockParams });

    expect(response.status).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });

  it('ボディが不正な JSON の場合は500ではなく400を返す', async () => {
    const response = await PATCH(rawRequest('{ not json'), { params: mockParams });

    expect(response.status).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });

  it('対象の駅が存在しない場合は404を返す', async () => {
    publish.mockResolvedValue(false);

    const response = await PATCH(request({ action: 'publish', slug: 'jr-east-yamanote-shinjuku' }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Not found' });
  });

  it('所属路線に slug が無い場合は422を返す', async () => {
    const { LineSlugMissingError } = await import('@/features/station-publishing/ports');
    publish.mockRejectedValue(new LineSlugMissingError());

    const response = await PATCH(request({ action: 'publish', slug: 'jr-east-yamanote-shinjuku' }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data).toHaveProperty('error');
  });

  it('slug が他の駅と衝突した場合は409を返す', async () => {
    const { SlugTakenError } = await import('@/features/station-publishing/ports');
    publish.mockRejectedValue(new SlugTakenError());

    const response = await PATCH(request({ action: 'publish', slug: 'jr-east-yamanote-shinjuku' }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toHaveProperty('error');
  });

  it('未知の例外の場合は500を返す', async () => {
    publish.mockRejectedValue(new Error('DB error'));

    const response = await PATCH(request({ action: 'publish', slug: 'jr-east-yamanote-shinjuku' }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});
