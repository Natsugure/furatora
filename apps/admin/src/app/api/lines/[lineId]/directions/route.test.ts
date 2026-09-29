// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectionDefaultConflictError } from '@/features/line/ports';
import { POST } from './route';

const create = vi.fn();

vi.mock('@/di', () => ({
  lineDirectionRepository: {
    create: (...args: unknown[]) => create(...args),
  },
}));

const LINE_ID = '550e8400-e29b-41d4-a716-446655440000';
const STATION_ID = '550e8400-e29b-41d4-a716-446655440001';
const params = { params: Promise.resolve({ lineId: LINE_ID }) };

function request(body: string) {
  return new Request(`http://localhost/api/lines/${LINE_ID}/directions`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
}

const validBody = {
  directionType: 'outbound',
  displayName: '池袋方面',
  isDefault: false,
};

describe('POST /api/lines/[lineId]/directions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストで201と作成行を返す。省略した任意項目は null で作る', async () => {
    const created = { id: 'direction-1', lineId: LINE_ID, ...validBody };
    create.mockResolvedValue(created);

    const response = await POST(request(JSON.stringify(validBody)), params);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(created);
    expect(create).toHaveBeenCalledWith(LINE_ID, {
      directionType: 'outbound',
      displayName: '池袋方面',
      displayNameEn: null,
      notes: null,
      isDefault: false,
    });
  });

  it('代表駅・終点駅を送られても Repository に渡さない（#129 で廃止した項目。旧クライアントからの送信を受け付ける）', async () => {
    create.mockResolvedValue({ id: 'direction-1' });

    const response = await POST(
      request(JSON.stringify({ ...validBody, representativeStationId: STATION_ID, terminalStationIds: [STATION_ID] })),
      params,
    );

    expect(response.status).toBe(201);
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty('representativeStationId');
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty('terminalStationIds');
  });

  it('isDefault: true を Repository に渡す', async () => {
    create.mockResolvedValue({ id: 'direction-1' });

    await POST(request(JSON.stringify({ ...validBody, isDefault: true })), params);

    expect(create).toHaveBeenCalledWith(LINE_ID, expect.objectContaining({ isDefault: true }));
  });

  it('不正な JSON は400を返し、Repository を呼ばない', async () => {
    const response = await POST(request('{'), params);

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('検証に失敗したら400を返す', async () => {
    const response = await POST(request(JSON.stringify({ ...validBody, displayName: '' })), params);

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('同じ組の既定が同時に変更されたら409を返す', async () => {
    create.mockRejectedValue(new DirectionDefaultConflictError());

    const response = await POST(request(JSON.stringify({ ...validBody, isDefault: true })), params);

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(new DirectionDefaultConflictError().message);
  });

  it('想定外の例外は500を返す', async () => {
    create.mockRejectedValue(new Error('boom'));

    const response = await POST(request(JSON.stringify(validBody)), params);

    expect(response.status).toBe(500);
  });
});
