// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuplicateStopPatternError } from '@/features/stop-pattern/ports';
import type { TrainStopPatternInput } from '@/features/stop-pattern/schema';
import { dbStopPatternRepository } from './stopPatternRepository';

// CI に DB が無いため、withTransaction を偽物にして「DB のエラーをどのエラーに変えるか」を確かめる
const { withTransaction } = vi.hoisted(() => ({ withTransaction: vi.fn() }));

vi.mock('@furatora/database/client', () => ({ db: {} }));
vi.mock('@furatora/database/tx', () => ({ withTransaction }));
// 駅の範囲の確認は stationScopeGuard のテストの対象。ここでは常に当該駅のホームとして扱う
vi.mock('@/external/repository/stationScopeGuard', () => ({
  isPlatformOfStation: vi.fn(async () => true),
  belongsToStation: vi.fn(() => undefined),
}));

const STATION_ID = 'station-1';
const PATTERN_ID = 'pattern-1';
const pattern: TrainStopPatternInput = {
  platformId: '00000000-0000-4000-8000-000000000001',
  trainId: '00000000-0000-4000-8000-000000000002',
  carOneOuterMeters: 12.5,
  carNumbersAscendToward: 'minusX',
};

// 実 DB では drizzle-orm が pg のエラーを DrizzleQueryError で包み、code と constraint は cause に入る（Issue #73）
const PATTERN_CONSTRAINT = 'unique_train_stop_pattern';
const OTHER_CONSTRAINT = 'unique_other';
const wrapped = (code: string, constraint?: string) =>
  Object.assign(new Error('Failed query'), { cause: { code, constraint } });
const bare = (code: string, constraint?: string) =>
  Object.assign(new Error('duplicate key'), { code, constraint });

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
      withTransaction.mockRejectedValue(wrapped('23505', PATTERN_CONSTRAINT));

      await expect(run()).rejects.toBeInstanceOf(DuplicateStopPatternError);
    });

    it('ラップされていない一意制約違反も DuplicateStopPatternError に変える', async () => {
      withTransaction.mockRejectedValue(bare('23505', PATTERN_CONSTRAINT));

      await expect(run()).rejects.toBeInstanceOf(DuplicateStopPatternError);
    });

    // ホーム・列車の組み合わせの重複でなければ、409 の説明を付けない
    it('別の一意制約の違反は DuplicateStopPatternError にせず投げ直す', async () => {
      const err = wrapped('23505', OTHER_CONSTRAINT);
      withTransaction.mockRejectedValue(err);

      await expect(run()).rejects.toBe(err);
    });

    it('一意制約違反でないエラーはそのまま投げ直す', async () => {
      const err = wrapped('23503');
      withTransaction.mockRejectedValue(err);

      await expect(run()).rejects.toBe(err);
    });
  });
});

// 書き込む値を確かめるため、withTransaction に記録だけする偽の tx を渡す
function recordingTx() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  const returning = (row: { id: string }) => ({ returning: () => Promise.resolve([row]) });
  const tx = {
    insert: () => ({ values: (v: unknown) => { inserted.push(v); return returning({ id: 'new-pattern' }); } }),
    update: () => ({ set: (v: unknown) => { updated.push(v); return { where: () => returning({ id: PATTERN_ID }) }; } }),
  };
  return { tx, inserted, updated };
}

describe('dbStopPatternRepository が書き込む値', () => {
  beforeEach(() => {
    withTransaction.mockReset();
  });

  it('save は基準点と向きを train_stop_patterns の1行に書く', async () => {
    const { tx, inserted } = recordingTx();
    withTransaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));

    await expect(dbStopPatternRepository.save(STATION_ID, pattern)).resolves.toEqual({ id: 'new-pattern' });
    expect(inserted).toEqual([{
      platformId: pattern.platformId,
      trainId: pattern.trainId,
      carOneOuterMeters: '12.5',
      carNumbersAscendToward: 'minusX',
    }]);
  });

  it('update は基準点と向きを書き換える', async () => {
    const { tx, updated } = recordingTx();
    withTransaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));

    await expect(dbStopPatternRepository.update(PATTERN_ID, STATION_ID, pattern)).resolves.toBe(true);
    expect(updated).toEqual([{
      platformId: pattern.platformId,
      trainId: pattern.trainId,
      carOneOuterMeters: '12.5',
      carNumbersAscendToward: 'minusX',
    }]);
  });
});
