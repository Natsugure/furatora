// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuplicateStopPatternError } from '@/features/stop-pattern/ports';
import type { TrainStopPatternInput } from '@/features/stop-pattern/schema';
import { dbStopPatternRepository } from './stopPatternRepository';

// CI に DB が無いため、withTransaction を偽物にして「DB のエラーをどのエラーに変えるか」を確かめる
const { withTransaction } = vi.hoisted(() => ({ withTransaction: vi.fn() }));

vi.mock('@furatora/database/client', () => ({ db: {} }));
vi.mock('@furatora/database/tx', () => ({ withTransaction }));

const STATION_ID = 'station-1';
const PATTERN_ID = 'pattern-1';
const pattern: TrainStopPatternInput = {
  platformId: '00000000-0000-4000-8000-000000000001',
  trainId: '00000000-0000-4000-8000-000000000002',
  cars: [{ carNumber: 1, startMeters: 0, endMeters: 20 }],
};

// 実 DB では drizzle-orm が pg のエラーを DrizzleQueryError で包み、code は cause に入る（Issue #73）
const wrapped = (code: string) => Object.assign(new Error('Failed query'), { cause: { code } });
const bare = (code: string) => Object.assign(new Error('duplicate key'), { code });

const operations = [
  ['save', () => dbStopPatternRepository.save(STATION_ID, pattern)],
  ['update', () => dbStopPatternRepository.update(PATTERN_ID, STATION_ID, pattern)],
] as const;

describe('dbStopPatternRepository の一意制約違反', () => {
  beforeEach(() => {
    withTransaction.mockReset();
  });

  describe.each(operations)('%s', (_name, run) => {
    it('ラップされた一意制約違反を DuplicateStopPatternError に変える', async () => {
      withTransaction.mockRejectedValue(wrapped('23505'));

      await expect(run()).rejects.toBeInstanceOf(DuplicateStopPatternError);
    });

    it('ラップされていない一意制約違反も DuplicateStopPatternError に変える', async () => {
      withTransaction.mockRejectedValue(bare('23505'));

      await expect(run()).rejects.toBeInstanceOf(DuplicateStopPatternError);
    });

    it('一意制約違反でないエラーはそのまま投げ直す', async () => {
      const err = wrapped('23503');
      withTransaction.mockRejectedValue(err);

      await expect(run()).rejects.toBe(err);
    });
  });
});
