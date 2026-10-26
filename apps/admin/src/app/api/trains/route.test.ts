// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const create = vi.fn();

vi.mock('@/di', () => ({
  trainRepository: {
    create: (...args: unknown[]) => create(...args),
  },
}));

const TRAIN_ID = '550e8400-e29b-41d4-a716-446655440000';
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

function request(payload: unknown = body) {
  return new Request('http://localhost/api/trains', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/trains', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('検証済みの入力で Repository を呼び、作った列車の id を 201 で返す', async () => {
    create.mockResolvedValue({ id: TRAIN_ID });

    const res = await POST(request());

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: TRAIN_ID });
    expect(create).toHaveBeenCalledWith(body);
  });

  it('入力が不正なら 400 を返し、Repository を呼ばない', async () => {
    const res = await POST(request({ ...body, carCount: 0 }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('書き込みで例外が出たら 500 を返す', async () => {
    create.mockRejectedValue(new Error('db error'));

    const res = await POST(request());

    expect(res.status).toBe(500);
  });
});
