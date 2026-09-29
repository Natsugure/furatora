// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DirectionDefaultConflictError, type LineDirectionWriteInput } from '@/features/line/ports';
import { dbLineDirectionRepository } from './lineDirectionRepository';

// CI に DB が無いため、クエリビルダを記録する偽物で「どの条件で、どの順に書くか」を確かめる。
// schema と drizzle-orm は本物を使い、.where() に渡った条件を SQL に描画して検証する
type Call = { op: 'select' | 'update' | 'insert' };

const { calls, results, withTransaction } = vi.hoisted(() => ({
  calls: [] as { op: 'select' | 'update' | 'insert'; where?: unknown }[],
  // 各文の await が返す値を、呼ばれた順に取り出す
  results: [] as unknown[],
  withTransaction: vi.fn(),
}));

function builder(op: Call['op']) {
  const entry: { op: Call['op']; where?: unknown } = { op };
  calls.push(entry);
  const b = {
    set: () => b,
    from: () => b,
    values: () => b,
    returning: () => b,
    for: () => b,
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

const fakeQueryRunner = {
  select: () => builder('select'),
  update: () => builder('update'),
  insert: () => builder('insert'),
};

// vi.mock は巻き上げられるため、偽物は getter で遅延参照する
vi.mock('@furatora/database/client', () => ({
  get db() {
    return fakeQueryRunner;
  },
}));
vi.mock('@furatora/database/tx', () => ({ withTransaction }));

const dialect = new PgDialect();
const render = (call: { where?: unknown } | undefined) => {
  if (!call?.where) throw new Error('where が渡されていない');
  return dialect.sqlToQuery(call.where as SQL);
};

const LINE_ID = 'line-1';
const DIRECTION_ID = 'direction-1';
const input = (overrides: Partial<LineDirectionWriteInput> = {}): LineDirectionWriteInput => ({
  directionType: 'outbound',
  displayName: '池袋方面',
  displayNameEn: null,
  notes: null,
  isDefault: true,
  ...overrides,
});
const row = { id: DIRECTION_ID, lineId: LINE_ID, ...input() };

describe('dbLineDirectionRepository', () => {
  beforeEach(() => {
    calls.length = 0;
    results.length = 0;
    withTransaction.mockReset();
    withTransaction.mockImplementation((fn: (tx: typeof fakeQueryRunner) => Promise<unknown>) => fn(fakeQueryRunner));
  });

  describe('update（既定にする）', () => {
    it('対象を確かめてから、移動先の組の旧既定を自分以外について外し、更新する', async () => {
      results.push([{ id: DIRECTION_ID }], undefined, [row]);

      const updated = await dbLineDirectionRepository.update(LINE_ID, DIRECTION_ID, input({ directionType: 'outbound' }));

      expect(updated).toEqual(row);
      expect(withTransaction).toHaveBeenCalledTimes(1);
      expect(calls.map((c) => c.op)).toEqual(['select', 'update', 'update']);

      // 外す条件は「新しい」方面タイプの組で、自分自身を除く（除かないと自分の既定を外してから立て直す無駄が出る）
      const clear = render(calls[1]);
      expect(clear.sql).toContain('"line_directions"."direction_type" = $2');
      expect(clear.sql).toContain('"line_directions"."is_default" = $3');
      expect(clear.sql).toContain('"line_directions"."id" <> $4');
      expect(clear.params).toEqual([LINE_ID, 'outbound', true, DIRECTION_ID]);
    });

    it('対象が無い（別路線の id を含む）ときは、旧既定を外さずに null を返す', async () => {
      results.push([]);

      const updated = await dbLineDirectionRepository.update(LINE_ID, DIRECTION_ID, input());

      expect(updated).toBeNull();
      expect(calls.map((c) => c.op)).toEqual(['select']);
    });
  });

  describe('create（既定にする）', () => {
    it('同じ組の旧既定をすべて外してから作る（自分はまだ無いので除外しない）', async () => {
      results.push(undefined, [row]);

      await dbLineDirectionRepository.create(LINE_ID, input({ directionType: 'inbound' }));

      expect(withTransaction).toHaveBeenCalledTimes(1);
      expect(calls.map((c) => c.op)).toEqual(['update', 'insert']);
      const clear = render(calls[0]);
      expect(clear.sql).not.toContain('<>');
      expect(clear.params).toEqual([LINE_ID, 'inbound', true]);
    });
  });

  describe('既定にしない書き込み', () => {
    it('create はトランザクションを使わず1文で書く', async () => {
      results.push([{ ...row, isDefault: false }]);

      await dbLineDirectionRepository.create(LINE_ID, input({ isDefault: false }));

      expect(withTransaction).not.toHaveBeenCalled();
      expect(calls.map((c) => c.op)).toEqual(['insert']);
    });

    it('update はトランザクションを使わず1文で書き、他の行の既定には触らない', async () => {
      results.push([{ ...row, isDefault: false }]);

      await dbLineDirectionRepository.update(LINE_ID, DIRECTION_ID, input({ isDefault: false }));

      expect(withTransaction).not.toHaveBeenCalled();
      expect(calls.map((c) => c.op)).toEqual(['update']);
      expect(render(calls[0]).params).toEqual([DIRECTION_ID, LINE_ID]);
    });
  });

  it('既定の部分ユニーク違反は DirectionDefaultConflictError にする', async () => {
    const violation = Object.assign(new Error('duplicate key'), {
      cause: { code: '23505', constraint: 'unique_line_direction_default' },
    });
    results.push(undefined, violation);

    await expect(dbLineDirectionRepository.create(LINE_ID, input())).rejects.toBeInstanceOf(DirectionDefaultConflictError);
  });

  it('別の制約の違反はそのまま投げる', async () => {
    const violation = Object.assign(new Error('duplicate key'), {
      cause: { code: '23505', constraint: 'some_other_constraint' },
    });
    results.push(undefined, violation);

    await expect(dbLineDirectionRepository.create(LINE_ID, input())).rejects.toBe(violation);
  });
});
