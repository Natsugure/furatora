// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from './route';

const getTrain = vi.fn();
const update = vi.fn();
const remove = vi.fn();

vi.mock('@/di', () => ({
  trainEditPageQuery: {
    getTrain: (...args: unknown[]) => getTrain(...args),
  },
  trainRepository: {
    update: (...args: unknown[]) => update(...args),
    delete: (...args: unknown[]) => remove(...args),
  },
}));

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

describe('PUT /api/trains/[trainId]', () => {
  const OPERATOR_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const LINE_ID = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
  const body = {
    name: '10000系',
    operatorId: OPERATOR_ID,
    lineIds: [LINE_ID],
    carCount: 1,
    carStructure: [{ carNumber: 1, doorCount: 4, carLength: 20.5 }],
    freeSpaces: [{ carNumber: 1, nearDoor: 2, isStandard: true }],
    prioritySeats: null,
  };

  function putRequest(payload: unknown = body) {
    return new Request(`http://localhost/api/trains/${TRAIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('検証済みの入力で Repository を呼び、{ success: true } を 200 で返す。列車は読み直さない', async () => {
    update.mockResolvedValue(true);

    const res = await PUT(putRequest(), { params: mockParams });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(update).toHaveBeenCalledWith(TRAIN_ID, body);
    expect(getTrain).not.toHaveBeenCalled();
  });

  it('列車が無ければ 404 を返す', async () => {
    update.mockResolvedValue(false);

    const res = await PUT(putRequest(), { params: mockParams });

    expect(res.status).toBe(404);
  });

  it('入力が不正なら 400 を返し、Repository を呼ばない', async () => {
    const res = await PUT(putRequest({ ...body, name: '' }), { params: mockParams });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('書き込みで例外が出たら 500 を返す', async () => {
    update.mockRejectedValue(new Error('db error'));

    const res = await PUT(putRequest(), { params: mockParams });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/trains/[trainId]', () => {
  function deleteRequest() {
    return new Request(`http://localhost/api/trains/${TRAIN_ID}`, { method: 'DELETE' });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('消せたら { success: true } を 200 で返す', async () => {
    remove.mockResolvedValue(true);

    const res = await DELETE(deleteRequest(), { params: mockParams });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith(TRAIN_ID);
  });

  it('列車が無ければ 404 を返す', async () => {
    remove.mockResolvedValue(false);

    const res = await DELETE(deleteRequest(), { params: mockParams });

    expect(res.status).toBe(404);
  });

  it('削除で例外が出たら 500 を返す', async () => {
    remove.mockRejectedValue(new Error('db error'));

    const res = await DELETE(deleteRequest(), { params: mockParams });

    expect(res.status).toBe(500);
  });
});

describe('パスパラメータの検証（#108・#160）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET: UUID の形でない trainId は404を返し、Query を呼ばない', async () => {
    const res = await GET(request(), { params: Promise.resolve({ trainId: 'not-a-uuid' }) });

    expect(res.status).toBe(404);
    expect(getTrain).not.toHaveBeenCalled();
  });

  it('GET: 大文字の trainId は小文字にして Query に渡す', async () => {
    getTrain.mockResolvedValue(null);

    await GET(request(), { params: Promise.resolve({ trainId: TRAIN_ID.toUpperCase() }) });

    expect(getTrain).toHaveBeenCalledWith(TRAIN_ID);
  });

  it('PUT: UUID の形でない trainId は404を返し、Repository を呼ばない', async () => {
    const res = await PUT(
      new Request('http://localhost/api/trains/not-a-uuid', { method: 'PUT', body: '{}' }),
      { params: Promise.resolve({ trainId: 'not-a-uuid' }) },
    );

    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('DELETE: UUID の形でない trainId は404を返し、Repository を呼ばない', async () => {
    const res = await DELETE(
      new Request('http://localhost/api/trains/not-a-uuid', { method: 'DELETE' }),
      { params: Promise.resolve({ trainId: 'not-a-uuid' }) },
    );

    expect(res.status).toBe(404);
    expect(remove).not.toHaveBeenCalled();
  });
});
