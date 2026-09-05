import { describe, it, expect, beforeAll } from 'vitest';

// @furatora/database/client はモジュール読み込み時に DATABASE_URL を要求する
// （neon-http クライアントの構築のみで、ネットワークへは繋がない）。
// このテストは実行される SQL 文字列だけを検証するため、ダミー値で十分である。
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';
});

describe('visibility', () => {
  it('publishedStation は published_at の非NULL判定を生成する', async () => {
    const { db } = await import('@furatora/database/client');
    const { stations } = await import('@furatora/database/schema');
    const { publishedStation } = await import('./visibility');

    const { sql } = db.select().from(stations).where(publishedStation()).toSQL();

    expect(sql).toContain('"stations"."published_at" is not null');
  });

  it('visibleLine は slug の非NULL判定と公開駅の EXISTS 判定を両方含む', async () => {
    const { db } = await import('@furatora/database/client');
    const { lines } = await import('@furatora/database/schema');
    const { visibleLine } = await import('./visibility');

    const { sql } = db.select().from(lines).where(visibleLine()).toSQL();

    expect(sql).toContain('"lines"."slug" is not null');
    expect(sql).toContain('exists');
    expect(sql).toContain('"stations"."published_at" is not null');
    // 相関: サブクエリの line_id が外側の lines.id を参照していること
    expect(sql).toContain('"station_lines"."line_id" = "lines"."id"');
  });

  it('visibleOperator は公開駅を1件以上持つことを EXISTS で判定する', async () => {
    const { db } = await import('@furatora/database/client');
    const { operators } = await import('@furatora/database/schema');
    const { visibleOperator } = await import('./visibility');

    const { sql } = db.select().from(operators).where(visibleOperator()).toSQL();

    expect(sql).toContain('exists');
    expect(sql).toContain('"stations"."operator_id" = "operators"."id"');
    expect(sql).toContain('"stations"."published_at" is not null');
  });
});
