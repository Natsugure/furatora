// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectionDefaultConflictError } from '@/features/line/ports';
import { PUT } from './route';

const update = vi.fn();

vi.mock('@/di', () => ({
  lineDirectionRepository: {
    update: (...args: unknown[]) => update(...args),
  },
}));

// GET・DELETE は db を直接使う（#130 の対象外）。PUT のテストでは読み込まれるだけなので空にする
vi.mock('@furatora/database/client', () => ({ db: {} }));

const LINE_ID = '550e8400-e29b-41d4-a716-446655440000';
const DIRECTION_ID = '550e8400-e29b-41d4-a716-446655440002';
const STATION_ID = '550e8400-e29b-41d4-a716-446655440001';
const params = { params: Promise.resolve({ lineId: LINE_ID, directionId: DIRECTION_ID }) };

function request(body: string) {
  return new Request(`http://localhost/api/lines/${LINE_ID}/directions/${DIRECTION_ID}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
}

const validBody = {
  directionType: 'inbound',
  representativeStationId: STATION_ID,
  displayName: '荻窪・方南町方面',
  isDefault: true,
};

describe('PUT /api/lines/[lineId]/directions/[directionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストで200と更新行を返す', async () => {
    const updated = { id: DIRECTION_ID, lineId: LINE_ID, ...validBody };
    update.mockResolvedValue(updated);

    const response = await PUT(request(JSON.stringify(validBody)), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(updated);
    expect(update).toHaveBeenCalledWith(LINE_ID, DIRECTION_ID, expect.objectContaining({ isDefault: true }));
  });

  it('方面が無い（別路線を含む）場合は404を返す', async () => {
    update.mockResolvedValue(null);

    const response = await PUT(request(JSON.stringify(validBody)), params);

    expect(response.status).toBe(404);
  });

  it('不正な JSON は400を返す', async () => {
    const response = await PUT(request('not json'), params);

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('同じ組の既定が同時に変更されたら409を返す', async () => {
    update.mockRejectedValue(new DirectionDefaultConflictError());

    const response = await PUT(request(JSON.stringify(validBody)), params);

    expect(response.status).toBe(409);
  });
});
