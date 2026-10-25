// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from './route';

const getTrain = vi.fn();

vi.mock('@/di', () => ({
  trainEditPageQuery: {
    getTrain: (...args: unknown[]) => getTrain(...args),
  },
}));

// src/app/** は ESLint で @furatora/database/client を import できないため、
// モックは vi.hoisted で作って参照する。import 時に DATABASE_URL へ接続させない役目もある
const db = vi.hoisted(() => ({
  update: vi.fn(),
  delete: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@furatora/database/client', () => ({ db }));

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

  function putRequest() {
    return new Request(`http://localhost/api/trains/${TRAIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '10000系',
        operatorId: OPERATOR_ID,
        lineIds: [LINE_ID],
        carCount: 1,
        carStructure: [{ carNumber: 1, doorCount: 4, carLength: 20.5 }],
        freeSpaces: [{ carNumber: 1, nearDoor: 2, isStandard: true }],
        prioritySeats: null,
      }),
    });
  }

  function mockUpdateReturning(rows: unknown[]) {
    const returning = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    db.update.mockReturnValue({ set });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    db.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    db.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it('更新できたら { success: true } を 200 で返し、列車を読み直さない', async () => {
    mockUpdateReturning([{ id: TRAIN_ID }]);

    const res = await PUT(putRequest(), { params: mockParams });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(getTrain).not.toHaveBeenCalled();
  });

  it('列車が無ければ 404 を返し、号車構成・設備に触れない', async () => {
    mockUpdateReturning([]);

    const res = await PUT(putRequest(), { params: mockParams });

    expect(res.status).toBe(404);
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
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

  it('PUT: UUID の形でない trainId は404を返し、DB を呼ばない', async () => {
    const res = await PUT(
      new Request('http://localhost/api/trains/not-a-uuid', { method: 'PUT', body: '{}' }),
      { params: Promise.resolve({ trainId: 'not-a-uuid' }) },
    );

    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });
});
