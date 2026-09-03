import { describe, it, expect, vi } from 'vitest';
import { makeApplyImport } from './applyImport';
import { PlanTokenMismatchError } from '../ports';
import type { EkidataCsvFiles, EkidataCsvSource, MasterImportRepository } from '../ports';
import type { ApplyResult, ImportedRecords } from '../domain/importedRecords';

const FILES: EkidataCsvFiles = { company: 'c', line: 'l', station: 's', join: 'j' };

const RECORDS: ImportedRecords = {
  operators: [],
  lines: [],
  stationGroups: [],
  stations: [],
  adjacencies: [],
  closures: { lines: new Map(), stations: new Map() },
  seen: { lines: new Set(), stations: new Set() },
  warnings: [],
};

const APPLIED: ApplyResult = {
  operators: { created: 162, updated: 0 },
  lines: { created: 602, updated: 0, abolished: 0 },
  stationGroups: { created: 8782, updated: 0 },
  stations: { created: 10625, updated: 0, abolished: 0 },
  stationLines: { created: 10625 },
  stationAdjacencies: { created: 10040 },
  stationConnections: { created: 6946 },
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
    loadSnapshot: async () => {
      throw new Error('loadSnapshot は適用側で呼ばれない');
    },
    apply: async () => APPLIED,
    ...overrides,
  };
}

describe('applyImport', () => {
  it('planToken が一致すれば適用し、件数を返す', async () => {
    const apply = vi.fn(async () => APPLIED);
    const applyImport = makeApplyImport({ source: source(), repository: repository({ apply }) });

    const result = await applyImport(FILES, 'digest-abc');

    expect(result).toEqual({ ok: true, applied: APPLIED });
    expect(apply).toHaveBeenCalledWith(RECORDS);
  });

  // 差分を見せたのとは別のCSVで適用されるのを防ぐ
  it('planToken が一致しなければ適用しない', async () => {
    const apply = vi.fn(async () => APPLIED);
    const applyImport = makeApplyImport({ source: source(), repository: repository({ apply }) });

    await expect(applyImport(FILES, 'digest-xyz')).rejects.toThrow(PlanTokenMismatchError);
    expect(apply).not.toHaveBeenCalled();
  });

  it('パースに失敗したら適用しない', async () => {
    const apply = vi.fn(async () => APPLIED);
    const applyImport = makeApplyImport({
      source: source({
        parse: () => ({ ok: false, errors: [{ kind: 'malformed', file: 'join', message: 'x' }] }),
      }),
      repository: repository({ apply }),
    });

    const result = await applyImport(FILES, 'digest-abc');

    expect(result).toEqual({
      ok: false,
      errors: [{ kind: 'malformed', file: 'join', message: 'x' }],
    });
    expect(apply).not.toHaveBeenCalled();
  });
});
