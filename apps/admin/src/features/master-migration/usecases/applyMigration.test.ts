import { describe, it, expect, vi } from 'vitest';
import { makeApplyMigration } from './applyMigration';
import { PlanTokenMismatchError, type EkidataCsvSource } from '@/features/master-import/ports';
import type { MasterMigrationRepository } from '../ports';

const FILES = { company: 'a', line: 'b', station: 'c', join: 'd' };
const RESULT = {
  operators: { assigned: 17 },
  lines: { assigned: 46 },
  stations: { assigned: 465 },
  stationConnections: { deleted: 546 },
};

function deps(overrides: Partial<EkidataCsvSource> = {}) {
  const apply = vi.fn().mockResolvedValue(RESULT);
  const repository: MasterMigrationRepository = { loadSnapshot: vi.fn(), apply };
  const source: EkidataCsvSource = {
    parse: vi.fn().mockReturnValue({ ok: true, records: { any: true } }),
    digest: vi.fn().mockResolvedValue('token'),
    ...overrides,
  };
  return { source, repository, apply };
}

describe('applyMigration', () => {
  it('planToken が一致すれば適用する', async () => {
    const { source, repository, apply } = deps();

    await expect(makeApplyMigration({ source, repository })(FILES, 'token')).resolves.toEqual({
      ok: true,
      applied: RESULT,
    });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('差分を見せたのと別のCSVなら適用しない', async () => {
    const { source, repository, apply } = deps();

    await expect(makeApplyMigration({ source, repository })(FILES, '別のトークン')).rejects.toBeInstanceOf(
      PlanTokenMismatchError,
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('CSV を読めなければ適用しない', async () => {
    const errors = [{ kind: 'malformed' as const, file: 'station' as const, message: '列数が合わない' }];
    const { source, repository, apply } = deps({ parse: vi.fn().mockReturnValue({ ok: false, errors }) });

    await expect(makeApplyMigration({ source, repository })(FILES, 'token')).resolves.toEqual({
      ok: false,
      errors,
    });
    expect(apply).not.toHaveBeenCalled();
  });
});
