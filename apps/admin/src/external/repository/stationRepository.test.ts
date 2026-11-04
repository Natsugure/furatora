// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stations } from '@furatora/database/schema';
import { StationReferenceNotFoundError, type StationRepository } from '@/features/station/ports';
import { dbStationRepository } from './stationRepository';

// CI に DB が無いため、クエリビルダを記録する偽物で「どのテーブルに、どの値を INSERT するか」を確かめる
const { inserts, results, withTransaction } = vi.hoisted(() => ({
  inserts: [] as { table: unknown; values?: unknown }[],
  // 各文の await が返す値を、呼ばれた順に取り出す
  results: [] as unknown[],
  withTransaction: vi.fn(),
}));

function insertBuilder(table: unknown) {
  const entry: { table: unknown; values?: unknown } = { table };
  inserts.push(entry);
  const b = {
    values: (v: unknown) => {
      entry.values = v;
      return b;
    },
    returning: () => b,
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve().then(() => results.shift()).then(resolve, reject),
  };
  return b;
}

const fakeTx = { insert: (table: unknown) => insertBuilder(table) };

vi.mock('@furatora/database/tx', () => ({ withTransaction }));

type CreateInput = Parameters<StationRepository['create']>[0];
const input = (overrides: Partial<CreateInput> = {}): CreateInput => ({
  name: '新駅',
  operatorId: '00000000-0000-4000-8000-000000000001',
  lineId: '00000000-0000-4000-8000-000000000002',
  ...overrides,
});

const stationInsert = () => inserts.find((i) => i.table === stations);

describe('dbStationRepository.create', () => {
  beforeEach(() => {
    inserts.length = 0;
    results.length = 0;
    withTransaction.mockReset();
    withTransaction.mockImplementation((fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx));
    // stations の INSERT ... RETURNING、stationLines の INSERT の順
    results.push([{ id: 'station-1', name: '新駅' }], undefined);
  });

  it('入力したメモを stations に INSERT する', async () => {
    await dbStationRepository.create(input({ notes: 'エレベーターは改札外' }));

    expect(stationInsert()?.values).toMatchObject({ notes: 'エレベーターは改札外' });
  });

  it('メモを省くと notes に null を INSERT する', async () => {
    await dbStationRepository.create(input());

    expect(stationInsert()?.values).toMatchObject({ notes: null });
  });

  it('ラップされた外部キー違反を StationReferenceNotFoundError に変える', async () => {
    withTransaction.mockRejectedValue(Object.assign(new Error('insert failed'), { cause: { code: '23503' } }));

    await expect(dbStationRepository.create(input())).rejects.toBeInstanceOf(StationReferenceNotFoundError);
  });
});
