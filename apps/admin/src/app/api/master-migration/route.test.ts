// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { PlanTokenMismatchError } from '@/features/master-import/ports';
import { MigrationBlockedError } from '@/features/master-migration/ports';
import type { MigrationSummary } from '@/features/master-migration/usecases/planMigration';

const planMigration = vi.fn();
const applyMigration = vi.fn();

vi.mock('@/di', () => ({
  planMigration: (...args: unknown[]) => planMigration(...args),
  applyMigration: (...args: unknown[]) => applyMigration(...args),
}));

const NO_METHODS = { manual: 0, name: 0, stationContainment: 0 };
const SUMMARY: MigrationSummary = {
  operators: { total: 17, assigned: 17, alreadySet: 0, unmatched: 0, byMethod: { ...NO_METHODS, manual: 17 } },
  lines: { total: 62, assigned: 46, alreadySet: 0, unmatched: 16, byMethod: { ...NO_METHODS, name: 46 } },
  stations: { total: 481, assigned: 465, alreadySet: 0, unmatched: 16, byMethod: { ...NO_METHODS, name: 465 } },
  connections: { total: 546, replaceable: 546, withInput: 0 },
};
const NO_UNMATCHED = { operators: [], lines: [], stations: [] };

function formData(overrides: Partial<Record<string, string | undefined>> = {}) {
  const base: Record<string, string> = {
    company: 'company_cd\n1',
    line: 'line_cd\n1001',
    station: 'station_cd\n100101',
    join: 'line_cd\n1001',
  };
  const body = new FormData();
  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    if (value === undefined) continue;
    if (key === 'mode' || key === 'planToken') body.set(key, value);
    else body.set(key, new File([value], `${key}.csv`, { type: 'text/csv' }));
  }
  return body;
}

function request(body: FormData) {
  return new Request('http://localhost:3001/api/master-migration', { method: 'POST', body });
}

beforeEach(() => {
  planMigration.mockReset();
  applyMigration.mockReset();
});

describe('POST /api/master-migration', () => {
  it('試算の結果を返す', async () => {
    planMigration.mockResolvedValue({
      ok: true,
      summary: SUMMARY,
      unmatched: NO_UNMATCHED,
      blockers: [],
      planToken: 'token',
    });

    const response = await POST(request(formData({ mode: 'plan' })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mode: 'plan', planToken: 'token' });
  });

  it('mode が不正なら 400', async () => {
    const response = await POST(request(formData({ mode: 'migrate' })));

    expect(response.status).toBe(400);
    expect(planMigration).not.toHaveBeenCalled();
  });

  it('CSV が欠けていれば、どれが無いかを返して 400', async () => {
    const response = await POST(request(formData({ mode: 'plan', join: undefined })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ missing: ['join'] });
  });

  it('必須列が欠けていれば 400 で内訳を返す', async () => {
    planMigration.mockResolvedValue({
      ok: false,
      errors: [{ kind: 'missing_columns', file: 'line', columns: ['company_cd'] }],
    });

    const response = await POST(request(formData({ mode: 'plan' })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: [{ file: 'line', columns: ['company_cd'] }],
    });
  });

  it('planToken が無ければ適用しない', async () => {
    const response = await POST(request(formData({ mode: 'apply' })));

    expect(response.status).toBe(400);
    expect(applyMigration).not.toHaveBeenCalled();
  });

  it('試算とは別のCSVで適用しようとしたら 409', async () => {
    applyMigration.mockRejectedValue(new PlanTokenMismatchError());

    const response = await POST(request(formData({ mode: 'apply', planToken: 'stale' })));

    expect(response.status).toBe(409);
  });

  it('適用不能な事象が残っていれば 422', async () => {
    applyMigration.mockRejectedValue(new MigrationBlockedError());

    const response = await POST(request(formData({ mode: 'apply', planToken: 'token' })));

    expect(response.status).toBe(422);
  });

  it('適用に失敗したら原因を残して 500', async () => {
    applyMigration.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    const response = await POST(request(formData({ mode: 'apply', planToken: 'token' })));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'duplicate key value violates unique constraint',
    });
  });

  it('適用した件数を返す', async () => {
    applyMigration.mockResolvedValue({
      ok: true,
      applied: {
        operators: { assigned: 17 },
        lines: { assigned: 46 },
        stations: { assigned: 465 },
        stationConnections: { deleted: 546 },
      },
    });

    const response = await POST(request(formData({ mode: 'apply', planToken: 'token' })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mode: 'apply',
      applied: { stationConnections: { deleted: 546 } },
    });
  });
});
