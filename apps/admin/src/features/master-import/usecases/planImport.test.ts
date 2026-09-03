import { describe, it, expect, vi } from 'vitest';
import { makePlanImport } from './planImport';
import type { EkidataCsvFiles, EkidataCsvSource, MasterImportRepository } from '../ports';
import type { ImportedRecords, MasterSnapshot } from '../domain/importedRecords';

const FILES: EkidataCsvFiles = { company: 'c', line: 'l', station: 's', join: 'j' };

const EMPTY_SNAPSHOT: MasterSnapshot = {
  operators: [],
  lines: [],
  stationGroups: [],
  stations: [],
  stationLinePairs: [],
  stationAdjacencyKeys: [],
};

const RECORDS: ImportedRecords = {
  operators: [{ ekidataCompanyCd: 18, name: '東京メトロ' }],
  lines: [],
  stationGroups: [],
  stations: [],
  adjacencies: [],
  closures: { lines: new Map(), stations: new Map() },
  seen: { lines: new Set(), stations: new Set() },
  warnings: [{ code: 'dangling_station_group', count: 59, samples: ['x'] }],
};

function source(overrides: Partial<EkidataCsvSource> = {}): EkidataCsvSource {
  return {
    parse: () => ({ ok: true, records: RECORDS }),
    digest: async () => 'digest-abc',
    ...overrides,
  };
}

function repository(overrides: Partial<MasterImportRepository> = {}): MasterImportRepository {
  return {
    loadSnapshot: async () => EMPTY_SNAPSHOT,
    apply: async () => {
      throw new Error('apply は呼ばれてはならない');
    },
    ...overrides,
  };
}

describe('planImport', () => {
  it('件数・警告・planToken を返す', async () => {
    const planImport = makePlanImport({ source: source(), repository: repository() });

    const result = await planImport(FILES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.operators.created).toBe(1);
    expect(result.warnings).toEqual(RECORDS.warnings);
    expect(result.planToken).toBe('digest-abc');
  });

  it('DB を変更しない', async () => {
    const apply = vi.fn();
    const planImport = makePlanImport({ source: source(), repository: repository({ apply }) });

    await planImport(FILES);

    expect(apply).not.toHaveBeenCalled();
  });

  it('パースに失敗したらスナップショットを読まずにエラーを返す', async () => {
    const loadSnapshot = vi.fn(async () => EMPTY_SNAPSHOT);
    const planImport = makePlanImport({
      source: source({
        parse: () => ({
          ok: false,
          errors: [{ kind: 'missing_columns', file: 'station', columns: ['line_cd'] }],
        }),
      }),
      repository: repository({ loadSnapshot }),
    });

    const result = await planImport(FILES);

    expect(result).toEqual({
      ok: false,
      errors: [{ kind: 'missing_columns', file: 'station', columns: ['line_cd'] }],
    });
    expect(loadSnapshot).not.toHaveBeenCalled();
  });

  it('適用不能な事象を提示する（DBには触れたまま止まらない）', async () => {
    const planImport = makePlanImport({
      source: source(),
      repository: repository({
        loadSnapshot: async () => ({
          ...EMPTY_SNAPSHOT,
          operators: [{ id: 'op-1', name: '東京メトロ', ekidataCompanyCd: null }],
        }),
      }),
    });

    const result = await planImport(FILES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blockers).toEqual([
      { code: 'operator_name_conflict', count: 1, samples: ['company_cd=18 name=東京メトロ'] },
    ]);
  });

  it('廃止日の既定値に、注入された現在時刻を使う', async () => {
    const planImport = makePlanImport({
      source: source({ parse: () => ({ ok: true, records: { ...RECORDS, lines: [] } }) }),
      repository: repository({
        loadSnapshot: async () => ({
          ...EMPTY_SNAPSHOT,
          lines: [
            {
              id: 'line-1',
              ekidataLineCd: 99301,
              name: '旧線',
              nameKana: null,
              color: null,
              abolishedAt: null,
            },
          ],
        }),
      }),
      now: () => new Date('2026-09-03T12:00:00Z'),
    });

    const result = await planImport(FILES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.lines.abolished).toBe(1);
  });
});
