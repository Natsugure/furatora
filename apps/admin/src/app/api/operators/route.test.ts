import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';

vi.mock('@furatora/database/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@furatora/database/schema', () => ({
  operators: {},
}));

vi.mock('drizzle-orm', () => ({
  asc: vi.fn(),
}));

const mockOperator = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'JR東日本',
  odptOperatorId: null,
  displayPriority: null,
};

describe('GET /api/operators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('オペレーター一覧を返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockOrderBy = vi.fn().mockResolvedValue([mockOperator]);
    const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as ReturnType<typeof db.select>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([mockOperator]);
  });

  it('DB例外が発生した場合は500を返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockOrderBy = vi.fn().mockRejectedValue(new Error('DB error'));
    const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as ReturnType<typeof db.select>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});

describe('POST /api/operators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストで201とオペレーターを返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockResolvedValue([mockOperator]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as ReturnType<typeof db.insert>);

    const request = new Request('http://localhost/api/operators', {
      method: 'POST',
      body: JSON.stringify({ name: 'JR東日本' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(mockOperator);
  });

  it('バリデーションエラーの場合は400を返す', async () => {
    const request = new Request('http://localhost/api/operators', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('DB例外が発生した場合は500を返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockRejectedValue(new Error('DB error'));
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as ReturnType<typeof db.insert>);

    const request = new Request('http://localhost/api/operators', {
      method: 'POST',
      body: JSON.stringify({ name: 'JR東日本' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});
