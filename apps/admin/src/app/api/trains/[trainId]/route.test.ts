// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

const getTrain = vi.fn();

vi.mock('@/di', () => ({
  trainEditPageQuery: {
    getTrain: (...args: unknown[]) => getTrain(...args),
  },
}));

// PUT/DELETE が使う db は GET では呼ばれない。import 時に接続しないよう空にする
vi.mock('@furatora/database/client', () => ({ db: {} }));

const TRAIN_ID = '550e8400-e29b-41d4-a716-446655440000';
const mockParams = Promise.resolve({ trainId: TRAIN_ID });

function request() {
  return new Request(`http://localhost/api/trains/${TRAIN_ID}`);
}

describe('GET /api/trains/[trainId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('列車の DTO を 200 で返す', async () => {
    const train = {
      id: TRAIN_ID,
      name: '10000系',
      operatorId: 'operator-1',
      lineIds: ['line-1'],
      carCount: 1,
      carStructure: [{ carNumber: 1, doorCount: 4, carLength: 20.5 }],
      freeSpaces: [],
      prioritySeats: [],
    };
    getTrain.mockResolvedValue(train);

    const res = await GET(request(), { params: mockParams });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(train);
    expect(getTrain).toHaveBeenCalledWith(TRAIN_ID);
  });

  it('列車が無ければ 404 を返す', async () => {
    getTrain.mockResolvedValue(null);

    const res = await GET(request(), { params: mockParams });

    expect(res.status).toBe(404);
  });

  it('読み取りで例外が出たら 500 を返す', async () => {
    getTrain.mockRejectedValue(new Error('db error'));

    const res = await GET(request(), { params: mockParams });

    expect(res.status).toBe(500);
  });
});
