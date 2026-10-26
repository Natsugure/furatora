// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { trains, trainCarStructures, trainEquipments } from '@furatora/database/schema';
import type { TrainInput } from '@/features/train/schema';
import { dbTrainRepository } from './trainRepository';

// CI に DB が無いため、クエリビルダを記録する偽物で「どのテーブルに、どの順に、何を書くか」を確かめる。
// schema と drizzle-orm は本物を使い、.where() に渡った条件を SQL に描画して検証する
type Op = 'insert' | 'update' | 'delete';
type Call = { op: Op; table: unknown; runner: 'db' | 'tx'; values?: unknown; set?: unknown; where?: unknown };

const { calls, results, withTransaction } = vi.hoisted(() => ({
  calls: [] as Call[],
  // 各文の await が返す値を、呼ばれた順に取り出す
  results: [] as unknown[],
  withTransaction: vi.fn(),
}));

function builder(op: Op, table: unknown, runner: Call['runner']) {
  const entry: Call = { op, table, runner };
  calls.push(entry);
  const b = {
    values: (v: unknown) => {
      entry.values = v;
      return b;
    },
    set: (v: unknown) => {
      entry.set = v;
      return b;
    },
    returning: () => b,
    where: (cond: unknown) => {
      entry.where = cond;
      return b;
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve().then(() => {
        const next = results.shift();
        if (next instanceof Error) throw next;
        return next;
      }).then(resolve, reject),
  };
  return b;
}

function runner(name: Call['runner']) {
  return {
    insert: (table: unknown) => builder('insert', table, name),
    update: (table: unknown) => builder('update', table, name),
    delete: (table: unknown) => builder('delete', table, name),
  };
}

const fakeDb = runner('db');
const fakeTx = runner('tx');

// vi.mock は巻き上げられるため、偽物は getter で遅延参照する
vi.mock('@furatora/database/client', () => ({
  get db() {
    return fakeDb;
  },
}));
vi.mock('@furatora/database/tx', () => ({ withTransaction }));

const dialect = new PgDialect();
const render = (call: Call | undefined) => {
  if (!call?.where) throw new Error('where が渡されていない');
  return dialect.sqlToQuery(call.where as SQL);
};

const TRAIN_ID = 'train-1';
const OPERATOR_ID = 'operator-1';

const input = (overrides: Partial<TrainInput> = {}): TrainInput => ({
  name: '10000系',
  operatorId: OPERATOR_ID,
  lineIds: ['line-1', 'line-2'],
  carCount: 2,
  carStructure: [
    { carNumber: 1, doorCount: 4, carLength: 20.5 },
    { carNumber: 2, doorCount: 4, carLength: null },
  ],
  freeSpaces: [{ carNumber: 1, nearDoor: 2, isStandard: true }],
  prioritySeats: [{ carNumber: 2, nearDoor: 1, isStandard: false }],
  ...overrides,
});

// trains テーブルの列名は operators（単一FK）/ lines（uuid配列）
const expectedTrainValues = {
  name: '10000系',
  operators: OPERATOR_ID,
  lines: ['line-1', 'line-2'],
  carCount: 2,
};

const expectedCarRows = [
  // decimal 列のため文字列で書く（#165 まで）
  { trainId: TRAIN_ID, carNumber: 1, doorCount: 4, carLength: '20.5' },
  { trainId: TRAIN_ID, carNumber: 2, doorCount: 4, carLength: null },
];

const expectedEquipmentRows = [
  { trainId: TRAIN_ID, type: 'free_space', carNumber: 1, nearDoor: 2, isStandard: true },
  { trainId: TRAIN_ID, type: 'priority_seat', carNumber: 2, nearDoor: 1, isStandard: false },
];

describe('dbTrainRepository', () => {
  beforeEach(() => {
    calls.length = 0;
    results.length = 0;
    withTransaction.mockReset();
    withTransaction.mockImplementation((fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx));
  });

  describe('create', () => {
    it('1トランザクションで列車を入れ、返った id で号車構成・設備を入れる', async () => {
      results.push([{ id: TRAIN_ID }], undefined, undefined);

      const created = await dbTrainRepository.create(input());

      expect(created).toEqual({ id: TRAIN_ID });
      expect(withTransaction).toHaveBeenCalledTimes(1);
      expect(calls.map((c) => [c.op, c.table, c.runner])).toEqual([
        ['insert', trains, 'tx'],
        ['insert', trainCarStructures, 'tx'],
        ['insert', trainEquipments, 'tx'],
      ]);
      expect(calls[0]?.values).toEqual(expectedTrainValues);
      expect(calls[1]?.values).toEqual(expectedCarRows);
      expect(calls[2]?.values).toEqual(expectedEquipmentRows);
    });

    it('号車構成・設備が無ければ、列車だけを入れる', async () => {
      results.push([{ id: TRAIN_ID }]);

      await dbTrainRepository.create(input({ carStructure: null, freeSpaces: [], prioritySeats: undefined }));

      expect(calls.map((c) => c.table)).toEqual([trains]);
    });

    it('途中の書き込みが失敗したら例外を投げる（ROLLBACK は withTransaction に任せる）', async () => {
      results.push([{ id: TRAIN_ID }], new Error('insert failed'));

      await expect(dbTrainRepository.create(input())).rejects.toThrow('insert failed');
      expect(withTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('1トランザクションで列車を更新し、号車構成・設備を消して入れ直す', async () => {
      results.push([{ id: TRAIN_ID }], undefined, undefined, undefined, undefined);

      const updated = await dbTrainRepository.update(TRAIN_ID, input());

      expect(updated).toBe(true);
      expect(withTransaction).toHaveBeenCalledTimes(1);
      expect(calls.map((c) => [c.op, c.table, c.runner])).toEqual([
        ['update', trains, 'tx'],
        ['delete', trainCarStructures, 'tx'],
        ['delete', trainEquipments, 'tx'],
        ['insert', trainCarStructures, 'tx'],
        ['insert', trainEquipments, 'tx'],
      ]);
      expect(calls[0]?.set).toEqual(expectedTrainValues);
      // 列を取り違えても params は同じになるため、条件の列も確かめる
      expect(render(calls[0])).toMatchObject({ sql: '"trains"."id" = $1', params: [TRAIN_ID] });
      expect(render(calls[1])).toMatchObject({ sql: '"train_car_structures"."train_id" = $1', params: [TRAIN_ID] });
      expect(render(calls[2])).toMatchObject({ sql: '"train_equipments"."train_id" = $1', params: [TRAIN_ID] });
      expect(calls[3]?.values).toEqual(expectedCarRows);
      expect(calls[4]?.values).toEqual(expectedEquipmentRows);
    });

    it('号車構成・設備が空になったら、消すだけで入れない', async () => {
      results.push([{ id: TRAIN_ID }], undefined, undefined);

      await dbTrainRepository.update(TRAIN_ID, input({ carStructure: null, freeSpaces: null, prioritySeats: null }));

      expect(calls.map((c) => [c.op, c.table])).toEqual([
        ['update', trains],
        ['delete', trainCarStructures],
        ['delete', trainEquipments],
      ]);
    });

    it('列車が無ければ false を返し、号車構成・設備に触れない', async () => {
      results.push([]);

      const updated = await dbTrainRepository.update(TRAIN_ID, input());

      expect(updated).toBe(false);
      expect(calls.map((c) => c.op)).toEqual(['update']);
    });
  });

  describe('delete', () => {
    it('列車の1文だけを消し（子は CASCADE）、消せたら true を返す', async () => {
      results.push([{ id: TRAIN_ID }]);

      const deleted = await dbTrainRepository.delete(TRAIN_ID);

      expect(deleted).toBe(true);
      expect(withTransaction).not.toHaveBeenCalled();
      expect(calls.map((c) => [c.op, c.table, c.runner])).toEqual([['delete', trains, 'db']]);
      expect(render(calls[0])).toMatchObject({ sql: '"trains"."id" = $1', params: [TRAIN_ID] });
    });

    it('列車が無ければ false を返す', async () => {
      results.push([]);

      expect(await dbTrainRepository.delete(TRAIN_ID)).toBe(false);
    });
  });
});
