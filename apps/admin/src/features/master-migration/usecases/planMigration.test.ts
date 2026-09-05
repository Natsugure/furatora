import { describe, it, expect, vi } from 'vitest';
import { makePlanMigration } from './planMigration';
import type { EkidataCsvSource } from '@/features/master-import/ports';
import type { ImportedRecords } from '@/features/master-import/domain/importedRecords';
import type { MasterMigrationRepository } from '../ports';
import type { MigrationSnapshot } from '../domain/migrationPlan';

const RECORDS: ImportedRecords = {
  operators: [{ ekidataCompanyCd: 18, name: '東京メトロ' }],
  lines: [
    { ekidataLineCd: 99301, ekidataCompanyCd: 18, name: '東京メトロ丸ノ内線', nameKana: null, color: null },
  ],
  stationGroups: [],
  stations: [
    {
      ekidataStationCd: 9930101,
      ekidataLineCd: 99301,
      ekidataStationGroupCd: 9930101,
      name: '新宿',
      nameKana: null,
      lat: null,
      lon: null,
      prefCode: 13,
    },
  ],
  adjacencies: [],
  closures: { lines: new Map(), stations: new Map() },
  seen: { lines: new Set([99301]), stations: new Set([9930101]) },
  warnings: [],
};

const SNAPSHOT: MigrationSnapshot = {
  operators: [
    { id: 'op', name: '東京メトロ', odptOperatorId: 'odpt.Operator:TokyoMetro', ekidataCompanyCd: null },
  ],
  lines: [{ id: 'ln', name: '東京メトロ丸ノ内線', operatorId: 'op', ekidataLineCd: null }],
  stations: [{ id: 'st', name: '新宿', ekidataStationCd: null, lineIds: ['ln'] }],
  connections: { total: 546, replaceable: 546, withInput: 0 },
};

const FILES = { company: 'a', line: 'b', station: 'c', join: 'd' };

function deps(overrides: { source?: Partial<EkidataCsvSource>; snapshot?: MigrationSnapshot } = {}) {
  const loadSnapshot = vi.fn().mockResolvedValue(overrides.snapshot ?? SNAPSHOT);
  const apply = vi.fn();
  const repository: MasterMigrationRepository = { loadSnapshot, apply };
  const source: EkidataCsvSource = {
    parse: vi.fn().mockReturnValue({ ok: true, records: RECORDS }),
    digest: vi.fn().mockResolvedValue('token'),
    ...overrides.source,
  };
  return { source, repository, loadSnapshot, apply };
}

describe('planMigration', () => {
  it('件数と未突合一覧と planToken を返す', async () => {
    const { source, repository } = deps();
    const result = await makePlanMigration({ source, repository })(FILES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.operators).toMatchObject({ total: 1, assigned: 1, unmatched: 0 });
    expect(result.summary.lines).toMatchObject({ assigned: 1 });
    expect(result.summary.stations).toMatchObject({ assigned: 1 });
    expect(result.summary.connections).toEqual({ total: 546, replaceable: 546, withInput: 0 });
    expect(result.blockers).toEqual([]);
    expect(result.planToken).toBe('token');
  });

  it('DB を変更しない', async () => {
    const { source, repository, apply } = deps();
    await makePlanMigration({ source, repository })(FILES);

    expect(apply).not.toHaveBeenCalled();
  });

  it('CSV を読めなければ突合せずエラーを返す', async () => {
    const errors = [{ kind: 'missing_columns' as const, file: 'line' as const, columns: ['line_cd'] }];
    const { source, repository, loadSnapshot } = deps({
      source: { parse: vi.fn().mockReturnValue({ ok: false, errors }) },
    });

    const result = await makePlanMigration({ source, repository })(FILES);

    expect(result).toEqual({ ok: false, errors });
    expect(loadSnapshot).not.toHaveBeenCalled();
  });

  it('適用不能な事象を提示する', async () => {
    const { source, repository } = deps({
      snapshot: { ...SNAPSHOT, connections: { total: 546, replaceable: 545, withInput: 1 } },
    });

    const result = await makePlanMigration({ source, repository })(FILES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blockers).toMatchObject([{ code: 'connection_has_input' }]);
  });
});
