import { describe, it, expect, beforeAll } from 'vitest';

// @furatora/database/client はモジュール読み込み時に DATABASE_URL を要求する
// （neon-http クライアントの構築のみで、ネットワークへは繋がない）。ダミー値で十分である。
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';
});

describe('facilitiesByRoute', () => {
  it('ルートごとに設備をまとめる', async () => {
    const { facilitiesByRoute } = await import('./transferPartnerRows');

    const result = facilitiesByRoute([
      { routeId: 'r1', typeCode: 'elevator' },
      { routeId: 'r1', typeCode: 'stairs' },
      { routeId: 'r2', typeCode: 'sameFloor' },
    ]);

    expect(result.get('r1')).toEqual(['elevator', 'stairs']);
    expect(result.get('r2')).toEqual(['sameFloor']);
  });
});
