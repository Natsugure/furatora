// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { PlanTokenMismatchError, ImportBlockedError } from '@/features/master-import/ports';
import type { EkidataCsvFiles } from '@/features/master-import/ports';
import type { ImportSummary } from '@/features/master-import/domain/importedRecords';

const planImport = vi.fn();
const applyImport = vi.fn();

vi.mock('@/di', () => ({
  planImport: (...args: unknown[]) => planImport(...args),
  applyImport: (...args: unknown[]) => applyImport(...args),
}));

const SUMMARY: ImportSummary = {
  operators: { created: 162, updated: 0, unchanged: 0, abolished: 0 },
  lines: { created: 602, updated: 0, unchanged: 0, abolished: 0 },
  stationGroups: { created: 8782, updated: 0, unchanged: 0, abolished: 0 },
  stations: { created: 10625, updated: 0, unchanged: 0, abolished: 0 },
  stationLines: { created: 10625 },
  stationAdjacencies: { created: 10040 },
  stationConnections: { upperBound: 6946 },
};

/**
 * station CSV は実データで 1.7MB ある。Server Action の既定ボディ上限 1MB を
 * 超えるため Route Handler を選んだ（docs/spec/design.md）。その前提を実際に踏む
 */
function hugeStationCsv(): string {
  const header =
    'station_cd,station_g_cd,station_name,station_name_k,station_name_r,line_cd,pref_cd,post,address,lon,lat,open_ymd,close_ymd,e_status,e_sort';
  const rows: string[] = [];
  for (let i = 0; i < 11000; i++) {
    const cd = 100000 + i;
    rows.push(
      `${cd},${cd},計測駅${i},ケイソクエキ${i},keisokueki${i},1001,13,100-0005,千代田区丸の内一丁目9-1,139.766084,35.681382,1914-12-20,0000-00-00,0,${cd}`,
    );
  }
  return [header, ...rows].join('\n');
}

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
  return new Request('http://localhost:3001/api/master-import', { method: 'POST', body });
}

beforeEach(() => {
  planImport.mockReset();
  applyImport.mockReset();
  planImport.mockResolvedValue({ ok: true, summary: SUMMARY, warnings: [], blockers: [], planToken: 'tok' });
});

describe('POST /api/master-import', () => {
  it('plan で差分と planToken を返す', async () => {
    const response = await POST(request(formData({ mode: 'plan' })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      mode: 'plan',
      summary: SUMMARY,
      warnings: [],
      blockers: [],
      planToken: 'tok',
    });
  });

  // TASK-2.6 の完了条件
  it('1.7MB の station CSV を受け付け、欠けずに渡す', async () => {
    const station = hugeStationCsv();
    expect(station.length).toBeGreaterThan(1_400_000);

    const response = await POST(request(formData({ mode: 'plan', station })));

    expect(response.status).toBe(200);
    const files = planImport.mock.calls[0]![0] as EkidataCsvFiles;
    expect(files.station).toBe(station);
  });

  it('apply で planToken を添えて適用する', async () => {
    applyImport.mockResolvedValue({ ok: true, applied: { stationConnections: { created: 6946 } } });

    const response = await POST(request(formData({ mode: 'apply', planToken: 'tok' })));

    expect(response.status).toBe(200);
    expect(applyImport.mock.calls[0]![1]).toBe('tok');
  });
});

describe('入力の検証', () => {
  it('mode が無ければ 400', async () => {
    const response = await POST(request(formData()));
    expect(response.status).toBe(400);
  });

  it('CSVが欠けていれば、どれが足りないかを 400 で返す', async () => {
    const response = await POST(request(formData({ mode: 'plan', join: undefined })));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ missing: ['join'] });
  });

  it('apply に planToken が無ければ 400', async () => {
    const response = await POST(request(formData({ mode: 'apply' })));
    expect(response.status).toBe(400);
    expect(applyImport).not.toHaveBeenCalled();
  });

  // REQ-1.4
  it('必須列の欠落を 400 とファイル名・列名で返す', async () => {
    planImport.mockResolvedValue({
      ok: false,
      errors: [{ kind: 'missing_columns', file: 'station', columns: ['line_cd'] }],
    });

    const response = await POST(request(formData({ mode: 'plan' })));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      details: [{ kind: 'missing_columns', file: 'station', columns: ['line_cd'] }],
    });
  });
});

describe('適用の拒否', () => {
  it('planToken が一致しなければ 409', async () => {
    applyImport.mockRejectedValue(new PlanTokenMismatchError());

    const response = await POST(request(formData({ mode: 'apply', planToken: 'other' })));

    expect(response.status).toBe(409);
  });

  it('適用不能な事象が残っていれば 422', async () => {
    applyImport.mockRejectedValue(new ImportBlockedError());

    const response = await POST(request(formData({ mode: 'apply', planToken: 'tok' })));

    expect(response.status).toBe(422);
  });

  it('それ以外の失敗は 500 で、原因が分かるメッセージを返す', async () => {
    applyImport.mockRejectedValue(new Error('line_cd (9999) を解決できない'));

    const response = await POST(request(formData({ mode: 'apply', planToken: 'tok' })));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'line_cd (9999) を解決できない' });
  });
});
