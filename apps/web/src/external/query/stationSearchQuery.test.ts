import { describe, it, expect, beforeAll } from 'vitest';

// @furatora/database/client はモジュール読み込み時に DATABASE_URL を要求する
// （neon-http クライアントの構築のみで、ネットワークへは繋がない）。
// このテストは実行される SQL 文字列だけを検証するため、ダミー値で十分である。
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';
});

async function buildSql(query: string) {
  const { db } = await import('@furatora/database/client');
  const { stations } = await import('@furatora/database/schema');
  const { stationSearchCondition, stationSearchRank } = await import('./stationSearchQuery');

  return db
    .select({ id: stations.id })
    .from(stations)
    .where(stationSearchCondition(query))
    .orderBy(stationSearchRank(query))
    .limit(60)
    .toSQL();
}

describe('stationSearchCondition', () => {
  it('駅名・カナ・ローマ字の各列を、区切り記号を除いた値で比較する', async () => {
    const { sql, params } = await buildSql('Naka-meguro');

    expect(sql).toContain('"stations"."name" ilike');
    expect(sql).toContain(`translate("stations"."name_kana", ' 　', '')`);
    expect(sql).toContain(`translate("stations"."name_en", '- 　', '')`);
    expect(params).toContain('%Nakameguro%');
  });

  it('空白だけの入力では、カナ・ローマ字の条件を付けない（%% が全駅に一致するため）', async () => {
    const { sql } = await buildSql(' 　');

    expect(sql).not.toContain('"stations"."name_kana"');
    expect(sql).not.toContain('"stations"."name_en"');
  });

  it('ハイフンだけの入力では、ローマ字の条件を付けない', async () => {
    const { sql } = await buildSql('-');

    expect(sql).not.toContain('"stations"."name_en"');
  });
});

describe('stationSearchRank', () => {
  it('完全一致 → 前方一致 → 部分一致の順位で並べてから limit をかける', async () => {
    const { sql, params } = await buildSql('しんじゅく');

    expect(sql).toMatch(/order by case when .+ then 0 when .+ then 1 else 2 end limit/);
    expect(params).toEqual(expect.arrayContaining(['シンジュク', 'シンジュク%', '%シンジュク%']));
  });
});
