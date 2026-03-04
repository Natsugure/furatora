import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from './route';

vi.mock('@furatora/database/client', () => ({
  db: {
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@furatora/database/schema', () => ({
  operators: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

const OPERATOR_ID = '550e8400-e29b-41d4-a716-446655440000';
const mockOperator = {
  id: OPERATOR_ID,
  name: 'JR東日本',
  odptOperatorId: null,
  displayPriority: null,
};
const mockParams = Promise.resolve({ operatorId: OPERATOR_ID });

describe('PUT /api/operators/[operatorId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストでオペレーターを更新して返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockResolvedValue([mockOperator]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as ReturnType<typeof db.update>);

    const request = new Request(`http://localhost/api/operators/${OPERATOR_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'JR東日本' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockOperator);
  });

  it('バリデーションエラーの場合は400を返す', async () => {
    const request = new Request(`http://localhost/api/operators/${OPERATOR_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('存在しないオペレーターの場合は404を返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as ReturnType<typeof db.update>);

    const request = new Request(`http://localhost/api/operators/${OPERATOR_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'JR東日本' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Not found' });
  });

  it('DB例外が発生した場合は500を返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockRejectedValue(new Error('DB error'));
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as ReturnType<typeof db.update>);

    const request = new Request(`http://localhost/api/operators/${OPERATOR_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'JR東日本' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});

describe('DELETE /api/operators/[operatorId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常に削除して成功レスポンスを返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockResolvedValue([mockOperator]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as ReturnType<typeof db.delete>);

    const request = new Request(`http://localhost/api/operators/${OPERATOR_ID}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('存在しないオペレーターの場合は404を返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as ReturnType<typeof db.delete>);

    const request = new Request(`http://localhost/api/operators/${OPERATOR_ID}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Not found' });
  });

  it('DB例外が発生した場合は500を返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockRejectedValue(new Error('DB error'));
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as ReturnType<typeof db.delete>);

    const request = new Request(`http://localhost/api/operators/${OPERATOR_ID}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});
